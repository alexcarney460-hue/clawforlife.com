#!/data/data/com.termux/files/usr/bin/bash
# install.sh — Full installer for ClawForLife Voice AI system

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="$HOME/phone-voice"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "========================================="
echo "  ClawForLife Voice AI - Installer"
echo "========================================="
echo ""

# 1. Install required packages
echo "[1/5] Installing dependencies..."
pkg install -y termux-api nodejs 2>/dev/null
echo ""

# 2. Copy scripts to home directory
echo "[2/5] Copying scripts to ~/phone-voice/..."
mkdir -p "$INSTALL_DIR"
cp "$SCRIPT_DIR/call-monitor.sh" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/answer-call.sh" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/conversation.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/post-call.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/prompts.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/voice-config.json" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/setup.sh" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/stop.sh" "$INSTALL_DIR/"
echo -e "${GREEN}Done${NC}"

# 3. Make everything executable
echo "[3/5] Setting permissions..."
chmod +x "$INSTALL_DIR"/*.sh
chmod +x "$INSTALL_DIR"/*.js
echo -e "${GREEN}Done${NC}"

# 4. Run setup
echo "[4/5] Running setup..."
echo ""
bash "$INSTALL_DIR/setup.sh"
echo ""

# 5. Start the call monitor
echo "[5/5] Starting voice monitor daemon..."

# Kill any existing monitor
if [ -f "$HOME/.voice-monitor.pid" ]; then
    OLD_PID=$(cat "$HOME/.voice-monitor.pid")
    kill "$OLD_PID" 2>/dev/null
    rm -f "$HOME/.voice-monitor.pid"
fi

# Acquire wake lock and start in background
termux-wake-lock 2>/dev/null
nohup bash "$INSTALL_DIR/call-monitor.sh" > /dev/null 2>&1 &
NEW_PID=$!
sleep 1

if kill -0 "$NEW_PID" 2>/dev/null; then
    echo -e "${GREEN}Voice answering ACTIVE (PID: $NEW_PID)${NC}"
    echo ""
    echo "========================================="
    echo "  Voice AI is now answering calls!"
    echo ""
    echo "  Monitor logs:  tail -f ~/voice-logs/monitor-$(date +%Y%m%d).log"
    echo "  Stop system:   bash ~/phone-voice/stop.sh"
    echo "  Config:        nano ~/voice-config.json"
    echo "========================================="
else
    echo -e "${RED}Failed to start monitor daemon${NC}"
    echo "Check logs: cat ~/voice-logs/monitor-$(date +%Y%m%d).log"
fi
