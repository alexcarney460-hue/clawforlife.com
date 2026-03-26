/**
 * Shared helpers for voice API routes.
 *
 * Loads voice configuration from Supabase and provides business-hours
 * checking. Extracted here so both incoming/ and respond/ can share
 * the same logic without circular imports.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  DEFAULT_VOICE_CONFIG,
  type VoiceConfig,
  type DayOfWeek,
} from '@/lib/voice/config';

// ---------------------------------------------------------------------------
// Voice config loader
// ---------------------------------------------------------------------------

/**
 * Load the voice configuration from Supabase.
 * Falls back to DEFAULT_VOICE_CONFIG if no row exists or on error.
 */
export async function loadVoiceConfig(): Promise<VoiceConfig> {
  try {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('voice_config')
      .select('*')
      .limit(1)
      .single();

    if (error || !data) {
      console.log('[VoiceConfig] No config found, using defaults');
      return {
        id: 'default',
        ...DEFAULT_VOICE_CONFIG,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // Parse JSON fields that Supabase may return as strings
    const businessHours =
      typeof data.business_hours === 'string'
        ? JSON.parse(data.business_hours)
        : data.business_hours ?? DEFAULT_VOICE_CONFIG.business_hours;

    const services =
      typeof data.services === 'string'
        ? JSON.parse(data.services)
        : data.services ?? [];

    const faq =
      typeof data.faq === 'string'
        ? JSON.parse(data.faq)
        : data.faq ?? [];

    return {
      id: data.id,
      business_name: data.business_name ?? DEFAULT_VOICE_CONFIG.business_name,
      industry: data.industry ?? DEFAULT_VOICE_CONFIG.industry,
      greeting_template: data.greeting_template ?? DEFAULT_VOICE_CONFIG.greeting_template,
      voice_id: data.voice_id ?? DEFAULT_VOICE_CONFIG.voice_id,
      transfer_number: data.transfer_number ?? null,
      business_hours: businessHours,
      services,
      faq,
      timezone: data.timezone ?? DEFAULT_VOICE_CONFIG.timezone,
      max_call_duration_seconds:
        data.max_call_duration_seconds ?? DEFAULT_VOICE_CONFIG.max_call_duration_seconds,
      created_at: data.created_at,
      updated_at: data.updated_at,
    } as VoiceConfig;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[VoiceConfig] Failed to load:', message);
    return {
      id: 'default',
      ...DEFAULT_VOICE_CONFIG,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Business hours checking
// ---------------------------------------------------------------------------

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

/**
 * Check if the current time falls within configured business hours.
 */
export function isWithinBusinessHours(config: VoiceConfig): boolean {
  try {
    const now = new Date();

    // Get current time in the business's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const weekdayPart = parts.find((p) => p.type === 'weekday');
    const hourPart = parts.find((p) => p.type === 'hour');
    const minutePart = parts.find((p) => p.type === 'minute');

    if (!weekdayPart || !hourPart || !minutePart) return true; // default to open

    const dayName = weekdayPart.value.toLowerCase() as DayOfWeek;
    const hours = config.business_hours[dayName];

    if (!hours) return false; // closed this day

    const currentMinutes =
      parseInt(hourPart.value, 10) * 60 + parseInt(minutePart.value, 10);

    const [openH, openM] = hours.open.split(':').map(Number);
    const [closeH, closeM] = hours.close.split(':').map(Number);

    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } catch {
    return true; // default to open on error
  }
}
