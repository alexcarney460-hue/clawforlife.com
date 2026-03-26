/**
 * POST /api/voice/status — Call status webhook.
 *
 * Twilio fires this when a call reaches a terminal state (completed,
 * busy, failed, no-answer). We use it to:
 *
 * 1. Save the full call transcript to Supabase analytics_events
 * 2. Log the interaction in contact_history for the lead
 * 3. Send a summary to the owner via Telegram
 * 4. Clean up the in-memory conversation state
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { endConversation } from '@/lib/voice/conversation';
import { logCallInteraction } from '@/lib/voice/caller-lookup';

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string | null;
    const callStatus = formData.get('CallStatus') as string | null;
    const callerNumber = formData.get('From') as string | null;
    const calledNumber = formData.get('To') as string | null;
    const callDuration = formData.get('CallDuration') as string | null;

    console.log(
      `[Voice/Status] Call ${callSid} status: ${callStatus} | Duration: ${callDuration}s`,
    );

    if (!callSid) {
      return NextResponse.json({ ok: true });
    }

    // Retrieve and clean up conversation state
    const conversation = endConversation(callSid);

    // Build transcript from conversation messages
    const transcript = conversation
      ? conversation.messages
          .map((m) => `${m.role === 'user' ? 'Caller' : 'AI'}: ${m.content}`)
          .join('\n')
      : 'No transcript available';

    const turnCount = conversation?.turnCount ?? 0;

    // Run post-call tasks in parallel
    await Promise.allSettled([
      saveCallAnalytics({
        callSid: callSid,
        callerNumber: callerNumber ?? 'unknown',
        calledNumber: calledNumber ?? 'unknown',
        status: callStatus ?? 'unknown',
        duration: parseInt(callDuration ?? '0', 10),
        turnCount,
        transcript,
      }),
      conversation
        ? logCallInteraction({
            leadId: conversation.callSid,
            direction: 'inbound',
            subject: `Voice call (${turnCount} turns, ${callDuration ?? '0'}s)`,
            body: transcript,
            metadata: {
              call_sid: callSid,
              status: callStatus,
              duration: callDuration,
              caller: callerNumber,
            },
          })
        : Promise.resolve(),
      sendTelegramSummary({
        callSid: callSid,
        callerNumber: callerNumber ?? 'unknown',
        status: callStatus ?? 'unknown',
        duration: callDuration ?? '0',
        turnCount,
        transcript,
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Voice/Status] Error:', message);
    // Always return 200 to Twilio — status webhooks should not retry
    return NextResponse.json({ ok: true });
  }
}

// ---------------------------------------------------------------------------
// Analytics persistence
// ---------------------------------------------------------------------------

async function saveCallAnalytics(params: {
  callSid: string;
  callerNumber: string;
  calledNumber: string;
  status: string;
  duration: number;
  turnCount: number;
  transcript: string;
}): Promise<void> {
  try {
    const supabase = createServiceRoleClient();

    const { error } = await supabase.from('analytics_events').insert({
      event_type: 'voice_call',
      session_id: params.callSid,
      customer_id: null,
      page_url: null,
      referrer: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      properties: {
        caller_number: params.callerNumber,
        called_number: params.calledNumber,
        status: params.status,
        duration_seconds: params.duration,
        turn_count: params.turnCount,
        transcript: params.transcript,
      },
    });

    if (error) {
      console.error('[Voice/Status] Failed to save analytics:', error.message);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Voice/Status] Analytics error:', message);
  }
}

// ---------------------------------------------------------------------------
// Telegram notification
// ---------------------------------------------------------------------------

async function sendTelegramSummary(params: {
  callSid: string;
  callerNumber: string;
  status: string;
  duration: string;
  turnCount: number;
  transcript: string;
}): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log('[Voice/Status] Telegram not configured, skipping notification');
    return;
  }

  try {
    // Truncate transcript for Telegram (4096 char limit)
    const shortTranscript =
      params.transcript.length > 2000
        ? params.transcript.slice(0, 2000) + '\n... (truncated)'
        : params.transcript;

    const message = [
      '📞 *Voice Call Summary*',
      '',
      `*From:* \`${params.callerNumber}\``,
      `*Status:* ${params.status}`,
      `*Duration:* ${params.duration}s (${params.turnCount} turns)`,
      '',
      '*Transcript:*',
      '```',
      shortTranscript,
      '```',
    ].join('\n');

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Voice/Status] Telegram notification failed:', message);
  }
}
