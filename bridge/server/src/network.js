/**
 * Network interface detection.
 *
 * The bridge ONLY binds to:
 * 1. 127.0.0.1 (loopback — always)
 * 2. USB tether interfaces (192.168.42.x on Android, 172.20.10.x on iOS)
 * 3. RNDIS/USB Ethernet interfaces
 *
 * It NEVER binds to 0.0.0.0 or public WiFi/Ethernet interfaces.
 */

const os = require('os');

// Known USB tether subnet patterns
const USB_TETHER_PATTERNS = [
  /^192\.168\.42\./,   // Android USB tethering
  /^192\.168\.44\./,   // Android USB tethering (alternate)
  /^172\.20\.10\./,    // iOS USB tethering
];

// Known USB tether interface name patterns
const USB_IFACE_PATTERNS = [
  /rndis/i,            // Windows RNDIS
  /usb/i,              // Generic USB
  /gadget/i,           // Linux USB gadget
  /android/i,          // Android network
  /iphone/i,           // iPhone USB
  /apple.*ethernet/i,  // Apple USB Ethernet
];

function getBindAddresses() {
  const addresses = ['127.0.0.1']; // Always bind loopback
  const interfaces = os.networkInterfaces();

  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;

      // Check if this looks like a USB tether interface
      const isUsbBySubnet = USB_TETHER_PATTERNS.some(p => p.test(addr.address));
      const isUsbByName = USB_IFACE_PATTERNS.some(p => p.test(name));

      if (isUsbBySubnet || isUsbByName) {
        addresses.push(addr.address);
        console.log(`[network] Detected USB tether interface: ${name} (${addr.address})`);
      }
    }
  }

  return [...new Set(addresses)];
}

function getUsbTetherIp() {
  const interfaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      const isUsb = USB_TETHER_PATTERNS.some(p => p.test(addr.address)) ||
                    USB_IFACE_PATTERNS.some(p => p.test(name));
      if (isUsb) return addr.address;
    }
  }
  return null;
}

module.exports = { getBindAddresses, getUsbTetherIp };
