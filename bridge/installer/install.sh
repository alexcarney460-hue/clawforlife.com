#!/bin/bash
# ClawForLife Bridge Installer (macOS/Linux)
#
# Downloads Node.js if needed, installs dependencies, starts bridge.
# Designed to be run from the phone's setup page or manually.

set -e

BRIDGE_DIR="$(cd "$(dirname "$0")/.." && pwd)/server"
echo "==================================="
echo "  ClawForLife Bridge Installer"
echo "==================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[!] Node.js not found."
    echo "    Please install Node.js 18+ from https://nodejs.org"
    echo "    Then run this installer again."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "[!] Node.js $NODE_VERSION found, but 18+ is required."
    echo "    Please update: https://nodejs.org"
    exit 1
fi

echo "[ok] Node.js $(node -v) found"

# Install dependencies
echo "[..] Installing dependencies..."
cd "$BRIDGE_DIR"
npm install --production --no-audit --no-fund 2>&1 | tail -3
echo "[ok] Dependencies installed"

# Install auto-start
echo "[..] Setting up auto-start..."
node src/service-install.js

# Start bridge
echo ""
echo "[..] Starting bridge server..."
node src/index.js &
BRIDGE_PID=$!
echo "[ok] Bridge running (PID: $BRIDGE_PID)"

echo ""
echo "==================================="
echo "  Bridge is ready!"
echo "  Open: http://127.0.0.1:18800"
echo "==================================="
echo ""
echo "On the phone, run:"
echo "  adb reverse tcp:18800 tcp:18800"
echo "  cd bridge/client && node src/pair.js"

wait $BRIDGE_PID
