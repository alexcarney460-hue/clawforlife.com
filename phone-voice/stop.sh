#!/data/data/com.termux/files/usr/bin/bash
# stop.sh — Stop the voice answering system

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PID_FILE="$HOME/.voice-monitor.pid"

echo "Stopping ClawForLife Voice AI..."

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        sleep 1
        # Force kill if still running
        if kill -0 "$PID" 2>/dev/null; then
            kill -9 "$PID" 2>/dev/null
        fi
        rm -f "$PID_FILE"
        echo -e "${GREEN}Voice monitor stopped (was PID: $PID)${NC}"
    else
        rm -f "$PID_FILE"
        echo -e "${YELLOW}Monitor was not running (stale PID: $PID)${NC}"
    fi
else
    # Try to find and kill by process name
    PIDS=$(pgrep -f "call-monitor.sh" 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "$PIDS" | xargs kill 2>/dev/null
        echo -e "${GREEN}Killed monitor processes: $PIDS${NC}"
    else
        echo -e "${YELLOW}No voice monitor running${NC}"
    fi
fi

# Release wake lock
termux-wake-unlock 2>/dev/null
echo "Wake lock released"

# Kill any orphaned conversation processes
CONVO_PIDS=$(pgrep -f "conversation.js" 2>/dev/null)
if [ -n "$CONVO_PIDS" ]; then
    echo "$CONVO_PIDS" | xargs kill 2>/dev/null
    echo "Killed orphaned conversation processes"
fi

echo ""
echo "Voice AI system stopped."
echo "Restart with: bash ~/phone-voice/install.sh"
