#!/data/data/com.termux/files/usr/bin/node
// conversation.js — AI conversation engine for phone calls
// Runs after a call is answered, handles speech-to-text -> Claude -> TTS loop

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const CALLER_NUMBER = process.argv[2] || 'unknown';
const LOG_DIR = path.join(process.env.HOME, 'voice-logs');
const CONFIG_PATH = path.join(process.env.HOME, 'voice-config.json');
const TRANSCRIPT_DIR = path.join(LOG_DIR, 'transcripts');

// Ensure directories exist
[LOG_DIR, TRANSCRIPT_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const timestamp = () => new Date().toISOString();
const log = (msg) => console.log(`[${timestamp()}] [convo] ${msg}`);

// Load business config
let config;
try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
} catch (e) {
    log(`WARNING: Could not load voice-config.json, using defaults`);
    config = {
        businessName: 'ClawForLife',
        industry: 'general',
        greeting: "Hello! Thank you for calling ClawForLife. How can I help you today?",
        services: ['AI automation', 'business solutions'],
        hours: 'Monday through Friday, 9 AM to 6 PM',
        faq: [],
        transferNumber: '',
        ownerTelegramId: '6315250293',
        anthropicApiKey: process.env.ANTHROPIC_API_KEY || ''
    };
}

const ANTHROPIC_API_KEY = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '';

// Conversation state
const conversationHistory = [];
const transcript = [];
let callActive = true;

// ============================================================
// Termux command wrappers
// ============================================================

function speak(text) {
    log(`SPEAK: ${text}`);
    try {
        // Escape single quotes for shell
        const escaped = text.replace(/'/g, "'\\''");
        execSync(`termux-tts-speak '${escaped}'`, { timeout: 30000 });
    } catch (e) {
        log(`TTS error: ${e.message}`);
    }
}

function listen(timeoutSeconds = 8) {
    log('LISTEN: waiting for speech...');
    try {
        const result = execSync(`termux-speech-to-text`, {
            timeout: (timeoutSeconds + 5) * 1000
        });
        const parsed = JSON.parse(result.toString().trim());
        // termux-speech-to-text returns something like { "text": "..." } or just the text
        const text = typeof parsed === 'string' ? parsed : (parsed.text || parsed.result || '');
        log(`HEARD: "${text}"`);
        return text.trim();
    } catch (e) {
        log(`STT error or timeout: ${e.message}`);
        return '';
    }
}

function isCallActive() {
    try {
        const state = execSync(
            `dumpsys telephony.registry 2>/dev/null | grep -m1 mCallState | grep -oP '\\d+' | head -1`,
            { timeout: 5000 }
        ).toString().trim();
        return state === '2'; // 2 = in-call
    } catch (e) {
        return false;
    }
}

function hangUp() {
    log('Hanging up call');
    try {
        execSync('cmd telecom end-call 2>/dev/null || input keyevent 6', { timeout: 5000 });
    } catch (e) {
        log(`Hangup error: ${e.message}`);
    }
    callActive = false;
}

// ============================================================
// Anthropic Claude API
// ============================================================

async function chatWithClaude(userMessage, callerContext) {
    const { generateSystemPrompt } = require('./prompts.js');
    const systemPrompt = generateSystemPrompt(config, callerContext);

    conversationHistory.push({ role: 'user', content: userMessage });

    const body = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: systemPrompt,
        messages: conversationHistory
    };

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const assistantText = data.content[0]?.text || "I'm sorry, could you repeat that?";

        // Parse action tags from response
        const action = parseAction(assistantText);
        const cleanText = assistantText
            .replace(/\[ACTION:.*?\]/gi, '')
            .replace(/\(ACTION:.*?\)/gi, '')
            .trim();

        conversationHistory.push({ role: 'assistant', content: cleanText });

        return { text: cleanText, action };
    } catch (e) {
        log(`Claude API error: ${e.message}`);
        const fallback = "I'm sorry, I'm having a brief technical issue. Could you hold for just a moment?";
        conversationHistory.push({ role: 'assistant', content: fallback });
        return { text: fallback, action: null };
    }
}

function parseAction(text) {
    // Look for action markers like [ACTION:BOOK], [ACTION:TRANSFER], etc.
    const match = text.match(/\[ACTION:(BOOK|TRANSFER|END|MESSAGE)\]/i);
    if (match) return match[1].toUpperCase();

    // Also check for natural endings
    const lowerText = text.toLowerCase();
    if (lowerText.includes('goodbye') && lowerText.includes('thank you for calling')) {
        return 'END';
    }
    return null;
}

// ============================================================
// Caller context lookup
// ============================================================

function lookupCaller(number) {
    // Check local contacts cache first
    const cacheFile = path.join(process.env.HOME, 'voice-contacts.json');
    try {
        if (fs.existsSync(cacheFile)) {
            const contacts = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
            if (contacts[number]) {
                log(`Found caller in local cache: ${contacts[number].name}`);
                return contacts[number];
            }
        }
    } catch (e) {
        log(`Contacts cache error: ${e.message}`);
    }
    return { name: null, previousCalls: 0, notes: '' };
}

// ============================================================
// Main conversation loop
// ============================================================

async function main() {
    log(`=== Conversation started with ${CALLER_NUMBER} ===`);

    const callerContext = lookupCaller(CALLER_NUMBER);
    let silenceCount = 0;
    const MAX_SILENCE = 3; // End call after 3 consecutive silences

    // Initial greeting
    const greeting = callerContext.name
        ? `Hello ${callerContext.name}! Thank you for calling ${config.businessName}. How can I help you today?`
        : config.greeting;

    transcript.push({ time: timestamp(), speaker: 'AI', text: greeting });
    speak(greeting);

    // Conversation loop
    while (callActive) {
        // Check if call is still active
        if (!isCallActive()) {
            log('Call dropped (detected via telephony state)');
            callActive = false;
            break;
        }

        // Listen for caller speech
        const callerSpeech = listen(8);

        if (!callerSpeech) {
            silenceCount++;
            log(`Silence detected (${silenceCount}/${MAX_SILENCE})`);

            if (silenceCount >= MAX_SILENCE) {
                const goodbye = "It seems like you may have stepped away. Thank you for calling " +
                    config.businessName + ". Feel free to call back anytime. Goodbye!";
                transcript.push({ time: timestamp(), speaker: 'AI', text: goodbye });
                speak(goodbye);
                hangUp();
                break;
            }

            // Prompt after silence
            const prompt = silenceCount === 1
                ? "Are you still there? I'm here to help."
                : "I'm still here if you need anything.";
            transcript.push({ time: timestamp(), speaker: 'AI', text: prompt });
            speak(prompt);
            continue;
        }

        // Reset silence counter on speech
        silenceCount = 0;
        transcript.push({ time: timestamp(), speaker: 'Caller', text: callerSpeech });

        // Get AI response
        const { text: aiResponse, action } = await chatWithClaude(callerSpeech, callerContext);
        transcript.push({ time: timestamp(), speaker: 'AI', text: aiResponse });

        // Handle actions
        switch (action) {
            case 'END':
                speak(aiResponse);
                log('Action: END - hanging up');
                hangUp();
                break;

            case 'TRANSFER':
                speak(aiResponse);
                if (config.transferNumber) {
                    log(`Action: TRANSFER to ${config.transferNumber}`);
                    speak(`Transferring you now. One moment please.`);
                    // On Android, we can't truly transfer - instead inform and provide number
                    speak(`I'll have someone call you right back at your number. Thank you for your patience.`);
                    // Notify owner via post-call
                    transcript.push({
                        time: timestamp(),
                        speaker: 'SYSTEM',
                        text: `TRANSFER REQUESTED to ${config.transferNumber}`
                    });
                }
                hangUp();
                break;

            case 'BOOK':
                speak(aiResponse);
                transcript.push({
                    time: timestamp(),
                    speaker: 'SYSTEM',
                    text: 'BOOKING REQUESTED'
                });
                // Continue conversation to collect details
                break;

            case 'MESSAGE':
                speak(aiResponse);
                transcript.push({
                    time: timestamp(),
                    speaker: 'SYSTEM',
                    text: 'MESSAGE TAKEN'
                });
                break;

            default:
                speak(aiResponse);
                break;
        }
    }

    // Save transcript
    const transcriptFile = path.join(
        TRANSCRIPT_DIR,
        `${CALLER_NUMBER}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    const transcriptData = {
        caller: CALLER_NUMBER,
        callerName: callerContext.name,
        startTime: transcript[0]?.time,
        endTime: timestamp(),
        messageCount: transcript.length,
        transcript
    };
    fs.writeFileSync(transcriptFile, JSON.stringify(transcriptData, null, 2));
    log(`Transcript saved: ${transcriptFile}`);
    log(`=== Conversation ended with ${CALLER_NUMBER} ===`);

    // Output transcript path for post-call.js to pick up
    console.log(`TRANSCRIPT:${transcriptFile}`);
}

main().catch(e => {
    log(`FATAL: ${e.message}`);
    process.exit(1);
});
