#!/bin/bash
# Set up ADB reverse port forwarding so the phone can reach the bridge
# Run this on the PC after connecting the phone via USB.

PORT=${1:-18800}

echo "[bridge] Setting up ADB reverse port forwarding..."

# Check ADB
if ! command -v adb &> /dev/null; then
    echo "[!] ADB not found. Install Android Platform Tools."
    echo "    https://developer.android.com/tools/releases/platform-tools"
    exit 1
fi

# Check device connected
DEVICES=$(adb devices | grep -c "device$")
if [ "$DEVICES" -eq 0 ]; then
    echo "[!] No Android device connected."
    echo "    1. Enable USB Debugging on the phone"
    echo "    2. Connect via USB cable"
    echo "    3. Accept the debugging prompt on the phone"
    exit 1
fi

# Set up reverse port forwarding
adb reverse tcp:$PORT tcp:$PORT
echo "[ok] Port $PORT forwarded. Phone can now reach bridge at 127.0.0.1:$PORT"
echo ""
echo "On the phone (Termux), run:"
echo "  cd ~/bridge/client && node src/pair.js"
