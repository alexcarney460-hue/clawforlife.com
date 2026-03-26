/**
 * File access API routes.
 *
 * GET  /api/files?path=/          — List directory contents
 * GET  /api/files/read?path=...   — Read file content
 * POST /api/files/write           — Write/create a file
 * GET  /api/files/search?q=...    — Search files by name/content
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

function isPathAllowed(filePath, sharedFolders) {
  const resolved = path.resolve(filePath);
  return sharedFolders.some(folder => {
    const resolvedFolder = path.resolve(folder);
    return resolved.startsWith(resolvedFolder);
  });
}

function normalizePath(requestedPath, sharedFolders) {
  // If path starts with /, treat first segment as folder index or match by name
  if (!requestedPath || requestedPath === '/') {
    return null; // Return root listing of shared folders
  }
  return path.resolve(requestedPath);
}

module.exports = function filesRouter(config) {
  const router = express.Router();

  // GET /api/files?path=/ — list directory
  router.get('/', (req, res) => {
    const requestedPath = req.query.path || '/';

    // Root: list shared folders
    if (requestedPath === '/') {
      const folders = config.sharedFolders.map((f, i) => ({
        name: path.basename(f),
        path: f,
        type: 'directory',
        index: i
      }));
      return res.json({ success: true, data: folders });
    }

    const targetPath = path.resolve(requestedPath);
    if (!isPathAllowed(targetPath, config.sharedFolders)) {
      return res.status(403).json({
        success: false,
        error: 'Path is not within any shared folder'
      });
    }

    try {
      if (!fs.existsSync(targetPath)) {
        return res.status(404).json({ success: false, error: 'Path not found' });
      }

      const stat = fs.statSync(targetPath);
      if (!stat.isDirectory()) {
        return res.status(400).json({ success: false, error: 'Path is not a directory' });
      }

      const entries = fs.readdirSync(targetPath, { withFileTypes: true });
      const items = entries.map(entry => {
        const fullPath = path.join(targetPath, entry.name);
        let size = 0;
        let modified = null;
        try {
          const s = fs.statSync(fullPath);
          size = s.size;
          modified = s.mtime.toISOString();
        } catch { /* skip */ }

        return {
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'directory' : 'file',
          size,
          modified,
          extension: entry.isFile() ? path.extname(entry.name).toLowerCase() : null
        };
      });

      // Sort: directories first, then alphabetical
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return res.json({
        success: true,
        data: items,
        meta: { path: targetPath, count: items.length }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/files/read?path=... — read file
  router.get('/read', (req, res) => {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'path parameter required' });
    }

    const resolved = path.resolve(filePath);
    if (!isPathAllowed(resolved, config.sharedFolders)) {
      return res.status(403).json({ success: false, error: 'Path not in shared folders' });
    }

    try {
      if (!fs.existsSync(resolved)) {
        return res.status(404).json({ success: false, error: 'File not found' });
      }

      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        return res.status(400).json({ success: false, error: 'Path is a directory, use list endpoint' });
      }

      // For binary files > 10MB, refuse
      if (stat.size > 10 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: 'File too large (>10MB). Use streaming instead.' });
      }

      const ext = path.extname(resolved).toLowerCase();
      const textExtensions = ['.txt', '.csv', '.json', '.xml', '.html', '.md', '.log', '.ini', '.cfg', '.yaml', '.yml', '.toml', '.env', '.js', '.ts', '.py'];

      if (textExtensions.includes(ext)) {
        const content = fs.readFileSync(resolved, 'utf-8');
        return res.json({
          success: true,
          data: {
            path: resolved,
            name: path.basename(resolved),
            size: stat.size,
            modified: stat.mtime.toISOString(),
            encoding: 'utf-8',
            content
          }
        });
      }

      // Binary file — return base64
      const content = fs.readFileSync(resolved).toString('base64');
      return res.json({
        success: true,
        data: {
          path: resolved,
          name: path.basename(resolved),
          size: stat.size,
          modified: stat.mtime.toISOString(),
          encoding: 'base64',
          content
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/files/write — write file
  router.post('/write', (req, res) => {
    if (!config.writeEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Write access is disabled. Enable it in bridge settings.'
      });
    }

    const { filePath, content, encoding } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ success: false, error: 'filePath and content required' });
    }

    const resolved = path.resolve(filePath);
    if (!isPathAllowed(resolved, config.sharedFolders)) {
      return res.status(403).json({ success: false, error: 'Path not in shared folders' });
    }

    try {
      // Ensure parent directory exists
      const dir = path.dirname(resolved);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (encoding === 'base64') {
        fs.writeFileSync(resolved, Buffer.from(content, 'base64'));
      } else {
        fs.writeFileSync(resolved, content, 'utf-8');
      }

      const stat = fs.statSync(resolved);
      return res.json({
        success: true,
        data: {
          path: resolved,
          size: stat.size,
          modified: stat.mtime.toISOString()
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/files/search?q=invoice&type=pdf&path=/
  router.get('/search', (req, res) => {
    const { q, type, path: searchRoot } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'q (query) parameter required' });
    }

    const results = [];
    const maxResults = 100;
    const query = q.toLowerCase();
    const typeFilter = type ? `.${type.toLowerCase().replace('.', '')}` : null;

    function searchDir(dirPath, depth) {
      if (depth > 5 || results.length >= maxResults) return;

      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxResults) break;
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            // Skip node_modules, .git, etc.
            if (['node_modules', '.git', '__pycache__', '.cache'].includes(entry.name)) continue;
            searchDir(fullPath, depth + 1);
          } else {
            const nameMatch = entry.name.toLowerCase().includes(query);
            const ext = path.extname(entry.name).toLowerCase();
            const typeMatch = !typeFilter || ext === typeFilter;

            if (nameMatch && typeMatch) {
              try {
                const stat = fs.statSync(fullPath);
                results.push({
                  name: entry.name,
                  path: fullPath,
                  size: stat.size,
                  modified: stat.mtime.toISOString(),
                  extension: ext
                });
              } catch { /* skip inaccessible */ }
            }
          }
        }
      } catch { /* skip inaccessible directories */ }
    }

    // Search in specified path or all shared folders
    const searchPaths = searchRoot && isPathAllowed(path.resolve(searchRoot), config.sharedFolders)
      ? [path.resolve(searchRoot)]
      : config.sharedFolders;

    for (const folder of searchPaths) {
      if (results.length >= maxResults) break;
      searchDir(folder, 0);
    }

    return res.json({
      success: true,
      data: results,
      meta: { query: q, type: type || 'any', count: results.length, maxResults }
    });
  });

  return router;
};
