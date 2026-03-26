-- Voice configuration table for the AI Voice Answering System.
-- Stores per-business settings: greeting, voice selection, hours, FAQ, etc.
-- Only one row is expected (singleton config), but the schema supports
-- multiple configs for future multi-tenant use.

CREATE TABLE IF NOT EXISTS voice_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name   TEXT NOT NULL DEFAULT 'Our Business',
  industry        TEXT NOT NULL DEFAULT 'general',
  greeting_template TEXT NOT NULL DEFAULT 'Hi, thanks for calling {business_name}. How can I help you?',
  voice_id        TEXT NOT NULL DEFAULT '21m00Tcm4TlvDq8ikWAM',
  transfer_number TEXT,
  business_hours  JSONB NOT NULL DEFAULT '{
    "monday":    {"open": "09:00", "close": "17:00"},
    "tuesday":   {"open": "09:00", "close": "17:00"},
    "wednesday": {"open": "09:00", "close": "17:00"},
    "thursday":  {"open": "09:00", "close": "17:00"},
    "friday":    {"open": "09:00", "close": "17:00"},
    "saturday":  null,
    "sunday":    null
  }'::jsonb,
  services        JSONB NOT NULL DEFAULT '[]'::jsonb,
  faq             JSONB NOT NULL DEFAULT '[]'::jsonb,
  timezone        TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  max_call_duration_seconds INTEGER NOT NULL DEFAULT 600 CHECK (max_call_duration_seconds BETWEEN 60 AND 3600),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast singleton lookup
CREATE INDEX IF NOT EXISTS idx_voice_config_updated ON voice_config(updated_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_voice_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_voice_config_updated_at
  BEFORE UPDATE ON voice_config
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_config_updated_at();
