/**
 * POST /api/voice/incoming — Twilio webhook for incoming calls.
 *
 * This is the entry point for every inbound call. Twilio hits this
 * endpoint and expects TwiML back within 15 seconds.
 *
 * Flow:
 * 1. Extract caller info from Twilio request params
 * 2. Look up caller in CRM (creates new lead if unknown)
 * 3. Load voice config for the business
 * 4. Determine business hours
 * 5. Generate personalised greeting
 * 6. Convert greeting to speech via ElevenLabs
 * 7. Return TwiML that plays the greeting and gathers speech input
 */

import { NextRequest, NextResponse } from 'next/server';
import { lookupCaller, summariseCallerHistory } from '@/lib/voice/caller-lookup';
import { startConversation, serialiseState } from '@/lib/voice/conversation';
import { textToSpeech } from '@/lib/voice/tts';
import { loadVoiceConfig, isWithinBusinessHours } from './helpers';
import { GREETING_TEMPLATES, WEBHOOK_PATHS } from '@/lib/voice/config';

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse Twilio form data
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string | null;
    const callerNumber = formData.get('From') as string | null;
    const calledNumber = formData.get('To') as string | null;

    if (!callSid || !callerNumber) {
      return twimlResponse(buildErrorTwiml('We are experiencing technical difficulties. Please try again later.'));
    }

    console.log(`[Voice/Incoming] Call ${callSid} from ${callerNumber} to ${calledNumber}`);

    // Parallel: look up caller + load config
    const [callerInfo, config] = await Promise.all([
      lookupCaller(callerNumber),
      loadVoiceConfig(),
    ]);

    const withinHours = isWithinBusinessHours(config);

    // Build greeting
    const greeting = buildGreeting(
      config.business_name,
      config.greeting_template,
      callerInfo.displayName,
      withinHours,
      config,
    );

    // Start conversation engine
    const conversationState = startConversation({
      callSid,
      callerNumber,
      callerName: callerInfo.displayName,
      callerHistory: summariseCallerHistory(callerInfo.recentInteractions),
      config,
      isWithinHours: withinHours,
    });

    const stateToken = serialiseState(conversationState);

    // Try ElevenLabs TTS for greeting
    const ttsResult = await textToSpeech(greeting, config.voice_id);

    const origin = getOrigin(request);

    // Build TwiML response
    const twiml = ttsResult
      ? buildTwimlWithAudio(origin, stateToken, callSid, greeting)
      : buildTwimlWithSay(origin, stateToken, greeting);

    return twimlResponse(twiml);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Voice/Incoming] Error:', message);
    return twimlResponse(
      buildErrorTwiml('We are experiencing technical difficulties. Please try again later.'),
    );
  }
}

// ---------------------------------------------------------------------------
// Greeting builder
// ---------------------------------------------------------------------------

function buildGreeting(
  businessName: string,
  template: string,
  callerName: string | null,
  withinHours: boolean,
  config: { business_hours: Record<string, { open: string; close: string } | null> },
): string {
  if (!withinHours) {
    const hours = formatHoursForGreeting(config.business_hours);
    return GREETING_TEMPLATES.after_hours
      .replace('{business_name}', businessName)
      .replace('{hours}', hours);
  }

  if (callerName) {
    return GREETING_TEMPLATES.returning
      .replace('{business_name}', businessName)
      .replace('{caller_name}', callerName);
  }

  return template.replace('{business_name}', businessName);
}

function formatHoursForGreeting(
  hours: Record<string, { open: string; close: string } | null>,
): string {
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const firstOpen = weekdays.find((d) => hours[d] !== null);
  if (!firstOpen || !hours[firstOpen]) return 'Monday through Friday';

  const h = hours[firstOpen]!;
  return `Monday through Friday, ${formatTime(h.open)} to ${formatTime(h.close)}`;
}

function formatTime(time24: string): string {
  const [hourStr, minuteStr] = time24.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr ?? '00';
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return minute === '00' ? `${displayHour} ${period}` : `${displayHour}:${minute} ${period}`;
}

// ---------------------------------------------------------------------------
// TwiML builders
// ---------------------------------------------------------------------------

function buildTwimlWithAudio(
  origin: string,
  stateToken: string,
  callSid: string,
  fallbackText: string,
): string {
  const respondUrl = `${origin}${WEBHOOK_PATHS.respond}`;
  const audioUrl = `${origin}/api/voice/audio?sid=${encodeURIComponent(callSid)}&text=${encodeURIComponent(fallbackText)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${escapeXml(audioUrl)}</Play>
  <Gather input="speech" action="${escapeXml(respondUrl)}" method="POST" speechTimeout="3" language="en-US" speechModel="phone_call">
    <Say voice="Polly.Joanna">I am listening.</Say>
  </Gather>
  <Say voice="Polly.Joanna">I did not catch that. Goodbye.</Say>
</Response>`;
}

function buildTwimlWithSay(
  origin: string,
  _stateToken: string,
  text: string,
): string {
  const respondUrl = `${origin}${WEBHOOK_PATHS.respond}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(text)}</Say>
  <Gather input="speech" action="${escapeXml(respondUrl)}" method="POST" speechTimeout="3" language="en-US" speechModel="phone_call">
    <Say voice="Polly.Joanna">I am listening.</Say>
  </Gather>
  <Say voice="Polly.Joanna">I did not catch that. Goodbye.</Say>
</Response>`;
}

function buildErrorTwiml(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(message)}</Say>
</Response>`;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function twimlResponse(twiml: string): NextResponse {
  return new NextResponse(twiml, {
    status: 200,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
    },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}
