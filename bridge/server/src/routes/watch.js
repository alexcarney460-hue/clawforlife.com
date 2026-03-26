/**
 * File watcher via Server-Sent Events (SSE).
 *
 * GET /api/files/watch — opens an SSE stream that emits events
 * whenever files change in any shared folder.
 *
 * Events: add, change, unlink (delete)
 */

const express = require('express');
const chokidar = require('chokidar');
const path = require('path');

module.exports = function watchRouter(config) {
  const router = express.Router();

  // Maintain a single watcher instance
  let watcher = null;
  const clients = new Set();

  function ensureWatcher() {
    if (watcher || config.sharedFolders.length === 0) return;

    watcher = chokidar.watch(config.sharedFolders, {
      ignored: [
        /(^|[/\\])\../,        // dotfiles
        /node_modules/,
        /__pycache__/
      ],
      persistent: true,
      depth: 5,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });

    const broadcast = (eventType, filePath) => {
      const data = JSON.stringify({
        event: eventType,
        path: filePath,
        name: path.basename(filePath),
        extension: path.extname(filePath).toLowerCase(),
        timestamp: new Date().toISOString()
      });
      for (const client of clients) {
        client.write(`data: ${data}\n\n`);
      }
    };

    watcher.on('add', (p) => broadcast('add', p));
    watcher.on('change', (p) => broadcast('change', p));
    watcher.on('unlink', (p) => broadcast('unlink', p));

    console.log(`[watch] Watching ${config.sharedFolders.length} folder(s)`);
  }

  // GET /api/files/watch — SSE endpoint
  router.get('/', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    res.write(`data: ${JSON.stringify({ event: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    clients.add(res);
    ensureWatcher();

    req.on('close', () => {
      clients.delete(res);
      if (clients.size === 0 && watcher) {
        watcher.close();
        watcher = null;
        console.log('[watch] No clients, watcher closed');
      }
    });
  });

  return router;
};
