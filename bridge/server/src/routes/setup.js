/**
 * Setup routes — used during initial pairing and configuration.
 *
 * These routes have their own auth logic:
 * - GET  /api/setup/status  — no auth (phone checks if bridge is running)
 * - POST /api/setup/pair    — no auth (returns token to phone for first-time pairing)
 * - POST /api/setup/folders — requires token (add/remove shared folders)
 * - POST /api/setup/write-access — requires token (toggle write permission)
 * - POST /api/setup/complete — requires token (mark setup done)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { saveConfig } = require('../config');

module.exports = function setupRouter(config) {
  const router = express.Router();

  // GET /api/setup/status — is the bridge running? (no auth)
  router.get('/status', (req, res) => {
    return res.json({
      success: true,
      data: {
        bridgeRunning: true,
        setupComplete: config.setupComplete,
        version: config.bridgeVersion || '1.0.0',
        hasFolders: config.sharedFolders.length > 0
      }
    });
  });

  // POST /api/setup/pair — first-time pairing (no auth, returns token)
  // This is only available when setup is not yet complete.
  router.post('/pair', (req, res) => {
    if (config.setupComplete) {
      return res.status(403).json({
        success: false,
        error: 'Bridge is already paired. Reset config to re-pair.'
      });
    }

    return res.json({
      success: true,
      data: {
        authToken: config.authToken,
        hostname: require('os').hostname(),
        platform: require('os').platform()
      }
    });
  });

  // Middleware: require auth for remaining setup routes
  const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== config.authToken) {
      return res.status(403).json({ success: false, error: 'Invalid auth token' });
    }
    next();
  };

  // POST /api/setup/folders — set shared folders
  router.post('/folders', requireAuth, (req, res) => {
    const { folders } = req.body;
    if (!Array.isArray(folders)) {
      return res.status(400).json({ success: false, error: 'folders must be an array of paths' });
    }

    // Validate each folder exists
    const validFolders = [];
    const errors = [];
    for (const folder of folders) {
      const resolved = path.resolve(folder);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        validFolders.push(resolved);
      } else {
        errors.push(`${folder} does not exist or is not a directory`);
      }
    }

    config.sharedFolders = validFolders;
    saveConfig(config);

    return res.json({
      success: true,
      data: {
        sharedFolders: validFolders,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  });

  // POST /api/setup/write-access — toggle write permission
  router.post('/write-access', requireAuth, (req, res) => {
    const { enabled } = req.body;
    config.writeEnabled = Boolean(enabled);
    saveConfig(config);
    return res.json({
      success: true,
      data: { writeEnabled: config.writeEnabled }
    });
  });

  // POST /api/setup/complete — mark setup as done
  router.post('/complete', requireAuth, (req, res) => {
    config.setupComplete = true;
    saveConfig(config);
    return res.json({
      success: true,
      data: { message: 'Setup complete. Bridge is ready.' }
    });
  });

  // POST /api/setup/reset — reset to factory (requires auth)
  router.post('/reset', requireAuth, (req, res) => {
    const { generateToken } = require('../auth');
    config.authToken = generateToken();
    config.sharedFolders = [];
    config.writeEnabled = false;
    config.setupComplete = false;
    saveConfig(config);
    return res.json({
      success: true,
      data: {
        message: 'Bridge reset. New pairing required.',
        newToken: config.authToken
      }
    });
  });

  return router;
};
