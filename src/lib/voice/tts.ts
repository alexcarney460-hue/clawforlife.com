/**
 * Text-to-speech via ElevenLabs.
 *
 * Converts AI response text to audio bytes that can be served back to
 * Twilio as an MP3 stream. Includes an in-memory LRU cache for common
 * phrases (greetings, hold messages, goodbyes) to reduce latency and
 * API costs.
 */

import { ELEVENLABS_CONFIG, DEFAULT_VOICE_ID } from './config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TTSResult {
  readonly audioBuffer: Buffer;
  readonly contentType: string;
  readonly cached: boolean;
}

// ---------------------------------------------------------------------------
// Phrase cache (LRU-style, max 50 entries)
// ---------------------------------------------------------------------------

const MAX_CACHE_SIZE = 50;
const phraseCache = new Map<string, Buffer>();

function getCacheKey(text: string, voiceId: string): string {
  return `${voiceId}:${text.toLowerCase().trim()}`;
}

function getCachedAudio(text: string, voiceId: string): Buffer | null {
  const key = getCacheKey(text, voiceId);
  const cached = phraseCache.get(key);
  if (!cached) return null;

  // Move to end (most recently used)
  phraseCache.delete(key);
  phraseCache.set(key, cached);
  return cached;
}

function setCachedAudio(text: string, voiceId: string, audio: Buffer): void {
  const key = getCacheKey(text, voiceId);

  // Evict oldest if at capacity
  if (phraseCache.size >= MAX_CACHE_SIZE) {
    const oldest = phraseCache.keys().next().value;
    if (oldest !== undefined) {
      phraseCache.delete(oldest);
    }
  }

  phraseCache.set(key, audio);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert text to speech audio via ElevenLabs.
 *
 * Returns an MP3 buffer suitable for streaming to Twilio via <Play>.
 * Falls back to null if ElevenLabs is unavailable (caller should use
 * Twilio <Say> as fallback).
 */
export async function textToSpeech(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID,
): Promise<TTSResult | null> {
  if (!text.trim()) return null;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('[TTS] ELEVENLABS_API_KEY is not set');
    return null;
  }

  // Check cache first
  const cached = getCachedAudio(text, voiceId);
  if (cached) {
    return { audioBuffer: cached, contentType: 'audio/mpeg', cached: true };
  }

  try {
    const url = `${ELEVENLABS_CONFIG.apiUrl}/text-to-speech/${voiceId}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_CONFIG.model,
        output_format: ELEVENLABS_CONFIG.outputFormat,
        voice_settings: {
          stability: ELEVENLABS_CONFIG.stability,
          similarity_boost: ELEVENLABS_CONFIG.similarityBoost,
          style: ELEVENLABS_CONFIG.style,
          use_speaker_boost: ELEVENLABS_CONFIG.useSpeakerBoost,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TTS] ElevenLabs error ${response.status}: ${errorText}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Cache short phrases (under 200 chars) for reuse
    if (text.length < 200) {
      setCachedAudio(text, voiceId, buffer);
    }

    return { audioBuffer: buffer, contentType: 'audio/mpeg', cached: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown TTS error';
    console.error(`[TTS] Failed: ${message}`);
    return null;
  }
}

/**
 * Pre-warm the cache with common phrases for a given voice.
 * Call this once when the voice config loads.
 */
export async function prewarmCache(
  voiceId: string,
  phrases: readonly string[],
): Promise<void> {
  const results = await Promise.allSettled(
    phrases.map((phrase) => textToSpeech(phrase, voiceId)),
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`[TTS] Pre-warmed ${succeeded}/${phrases.length} phrases`);
}

/**
 * Common phrases worth pre-warming.
 */
export function getCommonPhrases(businessName: string): readonly string[] {
  return [
    `Thanks for calling ${businessName}. How can I help you?`,
    'One moment please while I look that up.',
    'Could you repeat that? I want to make sure I heard you correctly.',
    `Thanks for calling ${businessName}! Have a great day!`,
    'Let me take a message for you.',
    'I will have someone call you back as soon as possible.',
    'Let me transfer you now.',
  ];
}

/**
 * Clear the TTS cache. Useful when voice settings change.
 */
export function clearCache(): void {
  phraseCache.clear();
}
