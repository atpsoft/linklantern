// Copyright 2025 ATPSoft, all rights reserved.
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getKnownRegistrableDomainDates() {
  const knownDates = new Map();
  knownDates.set("google.com", new Date("2004-04-20"));
  knownDates.set("facebook.com", new Date("2004-02-04"));
  knownDates.set("twitter.com", new Date("2006-03-21"));
  knownDates.set("instagram.com", new Date("2010-10-06"));
  knownDates.set("youtube.com", new Date("2005-02-15"));
  return knownDates;
}


async function queryRDAP(domain, registrableDomain) {
  const url = `https://rdap.org/domain/${registrableDomain}`;
  console.log(`fetching RDAP info for ${domain} (using ${registrableDomain}) from ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  const registrationEvent = data.events.find(event => event.eventAction === 'registration');
  if (!registrationEvent) {
    throw new Error('registration date not found');
  }
  const regDate = new Date(registrationEvent.eventDate);
  return regDate;
}

function cacheRegistrationDate(registrableDomain, regDate) {
  const cacheEntry = {
    date: regDate.toISOString(),
    cachedAt: Date.now()
  };
  try {
    localStorage.setItem(`registrationDate:${registrableDomain}`, JSON.stringify(cacheEntry));
  } catch (e) {
    console.warn(`error caching registration date for ${registrableDomain}:`, e);
  }
}

async function getDomainRegistrationDate(domain) {
  const registrableDomain = getRegistrableDomain(domain);
  const cached = getCachedRegistrationDate(registrableDomain);
  if (cached) {
    return cached;
  }

  try {
    const regDate = await queryRDAP(domain, registrableDomain);
    cacheRegistrationDate(registrableDomain, regDate);
    return regDate;
  } catch (error) {
    console.info(`error fetching RDAP info for ${registrableDomain}:`, error);
    throw error;
  }
}

function getCachedRegistrationDate(domain) {
  const raw = localStorage.getItem(`registrationDate:${domain}`);
  if (!raw) return null;

  let entry;
  try {
    entry = JSON.parse(raw);
  } catch {
    return new Date(raw);
  }

  if (!entry || !entry.date || !entry.cachedAt) {
    return null;
  }

  const age = Date.now() - entry.cachedAt;
  if (age > CACHE_MAX_AGE_MS) {
    try { localStorage.removeItem(`registrationDate:${domain}`); } catch {}
    return null;
  }

  return new Date(entry.date);
}


function calculateDomainAgeDays(registrationDate) {
  const now = new Date();
  const age_millis = now - registrationDate;
  return age_millis / (1000 * 60 * 60 * 24);
}

// Extract the registrable domain (effective TLD+1) from a full hostname.
function getRegistrableDomain(hostname) {
  // Strip trailing dot and force lower-case
  console.debug(`getRegistrableDomain: ${hostname}`);
  const clean = hostname.replace(/\.$/, "").toLowerCase();
  const parts = clean.split(".");

  if (parts.length <= 1) {
    return clean;
  }

  const suffixSet = getPublicSuffixList();

  // Iterate from longest possible suffix to shortest until we find a match
  for (let i = 1; i < parts.length; i++) {
    const suffix = parts.slice(-i).join(".");
    if (suffixSet.has(suffix)) {
      // Effective TLD found; ensure we have at least one label before it
      return parts.slice(-(i + 1)).join(".");
    }
  }
  let result = parts.slice(-2).join(".");
  // we didn't find it, so return the second-to-last part -- probably gets an rdap error
  console.debug(`getRegistrableDomain: unknown eTLD+1 for ${hostname}, using ${result}`);
  return result;
}
