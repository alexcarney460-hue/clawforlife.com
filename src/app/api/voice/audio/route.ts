/**
 * GET /api/voice/audio — Serve TTS audio to Twilio.
 *
 * Twilio's <Play> verb needs a URL that returns audio. This endpoint
 * generates speech on-the-fly via ElevenLabs and returns the MP3 stream.
 *
 * Query params:
 *   ?text=Hello+world  — text to convert to speech
 *   ?voice=voiceId     — optional ElevenLabs voice ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { textToSpeech } from '@/lib/voice/tts';
import { DEFAULT_VOICE_ID } from '@/lib/voice/config';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const text = url.searchParams.get('text');
  const voiceId = url.searchParams.get('voice') ?? DEFAULT_VOICE_ID;

  if (!text) {
    return new NextResponse('Missing text parameter', { status: 400 });
  }

  try {
    const result = await textToSpeech(decodeURIComponent(text), voiceId);

    if (!result) {
      // Fallback: return empty audio (Twilio will skip and move on)
      return new NextResponse(null, { status: 204 });
    }

    return new NextResponse(result.audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Length': result.audioBuffer.length.toString(),
        'Cache-Control': result.cached ? 'public, max-age=3600' : 'no-cache',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS error';
    console.error('[Voice/Audio] Error:', message);
    return new NextResponse(null, { status: 500 });
  }
}
