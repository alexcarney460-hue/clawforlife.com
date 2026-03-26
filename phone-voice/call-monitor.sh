#!/data/data/com.termux/files/usr/bin/bash
# call-monitor.sh — Daemon that watches for incoming calls and triggers AI answering
# Runs in background via nohup, polls telephony state every 2 seconds

LOG_DIR="$HOME/voice-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/monitor-$(date +%Y%m%d).log"
PID_FILE="$HOME/.voice-monitor.pid"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Write PID for stop.sh
echo $$ > "$PID_FILE"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "=== Call monitor started (PID: $$) ==="

# Acquire wake lock to prevent Termux from sleeping
termux-wake-lock 2>/dev/null
log "Wake lock acquired"

# State tracking
PREV_STATE=0
CURRENT_CALLER=""
CONVERSATION_PID=""
CALL_START_TIME=""

get_call_state() {
    # mCallState: 0=idle, 1=ringing, 2=in-call
    local state
    state=$(dumpsys telephony.registry 2>/dev/null | grep -m1 "mCallState" | grep -oP '\d+' | head -1)
    echo "${state:-0}"
}

get_caller_number() {
    # Extract incoming number from telephony state
    local number
    number=$(dumpsys telephony.registry 2>/dev/null | grep -m1 "mCallIncomingNumber" | grep -oP '[\d+]+' | head -1)
    if [ -z "$number" ]; then
        # Fallback: try call log
        number=$(content query --uri content://call_log/calls --projection number --sort "date DESC" --limit 1 2>/dev/null | grep -oP '[\d+]+' | head -1)
    fi
    echo "${number:-unknown}"
}

cleanup() {
    log "=== Call monitor stopping ==="
    termux-wake-unlock 2>/dev/null
    rm -f "$PID_FILE"
    # Kill any active conversation
    if [ -n "$CONVERSATION_PID" ] && kill -0 "$CONVERSATION_PID" 2>/dev/null; then
        kill "$CONVERSATION_PID" 2>/dev/null
    fi
    exit 0
}

trap cleanup SIGTERM SIGINT SIGHUP

while true; do
    STATE=$(get_call_state)

    # State transition: idle -> ringing
    if [ "$STATE" = "1" ] && [ "$PREV_STATE" = "0" ]; then
        CURRENT_CALLER=$(get_caller_number)
        log "RINGING from: $CURRENT_CALLER"

        # Small delay to let the ring register
        sleep 1

        # Answer the call
        bash "$SCRIPT_DIR/answer-call.sh" >> "$LOG_FILE" 2>&1
        log "Answer script executed for $CURRENT_CALLER"
    fi

    # State transition: ringing/idle -> in-call
    if [ "$STATE" = "2" ] && [ "$PREV_STATE" != "2" ]; then
        CALL_START_TIME=$(date +%s)
        log "CALL CONNECTED with: $CURRENT_CALLER"

        # Launch conversation handler in background
        node "$SCRIPT_DIR/conversation.js" "$CURRENT_CALLER" >> "$LOG_DIR/conversation-$(date +%Y%m%d-%H%M%S).log" 2>&1 &
        CONVERSATION_PID=$!
        log "Conversation started (PID: $CONVERSATION_PID)"
    fi

    # State transition: in-call -> idle (call ended)
    if [ "$STATE" = "0" ] && [ "$PREV_STATE" = "2" ]; then
        CALL_END_TIME=$(date +%s)
        DURATION=$((CALL_END_TIME - CALL_START_TIME))
        log "CALL ENDED with $CURRENT_CALLER (duration: ${DURATION}s)"

        # Kill conversation if still running
        if [ -n "$CONVERSATION_PID" ] && kill -0 "$CONVERSATION_PID" 2>/dev/null; then
            kill "$CONVERSATION_PID" 2>/dev/null
            wait "$CONVERSATION_PID" 2>/dev/null
        fi

        # Run post-call processing in background
        node "$SCRIPT_DIR/post-call.js" "$CURRENT_CALLER" "$DURATION" >> "$LOG_DIR/postcall-$(date +%Y%m%d-%H%M%S).log" 2>&1 &
        log "Post-call processing started for $CURRENT_CALLER"

        # Reset state
        CURRENT_CALLER=""
        CONVERSATION_PID=""
        CALL_START_TIME=""
    fi

    # State transition: ringing -> idle (missed/rejected)
    if [ "$STATE" = "0" ] && [ "$PREV_STATE" = "1" ]; then
        log "MISSED CALL from: $CURRENT_CALLER"
        CURRENT_CALLER=""
    fi

    PREV_STATE="$STATE"
    sleep 2
done
