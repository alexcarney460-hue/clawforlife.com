/**
 * Auto-start installation.
 *
 * On Windows: creates a shortcut in the Startup folder
 * On macOS: creates a LaunchAgent plist
 * On Linux: creates a systemd user service
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

const APP_NAME = 'OpenClaw Bridge';
const SCRIPT_PATH = path.resolve(__dirname, 'index.js');

function installWindows() {
  // Create a .vbs script in Startup folder to run node silently
  const startupDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  const vbsPath = path.join(startupDir, 'openclaw-bridge.vbs');

  const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "node ""${SCRIPT_PATH}""", 0, False
`;

  fs.writeFileSync(vbsPath, vbsContent, 'utf-8');
  console.log(`[install] Windows auto-start installed: ${vbsPath}`);
}

function installMac() {
  const plistDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
  if (!fs.existsSync(plistDir)) fs.mkdirSync(plistDir, { recursive: true });

  const plistPath = path.join(plistDir, 'com.openclaw.bridge.plist');
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.openclaw.bridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>${SCRIPT_PATH}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${path.join(os.homedir(), '.openclaw-bridge', 'bridge.log')}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(os.homedir(), '.openclaw-bridge', 'bridge-error.log')}</string>
</dict>
</plist>`;

  fs.writeFileSync(plistPath, plistContent, 'utf-8');
  console.log(`[install] macOS LaunchAgent installed: ${plistPath}`);
  console.log('[install] Run: launchctl load ' + plistPath);
}

function installLinux() {
  const serviceDir = path.join(os.homedir(), '.config', 'systemd', 'user');
  if (!fs.existsSync(serviceDir)) fs.mkdirSync(serviceDir, { recursive: true });

  const servicePath = path.join(serviceDir, 'openclaw-bridge.service');
  const serviceContent = `[Unit]
Description=OpenClaw Bridge Server
After=network.target

[Service]
ExecStart=/usr/bin/node ${SCRIPT_PATH}
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
`;

  fs.writeFileSync(servicePath, serviceContent, 'utf-8');
  console.log(`[install] systemd user service installed: ${servicePath}`);
  console.log('[install] Run: systemctl --user enable --now openclaw-bridge');
}

const platform = os.platform();
if (platform === 'win32') installWindows();
else if (platform === 'darwin') installMac();
else installLinux();

console.log(`[install] ${APP_NAME} auto-start configured for ${platform}.`);
