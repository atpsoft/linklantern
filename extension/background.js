/*
 * background.js - service worker for the Link Lantern extension
 * Handles blinking the extension icon when visiting a potentially dangerous domain.
 */

const BLINK_INTERVAL_MS = 500;

// Map of { tabId: { intervalId, state } }
const blinkingTabs = new Map();

// Map of { tabId: iconPath }
const lastIconPathForTab = new Map();

const defaultIconPaths = {
  16: "assets/icons/default/icon-16.png",
  32: "assets/icons/default/icon-32.png",
  48: "assets/icons/default/icon-48.png",
  128: "assets/icons/default/icon-128.png"
};

const redIconPaths = {
  16: "assets/icons/red/icon-16.png",
  32: "assets/icons/red/icon-32.png",
  48: "assets/icons/red/icon-48.png",
  128: "assets/icons/red/icon-128.png"
};

const yellowIconPaths = {
  16: "assets/icons/yellow/icon-16.png",
  32: "assets/icons/yellow/icon-32.png",
  48: "assets/icons/yellow/icon-48.png",
  128: "assets/icons/yellow/icon-128.png"
};

const greenIconPaths = {
  16: "assets/icons/green/icon-16.png",
  32: "assets/icons/green/icon-32.png",
  48: "assets/icons/green/icon-48.png",
  128: "assets/icons/green/icon-128.png"
};

// Safely set the action icon for a tab, ignoring errors if the tab no longer exists.
function safeSetIcon(tabId, path) {
//  const isSame = lastIconPathForTab.get(tabId) === path;
//  console.debug(`safeSetIcon tabId: ${tabId}, path: ${JSON.stringify(path)}, isSame: ${isSame}`);
//  if (isSame) return;

  path = path || defaultIconPaths;
  chrome.action.setIcon({ tabId, path }, () => {
    if (chrome.runtime.lastError) {
      console.debug(`error setting icon for tab ${tabId}:`, chrome.runtime.lastError.message);
    } else {
      lastIconPathForTab.set(tabId, path);
    }
  });
}

// Start blinking the icon for a tab
function startBlinking(tabId, colorPaths) {
  if (blinkingTabs.has(tabId)) return;

  // start with the color
  safeSetIcon(tabId, colorPaths);

  let showColor = true;
  const intervalId = setInterval(() => {
    const path = showColor ? colorPaths : defaultIconPaths;
    safeSetIcon(tabId, path);
    showColor = !showColor;
  }, BLINK_INTERVAL_MS);

  blinkingTabs.set(tabId, intervalId);
}

function stopBlinking(tabId) {
  const intervalId = blinkingTabs.get(tabId);
  if (intervalId) {
    clearInterval(intervalId);
    blinkingTabs.delete(tabId);
  }
}

function getIconPathsByColor(color) {
  switch (color) {
    case "red":
      return redIconPaths;
    case "yellow":
      return yellowIconPaths;
    case "green":
      return greenIconPaths;
    default:
      return defaultIconPaths;
  }
}

function handleUpdateExtensionIcon(tabId, message) {
  const colorPaths = getIconPathsByColor(message.color);

  if (message.blink === true) {
    stopBlinking(tabId);
    startBlinking(tabId, colorPaths);
  } else if (message.blink === false) {
    stopBlinking(tabId);
    safeSetIcon(tabId, colorPaths);
  }

}

function handleCloseTab(tabId) {
  stopBlinking(tabId);
  chrome.tabs.remove(tabId, () => {
    if (chrome.runtime.lastError) {
      console.debug(`Unable to close tab ${tabId}:`, chrome.runtime.lastError.message);
    }
    lastIconPathForTab.delete(tabId);
  });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id;
  if (typeof tabId !== "number") return;
  if (message && message.type === "updateExtensionIcon") {
    handleUpdateExtensionIcon(tabId, message);
  } else if (message && message.type === "closeTab") {
    handleCloseTab(tabId);
  }
});

// fired when they click the extension icon
chrome.action.onClicked.addListener((tab) => {
  if (!tab || typeof tab.id !== "number") return;
  // send a message back to the content script
  chrome.tabs.sendMessage(tab.id, { type: "togglePopup" }, () => {
    if (chrome.runtime.lastError) {
      // probably only happens on chrome:// pages or the like
      console.debug(`error sending message to content script:`, chrome.runtime.lastError.message);
    }
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  stopBlinking(tabId);
  lastIconPathForTab.delete(tabId);
});


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
// was added at one time before I added the webNavigation.onCompleted listener
// pretty sure it is not needed anymore, all appears to be working well
//  console.debug("onUpdated, lastIconPathForTab ", tabId, lastIconPathForTab.get(tabId));
//  safeSetIcon(tabId, lastIconPathForTab.get(tabId));
});

// Listen for completed navigations (including back/forward) and log the URL
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return; // Only track top frame
  stopBlinking(details.tabId);
  console.debug(`onCompleted, details: ${JSON.stringify(details)}`);
  safeSetIcon(details.tabId, defaultIconPaths);
  console.debug(`Navigated to ${details.url} (tab ${details.tabId}), setting default icon`);
//  console.debug(`Navigated to ${details.url} (tab ${details.tabId})`);
  // kjmtodo: send message to the content script to recalculate the age / update the icon
  const domain = new URL(details.url).hostname;
//  console.debug(`domainAgeCheck being called with domain: ${domain}`);
  try {
    await chrome.tabs.sendMessage(details.tabId, { type: "domainAgeCheck", domain: domain });
  } catch (err) {
    console.debug(`error sending message to content script, setting default icon:`, err);
  }
});

