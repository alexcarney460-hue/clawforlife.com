#!/usr/bin/env node
/**
 * Sync script — pulls business data from PC bridge to phone local storage.
 *
 * Usage:
 *   node sync.js                    # Sync all categories
 *   node sync.js --only contacts    # Sync only contacts
 *   node sync.js --watch            # Continuous sync on file changes
 *
 * Requires pairing first (run pair.js).
 */

const { create, loadSavedConfig, SYNC_DIR } = require('./index');
const path = require('path');

async function main() {
  const config = loadSavedConfig();
  if (!config) {
    console.error('[sync] Not paired yet. Run: node pair.js');
    process.exit(1);
  }

  const client = create(config);

  // Check connection
  const connected = await client.isConnected();
  if (!connected) {
    console.error(`[sync] Cannot reach bridge at ${config.host}:${config.port}`);
    console.error('[sync] Make sure the bridge is running and USB/ADB is connected.');
    process.exit(1);
  }

  const status = await client.getStatus();
  console.log(`[sync] Connected to ${status.hostname} (${status.platform})`);
  console.log(`[sync] Bridge uptime: ${status.uptime}`);
  console.log(`[sync] Shared folders: ${status.sharedFolders.length}`);

  const args = process.argv.slice(2);
  const watchMode = args.includes('--watch');
  const onlyIdx = args.indexOf('--only');
  const categories = onlyIdx >= 0
    ? [args[onlyIdx + 1]]
    : ['contacts', 'invoices', 'calendar', 'summary'];

  // Initial sync
  console.log(`[sync] Syncing: ${categories.join(', ')}...`);
  const results = await client.syncToLocal(categories);

  for (const [cat, result] of Object.entries(results)) {
    if (result.synced) {
      console.log(`  [ok] ${cat} -> ${result.path}`);
    } else {
      console.log(`  [fail] ${cat}: ${result.error}`);
    }
  }

  console.log(`[sync] Data saved to: ${SYNC_DIR}`);

  // Watch mode
  if (watchMode) {
    console.log('[sync] Watching for file changes on PC...');
    const watcher = client.watchFiles((event) => {
      console.log(`[watch] ${event.event}: ${event.name} (${event.timestamp})`);

      // Re-sync business data on spreadsheet/PDF changes
      const businessExts = ['.csv', '.xlsx', '.xls', '.pdf', '.ics'];
      if (businessExts.includes(event.extension)) {
        console.log('[sync] Business file changed, re-syncing...');
        client.syncToLocal(categories).then(() => {
          console.log('[sync] Re-sync complete');
        }).catch(err => {
          console.error(`[sync] Re-sync failed: ${err.message}`);
        });
      }
    });

    // Keep alive
    process.on('SIGINT', () => {
      console.log('\n[sync] Stopping watcher...');
      watcher.destroy();
      process.exit(0);
    });
  }
}

main().catch(err => {
  console.error(`[sync] Fatal: ${err.message}`);
  process.exit(1);
});
