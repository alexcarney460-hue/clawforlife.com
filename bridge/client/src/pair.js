#!/usr/bin/env node
/**
 * Pairing script — run on the phone after connecting USB.
 *
 * Usage:
 *   node pair.js                         # Uses default localhost:18800
 *   node pair.js --host 192.168.42.129   # Use specific IP
 *
 * This script:
 * 1. Connects to the bridge
 * 2. Requests pairing token
 * 3. Saves connection config locally
 */

const http = require('http');
const { saveConnectionConfig } = require('./index');

const args = process.argv.slice(2);
const hostArg = args.find((a, i) => args[i - 1] === '--host') || '127.0.0.1';
const portArg = parseInt(args.find((a, i) => args[i - 1] === '--port') || '18800', 10);

function request(host, port, method, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: host, port, path: urlPath, method, timeout: 10000 }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()));
        } catch (e) {
          reject(new Error('Invalid response'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function main() {
  console.log(`[pair] Connecting to bridge at ${hostArg}:${portArg}...`);

  // Step 1: Check bridge is running
  try {
    const status = await request(hostArg, portArg, 'GET', '/api/setup/status');
    if (!status.success) throw new Error('Bridge not responding');
    console.log(`[pair] Bridge found! Version: ${status.data.version}`);
  } catch (err) {
    console.error(`[pair] Cannot reach bridge at ${hostArg}:${portArg}`);
    console.error('[pair] Make sure:');
    console.error('  1. The bridge is running on the PC');
    console.error('  2. USB is connected and ADB reverse is set up:');
    console.error(`     adb reverse tcp:${portArg} tcp:${portArg}`);
    process.exit(1);
  }

  // Step 2: Request pairing
  try {
    const pair = await request(hostArg, portArg, 'POST', '/api/setup/pair');
    if (!pair.success) {
      console.error(`[pair] Pairing failed: ${pair.error}`);
      process.exit(1);
    }

    const config = {
      host: hostArg,
      port: portArg,
      token: pair.data.authToken,
      pcHostname: pair.data.hostname,
      pcPlatform: pair.data.platform,
      pairedAt: new Date().toISOString()
    };

    saveConnectionConfig(config);
    console.log(`[pair] Paired with ${pair.data.hostname} (${pair.data.platform})`);
    console.log(`[pair] Auth token saved. Run 'node sync.js' to pull business data.`);
  } catch (err) {
    console.error(`[pair] Pairing error: ${err.message}`);
    process.exit(1);
  }
}

main();
