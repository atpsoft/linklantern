#!/usr/bin/env node

/**
 * generate_manifest.js
 * Usage: node generate_manifest.js <chrome|firefox>
 *
 * Reads manifest-master.json and manifest-<browser>.json from the same directory
 * (or from the extension/ subdirectory if they live there) and performs a deep
 * merge where the browser-specific manifest overrides the master.  The merged
 * result is written to extension/manifest.json (creating the directory if needed).
 */

const fs = require("fs");
const path = require("path");

const SUPPORTED = ["chrome", "firefox"];
const browser = process.argv[2];

if (!browser || !SUPPORTED.includes(browser)) {
  console.error(`Usage: node ${path.basename(process.argv[1])} <${SUPPORTED.join("|")}>`);
  process.exit(1);
}

const masterPath = path.join(__dirname, "manifest-master.json");
const variantPath = path.join(__dirname, `manifest-${browser}.json`);
const outputPath = path.join(__dirname, "extension", "manifest.json");

function readJson(p) {
  console.log(`reading file: ${p}`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const deepMerge = (target, source) => {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      key in target &&
      typeof target[key] === "object"
    ) {
      target[key] = deepMerge({ ...target[key] }, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
};

const merged = deepMerge(readJson(masterPath), readJson(variantPath));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2));
console.log(`Manifest written to ${outputPath}`);
