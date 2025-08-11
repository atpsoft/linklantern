const POPUP_ID = "link-lantern-overlay";

async function handleTogglePopup(msg) {
  const whitelist = await getWhitelist();
  const existing = document.getElementById(POPUP_ID);
  if (existing) {
    existing.remove();
    return;
  }

  const info = window._linkLanternAgeInfo;
  if (!info) return;

  showPopup({
    error: info.error,
    registrationDate: info.registrationDate,
    days: info.days,
    color: info.color,
    domain: info.domain,
    whitelist,
  });
}

function showPopup({
  error = null,
  registrationDate = null,
  showLink = false,
  color,
  domain,
  whitelist,
}) {
  if (document.getElementById(POPUP_ID)) return;

  var days = 0;
  let text = "";
  if (error) {
    console.log("error popup", error);
    text = error;
  } else {
    days = calculateDomainAgeDays(registrationDate);
    // Format age: < 90 days -> days; < 2 years -> months; >= 2 years -> years (1 decimal)
    let ageDisplay;
    if (days < 90) {
      ageDisplay = `${Math.floor(days)} days`;
    } else if (days < 365 * 2) {
      const months = Math.floor(days / 30);
      ageDisplay = `${months} months`;
    } else {
      ageDisplay = `${(days / 365).toFixed(1)} years`;
    }

    const prefix = color === "green" ? "" : "Warning:";
    text = `${prefix} This domain is ${ageDisplay} old (registered on ${registrationDate.toDateString()}).`;
  }

  const overlay = document.createElement("div");
  overlay.id = POPUP_ID;

  if (whitelist?.[domain]) {
    color = "green";
  }

  if (color === "yellow") {
    overlay.classList.add("yellow-age");
  } else if (color === "green") {
    overlay.classList.add("green-age");
  }

  const msg = document.createElement("div");
  msg.textContent = text;
  overlay.appendChild(msg);

  if (showLink) {
    const br = document.createElement("br");
    overlay.appendChild(br);
    const a = document.createElement("a");
    a.href = `https://linklantern.com/?url=${domain}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "View with Link Lantern";
    overlay.appendChild(a);
  }

  const btnConfigs = [];

  const showExitButton = color !== "green";
  const showWhitelistButton = (color !== "green" && !whitelist?.[domain]);

  if (showExitButton) {
    btnConfigs.push({
      text: "Get me out of here",
      id: "get-out-btn",
      onClick: () => chrome.runtime.sendMessage({ type: "closeTab" }),
    });
  }

  if (showWhitelistButton) {
    btnConfigs.push(createDontShowButton(domain, whitelist));
  }

  btnConfigs.push({
    text: (color === "yellow" || color === "red" ? "Close" : "OK"),
    id: color === "yellow" || color === "red" ? "close-btn" : "ok-btn",
    onClick: (overlay) => overlay.remove(),
  });

  btnConfigs.forEach(({ text, id, onClick }) => {
    const btn = document.createElement("button");
    btn.textContent = text;
    if (id) btn.id = id;
    btn.addEventListener("click", () => onClick(overlay));
    overlay.appendChild(btn);
  });

  window._linkLanternAgeInfo = {
    error: error,
    registrationDate: registrationDate,
    days: days,
    color: color,
    domain: domain,
  }

  document.documentElement.appendChild(overlay);
}

// Reusable helper to construct the trusted button
function createDontShowButton(domain, whitelist) {
  return {
    text: "Don't warn me again on this site",
    id: "dont-show-btn",
    onClick: async overlay => {
      await whitelistDomain(domain);

      // Notify background to stop blinking and show solid colour
      chrome.runtime.sendMessage({
        type: "updateExtensionIcon",
        color: "green",
        blink: false
      });
      overlay.remove();
    }
  };
}
