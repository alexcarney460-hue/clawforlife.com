/**
 * POST /api/voice/respond — Conversation turn handler.
 *
 * Twilio calls this endpoint each time the caller finishes speaking.
 * The speech is transcribed by Twilio and sent as the SpeechResult param.
 *
 * Flow:
 * 1. Receive transcribed speech from Twilio
 * 2. Pass to conversation engine with full call context
 * 3. Generate AI response via Claude
 * 4. Convert response to speech via ElevenLabs
 * 5. Return TwiML with audio playback + gather for next turn
 * 6. Handle special actions: book appointment, take message, transfer, end
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getConversation,
  processUserInput,
  serialiseState,
  type ConversationAction,
} from '@/lib/voice/conversation';
import { textToSpeech } from '@/lib/voice/tts';
import { logCallInteraction } from '@/lib/voice/caller-lookup';
import { WEBHOOK_PATHS } from '@/lib/voice/config';
import { loadVoiceConfig } from '../incoming/helpers';

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string | null;
    const speechResult = formData.get('SpeechResult') as string | null;
    const confidence = formData.get('Confidence') as string | null;

    if (!callSid) {
      return twimlResponse(buildErrorTwiml('Call session not found.'));
    }

    // If no speech detected, re-prompt
    if (!speechResult || speechResult.trim().length === 0) {
      return twimlResponse(buildRepromptTwiml(request));
    }

    console.log(
      `[Voice/Respond] Call ${callSid} | Speech: "${speechResult}" | Confidence: ${confidence ?? 'N/A'}`,
    );

    // Get active conversation
    const conversation = getConversation(callSid);
    if (!conversation) {
      // Conversation lost (cold start). Apologize and restart.
      return twimlResponse(buildRestartTwiml(request));
    }

    // Process through AI conversation engine
    const result = await processUserInput(callSid, speechResult);

    console.log(
      `[Voice/Respond] Call ${callSid} | AI: "${result.text.slice(0, 100)}..." | Action: ${result.action ?? 'none'}`,
    );

    // Handle special actions
    if (result.action) {
      return twimlResponse(
        await buildActionTwiml(request, result.text, result.action, callSid, conversation.config.voice_id),
      );
    }

    // Standard response: play audio + gather next input
    const ttsResult = await textToSpeech(result.text, conversation.config.voice_id);
    const origin = getOrigin(request);

    const twiml = ttsResult
      ? buildAudioResponseTwiml(origin, callSid, result.text)
      : buildSayResponseTwiml(origin, result.text);

    return twimlResponse(twiml);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Voice/Respond] Error:', message);
    return twimlResponse(
      buildErrorTwiml('I am sorry, I had trouble processing that. Could you say that again?'),
    );
  }
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function buildActionTwiml(
  request: NextRequest,
  responseText: string,
  action: ConversationAction,
  callSid: string,
  voiceId: string,
): Promise<string> {
  const origin = getOrigin(request);
  const statusUrl = `${origin}${WEBHOOK_PATHS.status}`;

  // Try TTS for the response text
  const ttsResult = await textToSpeech(responseText, voiceId);
  const audioUrl = `${origin}/api/voice/audio?sid=${encodeURIComponent(callSid)}&text=${encodeURIComponent(responseText)}`;

  const playOrSay = ttsResult
    ? `<Play>${escapeXml(audioUrl)}</Play>`
    : `<Say voice="Polly.Joanna">${escapeXml(responseText)}</Say>`;

  switch (action) {
    case 'TRANSFER': {
      // Load config to get transfer number
      const config = await loadVoiceConfig();
      if (config.transfer_number) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${playOrSay}
  <Dial callerId="${escapeXml(config.transfer_number)}" action="${escapeXml(statusUrl)}" method="POST">
    <Number>${escapeXml(config.transfer_number)}</Number>
  </Dial>
  <Say voice="Polly.Joanna">The call could not be connected. Please try again later. Goodbye.</Say>
</Response>`;
      }
      // No transfer number — take a message instead
      const fallback = 'I am sorry, I am not able to transfer right now. Let me take a message instead. What is your name?';
      return buildSayResponseTwiml(origin, fallback);
    }

    case 'BOOK_APPOINTMENT': {
      // Log the appointment request and end the call
      const conversation = getConversation(callSid);
      if (conversation) {
        await logCallInteraction({
          leadId: conversation.callerName ? callSid : 'unknown',
          direction: 'inbound',
          subject: 'Appointment Booking Request',
          body: responseText,
          metadata: { action: 'book_appointment', callSid },
        });
      }

      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${playOrSay}
  <Pause length="1"/>
  <Say voice="Polly.Joanna">Thank you for calling. Have a great day!</Say>
  <Hangup/>
</Response>`;
    }

    case 'TAKE_MESSAGE': {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${playOrSay}
  <Pause length="1"/>
  <Say voice="Polly.Joanna">Your message has been received. Have a great day!</Say>
  <Hangup/>
</Response>`;
    }

    case 'END_CALL': {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${playOrSay}
  <Hangup/>
</Response>`;
    }

    default:
      return buildSayResponseTwiml(origin, responseText);
  }
}

// ---------------------------------------------------------------------------
// TwiML builders
// ---------------------------------------------------------------------------

function buildAudioResponseTwiml(
  origin: string,
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
  <Say voice="Polly.Joanna">I did not hear anything. Goodbye.</Say>
</Response>`;
}

function buildSayResponseTwiml(origin: string, text: string): string {
  const respondUrl = `${origin}${WEBHOOK_PATHS.respond}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(text)}</Say>
  <Gather input="speech" action="${escapeXml(respondUrl)}" method="POST" speechTimeout="3" language="en-US" speechModel="phone_call">
    <Say voice="Polly.Joanna">I am listening.</Say>
  </Gather>
  <Say voice="Polly.Joanna">I did not hear anything. Goodbye.</Say>
</Response>`;
}

function buildRepromptTwiml(request: NextRequest): string {
  const origin = getOrigin(request);
  const respondUrl = `${origin}${WEBHOOK_PATHS.respond}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I am sorry, I did not catch that. Could you please repeat?</Say>
  <Gather input="speech" action="${escapeXml(respondUrl)}" method="POST" speechTimeout="3" language="en-US" speechModel="phone_call">
    <Say voice="Polly.Joanna">I am listening.</Say>
  </Gather>
  <Say voice="Polly.Joanna">I still could not hear you. Goodbye.</Say>
</Response>`;
}

function buildRestartTwiml(request: NextRequest): string {
  const origin = getOrigin(request);
  const incomingUrl = `${origin}${WEBHOOK_PATHS.incoming}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I apologize, let me reconnect you.</Say>
  <Redirect method="POST">${escapeXml(incomingUrl)}</Redirect>
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
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
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
