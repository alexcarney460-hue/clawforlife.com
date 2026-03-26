/**
 * Health check and status endpoint.
 *
 * GET /api/status — returns bridge status, uptime, shared folder info
 */

const express = require('express');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { getUsbTetherIp } = require('../network');

const startTime = Date.now();

module.exports = function statusRouter(config) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const uptimeMs = Date.now() - startTime;
    const uptimeMinutes = Math.round(uptimeMs / 60000);

    const folderStats = config.sharedFolders.map(f => {
      try {
        const exists = fs.existsSync(f);
        return { path: f, name: path.basename(f), accessible: exists };
      } catch {
        return { path: f, name: path.basename(f), accessible: false };
      }
    });

    return res.json({
      success: true,
      data: {
        status: 'running',
        version: config.bridgeVersion || '1.0.0',
        uptime: `${uptimeMinutes} minutes`,
        uptimeMs,
        hostname: os.hostname(),
        platform: os.platform(),
        usbTetherIp: getUsbTetherIp(),
        sharedFolders: folderStats,
        writeEnabled: config.writeEnabled,
        setupComplete: config.setupComplete,
        lastConnected: config.lastConnected
      }
    });
  });

  return router;
};
