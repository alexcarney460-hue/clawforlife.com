/**
 * GET/POST /api/voice/setup — Admin endpoint for voice configuration.
 *
 * GET:  Returns the current voice configuration.
 * POST: Updates the voice configuration (upsert into voice_config table).
 *
 * Both endpoints require admin authentication via getAdminOrNull.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminOrNull } from '@/lib/auth/session';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  DEFAULT_VOICE_CONFIG,
  INDUSTRY_OPTIONS,
  VOICE_OPTIONS,
  type VoiceConfig,
} from '@/lib/voice/config';
import { clearCache } from '@/lib/voice/tts';

// ---------------------------------------------------------------------------
// GET — retrieve current config
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  try {
    const admin = await getAdminOrNull();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('voice_config')
      .select('*')
      .limit(1)
      .single();

    if (error || !data) {
      // Return defaults if no config exists
      return NextResponse.json({
        config: {
          id: null,
          ...DEFAULT_VOICE_CONFIG,
        },
        voiceOptions: VOICE_OPTIONS,
        industryOptions: INDUSTRY_OPTIONS,
      });
    }

    return NextResponse.json({
      config: data,
      voiceOptions: VOICE_OPTIONS,
      industryOptions: INDUSTRY_OPTIONS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[Voice/Setup GET] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — update config
// ---------------------------------------------------------------------------

interface SetupBody {
  business_name?: string;
  industry?: string;
  greeting_template?: string;
  voice_id?: string;
  transfer_number?: string | null;
  business_hours?: Record<string, { open: string; close: string } | null>;
  services?: string[];
  faq?: Array<{ question: string; answer: string }>;
  timezone?: string;
  max_call_duration_seconds?: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const admin = await getAdminOrNull();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SetupBody = await request.json();

    // Validate industry if provided
    if (body.industry && !INDUSTRY_OPTIONS.includes(body.industry as typeof INDUSTRY_OPTIONS[number])) {
      return NextResponse.json(
        { error: `Invalid industry. Must be one of: ${INDUSTRY_OPTIONS.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate voice ID if provided
    if (body.voice_id && !VOICE_OPTIONS.some((v) => v.id === body.voice_id)) {
      return NextResponse.json(
        { error: 'Invalid voice_id. Use GET /api/voice/setup for available options.' },
        { status: 400 },
      );
    }

    // Validate max call duration
    if (body.max_call_duration_seconds !== undefined) {
      if (body.max_call_duration_seconds < 60 || body.max_call_duration_seconds > 3600) {
        return NextResponse.json(
          { error: 'max_call_duration_seconds must be between 60 and 3600' },
          { status: 400 },
        );
      }
    }

    const supabase = createServiceRoleClient();

    // Check if config exists
    const { data: existing } = await supabase
      .from('voice_config')
      .select('id')
      .limit(1)
      .single();

    const now = new Date().toISOString();

    const configData = {
      business_name: body.business_name ?? DEFAULT_VOICE_CONFIG.business_name,
      industry: body.industry ?? DEFAULT_VOICE_CONFIG.industry,
      greeting_template: body.greeting_template ?? DEFAULT_VOICE_CONFIG.greeting_template,
      voice_id: body.voice_id ?? DEFAULT_VOICE_CONFIG.voice_id,
      transfer_number: body.transfer_number ?? null,
      business_hours: body.business_hours ?? DEFAULT_VOICE_CONFIG.business_hours,
      services: body.services ?? DEFAULT_VOICE_CONFIG.services,
      faq: body.faq ?? DEFAULT_VOICE_CONFIG.faq,
      timezone: body.timezone ?? DEFAULT_VOICE_CONFIG.timezone,
      max_call_duration_seconds:
        body.max_call_duration_seconds ?? DEFAULT_VOICE_CONFIG.max_call_duration_seconds,
      updated_at: now,
    };

    let result;

    if (existing?.id) {
      // Update existing
      const { data, error } = await supabase
        .from('voice_config')
        .update(configData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('voice_config')
        .insert({ ...configData, created_at: now })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    }

    // Clear TTS cache since voice settings may have changed
    clearCache();

    return NextResponse.json({ config: result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[Voice/Setup POST] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
