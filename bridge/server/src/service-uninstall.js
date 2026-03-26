/**
 * Remove auto-start configuration.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

function uninstallWindows() {
  const vbsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'openclaw-bridge.vbs');
  if (fs.existsSync(vbsPath)) {
    fs.unlinkSync(vbsPath);
    console.log('[uninstall] Windows auto-start removed');
  } else {
    console.log('[uninstall] No Windows auto-start found');
  }
}

function uninstallMac() {
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.openclaw.bridge.plist');
  if (fs.existsSync(plistPath)) {
    fs.unlinkSync(plistPath);
    console.log('[uninstall] macOS LaunchAgent removed. Run: launchctl unload ' + plistPath);
  } else {
    console.log('[uninstall] No macOS LaunchAgent found');
  }
}

function uninstallLinux() {
  const servicePath = path.join(os.homedir(), '.config', 'systemd', 'user', 'openclaw-bridge.service');
  if (fs.existsSync(servicePath)) {
    fs.unlinkSync(servicePath);
    console.log('[uninstall] systemd service removed. Run: systemctl --user daemon-reload');
  } else {
    console.log('[uninstall] No systemd service found');
  }
}

const platform = os.platform();
if (platform === 'win32') uninstallWindows();
else if (platform === 'darwin') uninstallMac();
else uninstallLinux();
