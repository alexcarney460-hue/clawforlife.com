/**
 * ClawForLife Bridge Client
 *
 * Phone-side library that connects to the PC bridge server.
 * Runs in Termux on the OpenClaw phone.
 *
 * Usage:
 *   const bridge = require('./index');
 *   const client = bridge.create({ host: '127.0.0.1', port: 18800, token: '...' });
 *   const contacts = await client.getContacts();
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 18800;
const SYNC_DIR = path.join(process.env.HOME || '/data/data/com.termux/files/home', '.openclaw-bridge-sync');

class BridgeClient {
  constructor({ host, port, token }) {
    this.host = host || DEFAULT_HOST;
    this.port = port || DEFAULT_PORT;
    this.token = token;
  }

  /**
   * Make an HTTP request to the bridge server.
   */
  request(method, urlPath, body) {
    return new Promise((resolve, reject) => {
      const bodyStr = body ? JSON.stringify(body) : null;
      const options = {
        hostname: this.host,
        port: this.port,
        path: urlPath,
        method,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
        },
        timeout: 30000
      };

      const req = http.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          try {
            const parsed = JSON.parse(raw);
            if (parsed.success) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
            }
          } catch {
            reject(new Error(`Invalid JSON response: ${raw.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }

  // --- Status ---

  async getStatus() {
    const res = await this.request('GET', '/api/status');
    return res.data;
  }

  async isConnected() {
    try {
      await this.getStatus();
      return true;
    } catch {
      return false;
    }
  }

  // --- File Operations ---

  async listFiles(dirPath = '/') {
    const res = await this.request('GET', `/api/files?path=${encodeURIComponent(dirPath)}`);
    return res.data;
  }

  async readFile(filePath) {
    const res = await this.request('GET', `/api/files/read?path=${encodeURIComponent(filePath)}`);
    return res.data;
  }

  async writeFile(filePath, content, encoding = 'utf-8') {
    const res = await this.request('POST', '/api/files/write', { filePath, content, encoding });
    return res.data;
  }

  async searchFiles(query, type = null) {
    let url = `/api/files/search?q=${encodeURIComponent(query)}`;
    if (type) url += `&type=${encodeURIComponent(type)}`;
    const res = await this.request('GET', url);
    return res.data;
  }

  // --- Business Data ---

  async getContacts() {
    const res = await this.request('GET', '/api/business/contacts');
    return res.data;
  }

  async getInvoices() {
    const res = await this.request('GET', '/api/business/invoices');
    return res.data;
  }

  async getCalendar() {
    const res = await this.request('GET', '/api/business/calendar');
    return res.data;
  }

  async getBusinessSummary() {
    const res = await this.request('GET', '/api/business/summary');
    return res.data;
  }

  // --- File Watch (SSE) ---

  watchFiles(callback) {
    const options = {
      hostname: this.host,
      port: this.port,
      path: '/api/files/watch',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'text/event-stream'
      }
    };

    const req = http.request(options, (res) => {
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              callback(event);
            } catch { /* skip malformed */ }
          }
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[bridge-client] Watch error: ${err.message}`);
    });

    req.end();
    return req; // Return so caller can abort with req.destroy()
  }

  // --- Sync ---

  async syncToLocal(categories = ['contacts', 'invoices', 'summary']) {
    if (!fs.existsSync(SYNC_DIR)) {
      fs.mkdirSync(SYNC_DIR, { recursive: true });
    }

    const results = {};

    for (const category of categories) {
      try {
        let data;
        if (category === 'contacts') data = await this.getContacts();
        else if (category === 'invoices') data = await this.getInvoices();
        else if (category === 'calendar') data = await this.getCalendar();
        else if (category === 'summary') data = await this.getBusinessSummary();
        else continue;

        const filePath = path.join(SYNC_DIR, `${category}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        results[category] = { synced: true, path: filePath };
      } catch (err) {
        results[category] = { synced: false, error: err.message };
      }
    }

    // Write sync metadata
    const metaPath = path.join(SYNC_DIR, 'sync-meta.json');
    fs.writeFileSync(metaPath, JSON.stringify({
      lastSync: new Date().toISOString(),
      host: this.host,
      port: this.port,
      results
    }, null, 2), 'utf-8');

    return results;
  }
}

function create(opts) {
  return new BridgeClient(opts);
}

// Load saved config if running standalone
function loadSavedConfig() {
  const configPath = path.join(SYNC_DIR, 'connection.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return null;
}

function saveConnectionConfig(config) {
  if (!fs.existsSync(SYNC_DIR)) {
    fs.mkdirSync(SYNC_DIR, { recursive: true });
  }
  fs.writeFileSync(
    path.join(SYNC_DIR, 'connection.json'),
    JSON.stringify(config, null, 2),
    'utf-8'
  );
}

module.exports = { create, BridgeClient, loadSavedConfig, saveConnectionConfig, SYNC_DIR };
