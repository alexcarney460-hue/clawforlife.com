/**
 * Configuration management.
 *
 * Config is stored as a JSON file in the user's home directory.
 * It tracks: auth token, shared folders, write permissions, setup state.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.openclaw-bridge');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
  authToken: null,
  sharedFolders: [],
  writeEnabled: false,
  setupComplete: false,
  bridgeVersion: '1.0.0',
  createdAt: null,
  lastConnected: null
};

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadConfig() {
  ensureConfigDir();
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      console.warn('[config] Corrupt config file, using defaults');
      return { ...DEFAULT_CONFIG };
    }
  }
  return { ...DEFAULT_CONFIG, createdAt: new Date().toISOString() };
}

function saveConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function getConfigPath() {
  return CONFIG_PATH;
}

module.exports = { loadConfig, saveConfig, getConfigPath, CONFIG_DIR };
