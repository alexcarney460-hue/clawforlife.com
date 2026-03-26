#!/data/data/com.termux/files/usr/bin/bash
# answer-call.sh — Answer an incoming call and prepare audio

LOG_DIR="$HOME/voice-logs"
mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [answer] $1"
}

log "Answering incoming call..."

# Method 1: Telecom command (most reliable on Android 9+)
cmd telecom accept-ringing-call 2>/dev/null

# Method 2: Key event fallback
if [ $? -ne 0 ]; then
    log "Telecom command failed, trying keyevent..."
    input keyevent 5  # KEYCODE_CALL
fi

# Method 3: Intent fallback
# am start -a android.intent.action.ANSWER 2>/dev/null

# Set volume to max for speaker output
termux-volume music 15 2>/dev/null
termux-volume call 15 2>/dev/null
log "Volume set to max"

# Enable speakerphone
# Method: use media session or am broadcast
am broadcast -a android.intent.action.SPEAKERPHONE --ez state true 2>/dev/null
# Alternative: input tap on speakerphone button if available
# The conversation.js will use TTS which goes through the call audio channel

# Wait for call to fully connect
sleep 1

log "Call answered and audio ready"
