// Copyright 2025 ATPSoft, all rights reserved.

const WHITELIST_KEY = "whitelistedDomains";
async function getWhitelist() {
  const result = await chrome.storage.local.get(WHITELIST_KEY);
  return result[WHITELIST_KEY] || {};
}

async function whitelistDomain(domain) {
  const whitelist = await getWhitelist();
  whitelist[domain] = true;
  await chrome.storage.local.set({ [WHITELIST_KEY]: whitelist });
}

async function handleListeners(msg) {
  if (msg && msg.type === "togglePopup") {
    handleTogglePopup(msg);
  } else if (msg && msg.type === "domainAgeCheck") {
    handleDomainAgeCheck(msg);
  }
}

async function handleDomainAgeCheck(msg) {
    let domain = msg.domain;
    if (!domain) {
      console.debug("handleDomainAgeCheck: no domain");
      return;
    }
    const whitelist = await getWhitelist();
    // Check the domain age and alert if it is less than a year old
    try {
      const registrationDate = await getDomainRegistrationDate(domain);
      if (registrationDate) {
        const days = calculateDomainAgeDays(registrationDate);

        // Determine icon color and whether it should blink
        let color = "green";
        let shouldBlink = false;
        if (days <= 365) {
          color = "red"; // < 1 year
          shouldBlink = true;
        } else if (days <= 365 * 3) {
          color = "yellow"; // between 1 and 3 years
          shouldBlink = true;
        }

        const isYoung = shouldBlink;

        if (isYoung && !whitelist[domain]) {
          showPopup({
            registrationDate,
            days,
            color,
            domain,
            whitelist,
          });
        }
        const isWhitelisted = !!whitelist[domain];
        const colorToSend = isWhitelisted ? "green" : color;
        const blinkToSend = isWhitelisted ? false : shouldBlink;

        // Store age info for icon-click popup even if whitelist
        window._linkLanternAgeInfo = { color: color, days: days, registrationDate: registrationDate, domain: domain };

        chrome.runtime.sendMessage({
          type: "updateExtensionIcon",
          color: colorToSend,
          blink: blinkToSend
        });
      }
  } catch (err) {
    console.info("Failed to determine domain age:", err);

    // Determine if the domain seems to use a country-specific TLD (ccTLD)
    const ccMessage = /\.[a-z]{2}$/i.test(domain) ? " This is common for country-specific domains." : "";

    const errorText = `Unable to determine domain age (RDAP error: ${err.message}).${ccMessage}`;
    const isWhitelisted = !!whitelist[domain];
    if (!isWhitelisted) {
      showPopup({
        error: errorText,
        showLink: true,
        color: "yellow",
        domain,
        whitelist,
      });
    }
    console.info(`storing error info for domain age check: ${errorText}`);
    window._linkLanternAgeInfo = { error: errorText, domain: domain, color: "yellow" };
    // Store error info so icon-click can recreate this popup
    chrome.runtime.sendMessage({
      type: "updateExtensionIcon",
      color: isWhitelisted ? "green" : "yellow",
      blink: isWhitelisted ? false : true
    });
  } // end catch
}

// Do not run in subframes
if (window.top === window) {
  (async () => {
    const domain = location.hostname;

    // Ensure the togglePopup listener is registered only once
    if (!window._linkLanternListenersAdded) {
      chrome.runtime.onMessage.addListener((msg) => handleListeners(msg));
      window._linkLanternListenersAdded = true;
    }
    let msg = { type: "domainAgeCheck", domain };
    await handleDomainAgeCheck(msg);
  })();
}
