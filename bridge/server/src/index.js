/**
 * ClawForLife Bridge Server
 *
 * Lightweight tray-resident server that exposes business files
 * to an OpenClaw phone over USB tethering or localhost.
 *
 * Binds ONLY to 127.0.0.1 and USB tether interfaces.
 * All requests require a bearer token generated at setup time.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { loadConfig, saveConfig, getConfigPath } = require('./config');
const { createAuthMiddleware, generateToken } = require('./auth');
const { getBindAddresses } = require('./network');
const filesRouter = require('./routes/files');
const businessRouter = require('./routes/business');
const statusRouter = require('./routes/status');
const watchRouter = require('./routes/watch');
const setupRouter = require('./routes/setup');

const PORT = 18800;
const UI_DIR = path.join(__dirname, '..', '..', 'ui');

async function main() {
  const config = loadConfig();

  // First run — no token yet, enter setup mode
  if (!config.authToken) {
    config.authToken = generateToken();
    config.sharedFolders = [];
    config.writeEnabled = false;
    config.setupComplete = false;
    saveConfig(config);
    console.log('[bridge] First run detected. Starting in setup mode.');
    console.log(`[bridge] Auth token: ${config.authToken}`);
  }

  const app = express();

  // Parse JSON bodies up to 50MB (for file writes)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS — only allow localhost and USB tether origins
  app.use(cors({
    origin: (origin, cb) => {
      // Allow no-origin (curl, same-origin) and localhost variants
      if (!origin || origin.startsWith('http://127.0.0.1') || origin.startsWith('http://localhost') || origin.startsWith('http://192.168.')) {
        cb(null, true);
      } else {
        cb(new Error('CORS blocked: origin not allowed'));
      }
    }
  }));

  // Serve the setup/management UI (no auth required for UI assets)
  app.use('/ui', express.static(UI_DIR));

  // Setup routes do their own auth (initial setup has no token yet on phone side)
  app.use('/api/setup', setupRouter(config));

  // Auth middleware for all /api routes except setup
  app.use('/api', createAuthMiddleware(config));

  // API routes
  app.use('/api/files', filesRouter(config));
  app.use('/api/business', businessRouter(config));
  app.use('/api/status', statusRouter(config));
  app.use('/api/files/watch', watchRouter(config));

  // Root redirect to UI
  app.get('/', (req, res) => {
    res.redirect('/ui/index.html');
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error(`[bridge] Error: ${err.message}`);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  });

  // Determine which interfaces to bind to
  const bindAddresses = getBindAddresses();

  for (const addr of bindAddresses) {
    app.listen(PORT, addr, () => {
      console.log(`[bridge] Listening on ${addr}:${PORT}`);
    });
  }

  console.log(`[bridge] Setup UI: http://127.0.0.1:${PORT}/ui/index.html`);
  console.log(`[bridge] Config: ${getConfigPath()}`);

  // Try to open browser on first run
  if (!config.setupComplete) {
    try {
      const open = require('open');
      await open(`http://127.0.0.1:${PORT}/ui/index.html`);
    } catch {
      // Non-fatal — user can open manually
    }
  }
}

main().catch(err => {
  console.error('[bridge] Fatal:', err);
  process.exit(1);
});
