/**
 * Voice system configuration.
 *
 * Centralises all tunables for the AI voice answering system:
 * greeting templates, ElevenLabs voice selection, business hours,
 * call-transfer targets, and Twilio webhook paths.
 *
 * Runtime overrides come from the `voice_config` row in Supabase
 * (managed via /api/voice/setup). The constants here are defaults.
 */

// ---------------------------------------------------------------------------
// ElevenLabs voice catalogue (subset we expose to admins)
// ---------------------------------------------------------------------------

export interface VoiceOption {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export const VOICE_OPTIONS: readonly VoiceOption[] = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Professional female, warm' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Friendly female, conversational' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Professional male, confident' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Youthful female, energetic' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Deep male, authoritative' },
] as const;

export const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

// ---------------------------------------------------------------------------
// Business hours (default — overridden per-business via setup API)
// ---------------------------------------------------------------------------

export interface BusinessHours {
  readonly open: string;  // HH:mm in 24-hour format
  readonly close: string;
}

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export const DEFAULT_BUSINESS_HOURS: Readonly<Record<DayOfWeek, BusinessHours | null>> = {
  monday:    { open: '09:00', close: '17:00' },
  tuesday:   { open: '09:00', close: '17:00' },
  wednesday: { open: '09:00', close: '17:00' },
  thursday:  { open: '09:00', close: '17:00' },
  friday:    { open: '09:00', close: '17:00' },
  saturday:  null, // closed
  sunday:    null, // closed
};

// ---------------------------------------------------------------------------
// Greeting templates
// ---------------------------------------------------------------------------

export const GREETING_TEMPLATES = {
  default:
    'Hi, thanks for calling {business_name}. This is your AI assistant. How can I help you today?',
  returning:
    'Welcome back, {caller_name}! Thanks for calling {business_name}. How can I help you today?',
  after_hours:
    'Thanks for calling {business_name}. We are currently closed. Our hours are {hours}. I can take a message or help answer questions. What would you prefer?',
  holiday:
    'Thanks for calling {business_name}. We are closed for the holiday. I can take a message and someone will get back to you. How can I help?',
} as const;

// ---------------------------------------------------------------------------
// Twilio webhook paths (relative to app origin)
// ---------------------------------------------------------------------------

export const WEBHOOK_PATHS = {
  incoming: '/api/voice/incoming',
  respond:  '/api/voice/respond',
  status:   '/api/voice/status',
} as const;

// ---------------------------------------------------------------------------
// Voice system config (runtime, stored in Supabase)
// ---------------------------------------------------------------------------

export interface VoiceConfig {
  readonly id: string;
  readonly business_name: string;
  readonly industry: string;
  readonly greeting_template: string;
  readonly voice_id: string;
  readonly transfer_number: string | null;
  readonly business_hours: Record<DayOfWeek, BusinessHours | null>;
  readonly services: string[];
  readonly faq: Array<{ question: string; answer: string }>;
  readonly timezone: string;
  readonly max_call_duration_seconds: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export const DEFAULT_VOICE_CONFIG: Omit<VoiceConfig, 'id' | 'created_at' | 'updated_at'> = {
  business_name: 'Our Business',
  industry: 'general',
  greeting_template: GREETING_TEMPLATES.default,
  voice_id: DEFAULT_VOICE_ID,
  transfer_number: null,
  business_hours: { ...DEFAULT_BUSINESS_HOURS },
  services: [],
  faq: [],
  timezone: 'America/Los_Angeles',
  max_call_duration_seconds: 600, // 10 minutes
};

// ---------------------------------------------------------------------------
// ElevenLabs config
// ---------------------------------------------------------------------------

export const ELEVENLABS_CONFIG = {
  apiUrl: 'https://api.elevenlabs.io/v1',
  model: 'eleven_turbo_v2_5',
  outputFormat: 'mp3_44100_128' as const,
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.0,
  useSpeakerBoost: true,
} as const;

// ---------------------------------------------------------------------------
// Conversation limits
// ---------------------------------------------------------------------------

export const CONVERSATION_LIMITS = {
  maxTurns: 30,
  maxTokensPerResponse: 200,
  maxHistoryMessages: 20,
  responseTimeoutMs: 8000,
  ttsTimeoutMs: 5000,
} as const;

// ---------------------------------------------------------------------------
// Industry options (for admin UI dropdown)
// ---------------------------------------------------------------------------

export const INDUSTRY_OPTIONS = [
  'general',
  'hvac',
  'plumbing',
  'electrical',
  'dental',
  'medical',
  'restaurant',
  'contractor',
  'automotive',
  'real_estate',
  'legal',
  'salon',
  'fitness',
] as const;

export type Industry = (typeof INDUSTRY_OPTIONS)[number];
