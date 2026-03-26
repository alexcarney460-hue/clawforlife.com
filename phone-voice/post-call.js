#!/data/data/com.termux/files/usr/bin/node
// post-call.js — After-call processing: CRM update, Telegram notification, stats
// Usage: node post-call.js <caller_number> <duration_seconds>

const fs = require('fs');
const path = require('path');

const CALLER_NUMBER = process.argv[2] || 'unknown';
const CALL_DURATION = parseInt(process.argv[3] || '0', 10);
const LOG_DIR = path.join(process.env.HOME, 'voice-logs');
const TRANSCRIPT_DIR = path.join(LOG_DIR, 'transcripts');

// Supabase CRM config
const SUPABASE_URL = 'https://urhacndintzremgspbcu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaGFjbmRpbnR6cmVtZ3NwYmN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQwMTA3MSwiZXhwIjoyMDg5OTc3MDcxfQ.wh1AoNPhFFXQxU7a32n9m0Th-LgP1gTkNK-8jMmeVo8';

// Telegram config
const TELEGRAM_TOKEN = '8554017600:AAF5MuQ_TcTZflLeK9NgCFOWk2EVS9t5JR8';
const DEFAULT_CHAT_ID = '6315250293';

const timestamp = () => new Date().toISOString();
const log = (msg) => console.log(`[${timestamp()}] [post-call] ${msg}`);

// ============================================================
// Find the most recent transcript for this caller
// ============================================================

function findTranscript() {
    try {
        const files = fs.readdirSync(TRANSCRIPT_DIR)
            .filter(f => f.startsWith(CALLER_NUMBER) && f.endsWith('.json'))
            .sort()
            .reverse();

        if (files.length > 0) {
            const filePath = path.join(TRANSCRIPT_DIR, files[0]);
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
    } catch (e) {
        log(`Transcript search error: ${e.message}`);
    }
    return null;
}

// ============================================================
// Analyze call for summary
// ============================================================

function analyzeCall(transcript) {
    if (!transcript || !transcript.transcript) {
        return { summary: 'No transcript available', outcome: 'unknown', sentiment: 'neutral' };
    }

    const messages = transcript.transcript;
    const callerMessages = messages.filter(m => m.speaker === 'Caller');
    const systemMessages = messages.filter(m => m.speaker === 'SYSTEM');

    // Determine outcome from system messages
    let outcome = 'general_inquiry';
    for (const msg of systemMessages) {
        if (msg.text.includes('BOOKING')) outcome = 'booking_requested';
        if (msg.text.includes('TRANSFER')) outcome = 'transfer_requested';
        if (msg.text.includes('MESSAGE')) outcome = 'message_taken';
    }

    // Simple sentiment from caller messages
    const callerText = callerMessages.map(m => m.text).join(' ').toLowerCase();
    let sentiment = 'neutral';
    const positiveWords = ['thank', 'great', 'perfect', 'wonderful', 'appreciate', 'helpful', 'excellent'];
    const negativeWords = ['angry', 'frustrated', 'terrible', 'awful', 'ridiculous', 'unacceptable', 'worst'];

    const posCount = positiveWords.filter(w => callerText.includes(w)).length;
    const negCount = negativeWords.filter(w => callerText.includes(w)).length;
    if (posCount > negCount) sentiment = 'positive';
    if (negCount > posCount) sentiment = 'negative';

    // Build summary from caller's messages
    const summary = callerMessages.length > 0
        ? callerMessages.map(m => m.text).slice(0, 3).join(' | ')
        : 'Caller did not speak';

    return { summary, outcome, sentiment };
}

// ============================================================
// Supabase CRM operations
// ============================================================

async function supabaseRequest(tablePath, method, body) {
    const url = `${SUPABASE_URL}/rest/v1/${tablePath}`;
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Supabase ${method} ${tablePath}: ${response.status} ${errText}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

async function upsertLead(callerNumber, analysis) {
    // Check if lead exists
    const encodedPhone = encodeURIComponent(callerNumber);
    try {
        const existing = await supabaseRequest(
            `leads?phone=eq.${encodedPhone}&select=id,name,call_count`,
            'GET'
        );

        if (existing && existing.length > 0) {
            // Update existing lead
            const lead = existing[0];
            await supabaseRequest(
                `leads?id=eq.${lead.id}`,
                'PATCH',
                {
                    call_count: (lead.call_count || 0) + 1,
                    last_call_at: new Date().toISOString(),
                    last_call_outcome: analysis.outcome,
                    last_call_sentiment: analysis.sentiment,
                    updated_at: new Date().toISOString()
                }
            );
            log(`Updated existing lead: ${lead.name || callerNumber} (id: ${lead.id})`);
            return lead.id;
        } else {
            // Create new lead
            const result = await supabaseRequest('leads', 'POST', {
                phone: callerNumber,
                source: 'inbound_call',
                status: 'new',
                call_count: 1,
                last_call_at: new Date().toISOString(),
                last_call_outcome: analysis.outcome,
                last_call_sentiment: analysis.sentiment,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            const newId = result?.[0]?.id;
            log(`Created new lead for ${callerNumber} (id: ${newId})`);
            return newId;
        }
    } catch (e) {
        log(`CRM upsert error: ${e.message}`);
        return null;
    }
}

async function logCallHistory(leadId, callerNumber, duration, analysis, transcript) {
    try {
        await supabaseRequest('contact_history', 'POST', {
            lead_id: leadId,
            phone: callerNumber,
            channel: 'inbound_call',
            direction: 'inbound',
            duration_seconds: duration,
            outcome: analysis.outcome,
            sentiment: analysis.sentiment,
            summary: analysis.summary,
            transcript_json: transcript?.transcript || [],
            created_at: new Date().toISOString()
        });
        log('Call history logged to CRM');
    } catch (e) {
        log(`Call history log error: ${e.message}`);
    }
}

// ============================================================
// Telegram notification
// ============================================================

async function sendTelegramNotification(callerNumber, duration, analysis, transcript) {
    const config = loadConfig();
    const chatId = config.ownerTelegramId || DEFAULT_CHAT_ID;

    const durationMin = Math.floor(duration / 60);
    const durationSec = duration % 60;
    const durationStr = durationMin > 0
        ? `${durationMin}m ${durationSec}s`
        : `${durationSec}s`;

    const sentimentEmoji = {
        positive: 'Positive',
        negative: 'NEGATIVE',
        neutral: 'Neutral'
    };

    // Build message excerpt from transcript
    let excerpt = '';
    if (transcript?.transcript) {
        const callerMsgs = transcript.transcript
            .filter(m => m.speaker === 'Caller')
            .slice(0, 3);
        if (callerMsgs.length > 0) {
            excerpt = '\n\nCaller said:\n' + callerMsgs.map(m => `> "${m.text}"`).join('\n');
        }
    }

    const message = `INCOMING CALL HANDLED

Caller: ${callerNumber}
Duration: ${durationStr}
Outcome: ${analysis.outcome.replace(/_/g, ' ')}
Sentiment: ${sentimentEmoji[analysis.sentiment] || analysis.sentiment}
${excerpt}

Summary: ${analysis.summary}`;

    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Telegram ${response.status}: ${errText}`);
        }
        log('Telegram notification sent');
    } catch (e) {
        log(`Telegram notification error: ${e.message}`);
    }
}

// ============================================================
// Save call stats locally
// ============================================================

function saveCallStats(callerNumber, duration, analysis) {
    const statsFile = path.join(LOG_DIR, 'call-stats.jsonl');
    const entry = {
        timestamp: new Date().toISOString(),
        caller: callerNumber,
        duration,
        outcome: analysis.outcome,
        sentiment: analysis.sentiment,
        summary: analysis.summary
    };
    fs.appendFileSync(statsFile, JSON.stringify(entry) + '\n');
    log('Call stats saved');
}

function loadConfig() {
    const configPath = path.join(process.env.HOME, 'voice-config.json');
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
        return {};
    }
}

// ============================================================
// Main
// ============================================================

async function main() {
    log(`=== Post-call processing for ${CALLER_NUMBER} (${CALL_DURATION}s) ===`);

    // Find and analyze transcript
    const transcript = findTranscript();
    const analysis = analyzeCall(transcript);

    log(`Analysis: outcome=${analysis.outcome}, sentiment=${analysis.sentiment}`);

    // Run all post-call tasks
    const results = await Promise.allSettled([
        // 1. CRM: upsert lead and log history
        (async () => {
            const leadId = await upsertLead(CALLER_NUMBER, analysis);
            if (leadId) {
                await logCallHistory(leadId, CALLER_NUMBER, CALL_DURATION, analysis, transcript);
            }
        })(),

        // 2. Telegram notification
        sendTelegramNotification(CALLER_NUMBER, CALL_DURATION, analysis, transcript),
    ]);

    // 3. Local stats (sync, always runs)
    saveCallStats(CALLER_NUMBER, CALL_DURATION, analysis);

    // Log results
    results.forEach((r, i) => {
        const taskNames = ['CRM', 'Telegram'];
        if (r.status === 'rejected') {
            log(`${taskNames[i]} failed: ${r.reason}`);
        } else {
            log(`${taskNames[i]} completed`);
        }
    });

    log('=== Post-call processing complete ===');
}

main().catch(e => {
    log(`FATAL: ${e.message}`);
    process.exit(1);
});
