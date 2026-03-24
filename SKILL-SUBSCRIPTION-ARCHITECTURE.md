# OpenClaw Skill Subscription Architecture

## Core Concept

The phone ships with OpenClaw (the runtime), but **skill `.md` files** are what give the agent its abilities. Control access to skill files = control the subscription.

Skills are NOT bundled on the phone by default. They're hosted privately and delivered only to paying devices via a sync agent.

## How It Works

```
Phone (OpenClaw runtime)
  ↓ on boot + every 24h
Skill Sync Agent → calls license API
  ↓
License API checks Stripe subscription status
  ↓
Returns list of skill slugs user is entitled to
  ↓
Agent downloads/updates paid .md files to ~/.claude/commands/
  ↓
Deletes any .md files the user no longer pays for
```

## Pricing Model

- **Phone**: $225 one-time (hardware + OpenClaw runtime)
- **Skills**: $49/mo each (subscription, cancel anytime)
- **Full Package**: $1,299 one-time (phone) + 5 skills included for first 3 months, then $49/mo each to keep

## Technical Components

### 1. Supabase — Skill Entitlements Table

```sql
CREATE TABLE skill_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  device_token TEXT NOT NULL,
  skill_slug TEXT NOT NULL,
  stripe_subscription_id TEXT,
  active BOOLEAN DEFAULT true,
  activated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, skill_slug)
);

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  device_token TEXT UNIQUE NOT NULL,
  phone_model TEXT DEFAULT 'Samsung Galaxy A16 5G',
  registered_at TIMESTAMPTZ DEFAULT now(),
  last_sync TIMESTAMPTZ,
  openclaw_version TEXT
);
```

### 2. License API — `/api/skills/sync`

Endpoint called by the phone's sync agent:

```
GET /api/skills/sync
Headers: Authorization: Bearer <device_token>

Response:
{
  "skills": [
    { "slug": "lead-scraper", "version": "2.1.0", "url": "/skills/lead-scraper.md", "checksum": "abc123" },
    { "slug": "sms-outreach", "version": "1.4.0", "url": "/skills/sms-outreach.md", "checksum": "def456" }
  ],
  "revoked": ["viral-reel-generator"],
  "next_sync": "2026-03-25T00:00:00Z"
}
```

- Checks `skill_entitlements` table for active skills for this device
- Returns download URLs for each active skill
- Returns `revoked` list — agent deletes these from the phone
- Checksums prevent unnecessary re-downloads

### 3. Skill Sync Agent (runs on phone)

Python script at `~/.openclaw/sync-agent.py`:

```python
# Runs on boot + cron every 24h
# 1. Call /api/skills/sync with device token
# 2. Download new/updated .md files to ~/.claude/commands/
# 3. Delete revoked skills
# 4. Log sync result
```

- Device token generated on first boot, stored in `~/.openclaw/device.json`
- Registers device with license API on first run
- Graceful degradation: if API unreachable, keep existing skills (offline mode)
- Sync log at `~/.openclaw/sync.log`

### 4. Stripe Webhook Handlers

```
customer.subscription.created → INSERT skill_entitlements (active=true)
customer.subscription.updated → UPDATE entitlements based on new plan items
customer.subscription.deleted → SET active=false, expires_at=period_end
invoice.payment_failed → SET grace_period=7 days, notify via Telegram
invoice.paid → CLEAR any grace period flags
```

### 5. Skill File Hosting

- Private GitHub repo OR Supabase Storage bucket
- Each skill is a versioned `.md` file
- Naming: `{slug}/{version}.md` (e.g., `lead-scraper/2.1.0.md`)
- New versions pushed = paying subscribers get them on next sync
- Free updates are the real value prop (not the file itself)

## Enforcement Strategy

The `.md` files are just text — someone could copy them. But the value is:

1. **Updates**: New versions, bug fixes, improvements pushed monthly
2. **New skill drops**: Paying subscribers get new skills automatically
3. **Support**: Only active subscribers get onboarding + priority support
4. **Versioning**: Skills evolve with OpenClaw runtime updates — frozen skills break over time

Optional harder enforcement:
- Encrypt skill files with device-specific key
- Obfuscate critical skill logic into compiled MCP server tools
- License check embedded in skill execution (skill calls home before running)

## Admin Dashboard Needs

- View all customers + their active skills
- Manually grant/revoke skills
- See device sync history
- Stripe subscription status per customer
- Revenue per skill (which skills sell best)
- Churn tracking (which skills get cancelled most)

## Build Order

1. Supabase tables (skill_entitlements, devices)
2. `/api/skills/sync` endpoint
3. Stripe subscription checkout + webhooks
4. Sync agent script for the phone
5. Admin dashboard (can reuse existing CRM pattern)
6. Update clawforlife.com pricing to reflect subscription model

## Status

- [ ] Supabase schema
- [ ] Sync API endpoint
- [ ] Stripe subscription webhooks
- [ ] Phone sync agent
- [ ] Admin dashboard
- [ ] Website pricing update
