const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const DEFAULTS = {
  kiosk: true,
  autoLaunch: false,
  voiceBackendUrl: "http://127.0.0.1:8010",
};

function getSettingsPath() {
  return path.join(app.getPath("userData"), "axon-settings.json");
}

function readSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), "utf8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

function createSettingsStore() {
  let cache = readSettings();

  return {
    get(key) {
      return cache[key];
    },
    set(key, value) {
      cache = { ...cache, [key]: value };
      writeSettings(cache);
    },
  };
}

module.exports = { createSettingsStore };
