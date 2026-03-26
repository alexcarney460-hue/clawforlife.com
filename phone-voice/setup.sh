#!/data/data/com.termux/files/usr/bin/bash
# setup.sh — One-time setup for the voice answering system

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "  ClawForLife Voice AI - Setup"
echo "========================================="
echo ""

ERRORS=0

# 1. Create log directory
echo -n "[1/6] Creating voice-logs directory... "
mkdir -p "$HOME/voice-logs/transcripts"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 2. Copy config if not exists
echo -n "[2/6] Setting up voice-config.json... "
if [ ! -f "$HOME/voice-config.json" ]; then
    cp "$SCRIPT_DIR/voice-config.json" "$HOME/voice-config.json"
    echo -e "${GREEN}COPIED${NC} (edit ~/voice-config.json with your API key)"
else
    echo -e "${YELLOW}EXISTS${NC} (keeping existing config)"
fi

# 3. Check Termux API packages
echo -n "[3/6] Checking Termux:API... "
if command -v termux-tts-speak &> /dev/null; then
    echo -e "${GREEN}INSTALLED${NC}"
else
    echo -e "${RED}MISSING${NC} - run: pkg install termux-api"
    ERRORS=$((ERRORS + 1))
fi

# 4. Test TTS
echo -n "[4/6] Testing text-to-speech... "
termux-tts-speak "Voice system ready" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC} - ensure Termux:API app is installed from F-Droid"
    ERRORS=$((ERRORS + 1))
fi

# 5. Test STT
echo -n "[5/6] Testing speech-to-text... "
if command -v termux-speech-to-text &> /dev/null; then
    echo -e "${GREEN}AVAILABLE${NC} (full test requires microphone access)"
else
    echo -e "${RED}MISSING${NC} - ensure Termux:API is installed"
    ERRORS=$((ERRORS + 1))
fi

# 6. Register with Termux:Boot
echo -n "[6/6] Registering with Termux:Boot... "
BOOT_DIR="$HOME/.termux/boot"
mkdir -p "$BOOT_DIR"
cat > "$BOOT_DIR/start-voice-monitor" << 'BOOTEOF'
#!/data/data/com.termux/files/usr/bin/bash
# Auto-start voice monitor on device boot
termux-wake-lock
sleep 10  # Wait for system to settle
nohup bash ~/phone-voice/call-monitor.sh > /dev/null 2>&1 &
BOOTEOF
chmod +x "$BOOT_DIR/start-voice-monitor"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Node.js
echo ""
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VER=$(node -v)
    echo -e "${GREEN}${NODE_VER}${NC}"
else
    echo -e "${RED}MISSING${NC} - run: pkg install nodejs"
    ERRORS=$((ERRORS + 1))
fi

# Check for API key
echo -n "Checking Anthropic API key... "
if [ -f "$HOME/voice-config.json" ]; then
    KEY=$(node -e "const c=require('$HOME/voice-config.json'); console.log(c.anthropicApiKey||'')" 2>/dev/null)
    if [ -n "$KEY" ] && [ "$KEY" != "" ]; then
        echo -e "${GREEN}CONFIGURED${NC}"
    else
        echo -e "${YELLOW}NOT SET${NC} - edit ~/voice-config.json or set ANTHROPIC_API_KEY env var"
    fi
fi

echo ""
echo "========================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "  ${GREEN}Setup complete! No errors.${NC}"
    echo ""
    echo "  Next steps:"
    echo "  1. Edit ~/voice-config.json with your Anthropic API key"
    echo "  2. Run: bash $SCRIPT_DIR/install.sh"
else
    echo -e "  ${RED}Setup complete with $ERRORS error(s).${NC}"
    echo "  Fix the issues above and run setup again."
fi
echo "========================================="
