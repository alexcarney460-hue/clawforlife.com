'use client';

import { useEffect, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoiceOption {
  id: string;
  name: string;
  description: string;
}

interface FAQEntry {
  question: string;
  answer: string;
}

interface BusinessHours {
  open: string;
  close: string;
}

interface VoiceConfigForm {
  business_name: string;
  industry: string;
  greeting_template: string;
  voice_id: string;
  transfer_number: string;
  timezone: string;
  max_call_duration_seconds: number;
  services: string[];
  faq: FAQEntry[];
  business_hours: Record<string, BusinessHours | null>;
}

interface CallLog {
  id: string;
  event_type: string;
  session_id: string;
  properties: {
    caller_number?: string;
    status?: string;
    duration_seconds?: number;
    turn_count?: number;
    transcript?: string;
  };
  created_at: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_HOURS: Record<string, BusinessHours | null> = {
  monday: { open: '09:00', close: '17:00' },
  tuesday: { open: '09:00', close: '17:00' },
  wednesday: { open: '09:00', close: '17:00' },
  thursday: { open: '09:00', close: '17:00' },
  friday: { open: '09:00', close: '17:00' },
  saturday: null,
  sunday: null,
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VoiceSettingsPage() {
  const [config, setConfig] = useState<VoiceConfigForm>({
    business_name: '',
    industry: 'general',
    greeting_template: '',
    voice_id: '',
    transfer_number: '',
    timezone: 'America/Los_Angeles',
    max_call_duration_seconds: 600,
    services: [],
    faq: [],
    business_hours: { ...DEFAULT_HOURS },
  });

  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [industryOptions, setIndustryOptions] = useState<string[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newService, setNewService] = useState('');
  const [newFaq, setNewFaq] = useState<FAQEntry>({ question: '', answer: '' });
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // Load config
  // ------------------------------------------------------------------

  const loadConfig = useCallback(async () => {
    try {
      const token = localStorage.getItem('clawforlife_token');
      const res = await fetch('/api/voice/setup', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to load voice config');

      const data = await res.json();
      if (data.config) {
        setConfig({
          business_name: data.config.business_name ?? '',
          industry: data.config.industry ?? 'general',
          greeting_template: data.config.greeting_template ?? '',
          voice_id: data.config.voice_id ?? '',
          transfer_number: data.config.transfer_number ?? '',
          timezone: data.config.timezone ?? 'America/Los_Angeles',
          max_call_duration_seconds: data.config.max_call_duration_seconds ?? 600,
          services: data.config.services ?? [],
          faq: data.config.faq ?? [],
          business_hours: data.config.business_hours ?? { ...DEFAULT_HOURS },
        });
      }
      if (data.voiceOptions) setVoiceOptions(data.voiceOptions);
      if (data.industryOptions) setIndustryOptions(data.industryOptions);
    } catch (err) {
      console.error('Failed to load voice config:', err);
      setMessage({ type: 'error', text: 'Failed to load voice configuration.' });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCallLogs = useCallback(async () => {
    try {
      const token = localStorage.getItem('clawforlife_token');
      const res = await fetch('/api/analytics/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Call logs come from analytics_events with event_type = voice_call
      // For now, we will load them client-side from the existing analytics endpoint
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadCallLogs();
  }, [loadConfig, loadCallLogs]);

  // ------------------------------------------------------------------
  // Save config
  // ------------------------------------------------------------------

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('clawforlife_token');
      const res = await fetch('/api/voice/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...config,
          transfer_number: config.transfer_number || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to save');
      }

      setMessage({ type: 'success', text: 'Voice configuration saved successfully.' });
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Failed to save configuration.';
      setMessage({ type: 'error', text });
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // Service management
  // ------------------------------------------------------------------

  const addService = () => {
    if (!newService.trim()) return;
    setConfig({ ...config, services: [...config.services, newService.trim()] });
    setNewService('');
  };

  const removeService = (index: number) => {
    setConfig({ ...config, services: config.services.filter((_, i) => i !== index) });
  };

  // ------------------------------------------------------------------
  // FAQ management
  // ------------------------------------------------------------------

  const addFaq = () => {
    if (!newFaq.question.trim() || !newFaq.answer.trim()) return;
    setConfig({ ...config, faq: [...config.faq, { ...newFaq }] });
    setNewFaq({ question: '', answer: '' });
  };

  const removeFaq = (index: number) => {
    setConfig({ ...config, faq: config.faq.filter((_, i) => i !== index) });
  };

  // ------------------------------------------------------------------
  // Business hours
  // ------------------------------------------------------------------

  const toggleDay = (day: string) => {
    const current = config.business_hours[day];
    setConfig({
      ...config,
      business_hours: {
        ...config.business_hours,
        [day]: current ? null : { open: '09:00', close: '17:00' },
      },
    });
  };

  const updateHours = (day: string, field: 'open' | 'close', value: string) => {
    const current = config.business_hours[day];
    if (!current) return;
    setConfig({
      ...config,
      business_hours: {
        ...config.business_hours,
        [day]: { ...current, [field]: value },
      },
    });
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
        Loading voice configuration...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        AI Voice Answering
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 32 }}>
        Configure your AI phone receptionist. Calls are answered automatically
        with natural-sounding voice responses powered by AI.
      </p>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 24,
            background: message.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: message.type === 'success' ? '#22c55e' : '#ef4444',
            fontSize: 14,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Business Info */}
      <Section title="Business Information">
        <Field label="Business Name">
          <Input
            value={config.business_name}
            onChange={(v) => setConfig({ ...config, business_name: v })}
            placeholder="Acme Services LLC"
          />
        </Field>

        <Field label="Industry">
          <Select
            value={config.industry}
            onChange={(v) => setConfig({ ...config, industry: v })}
            options={industryOptions.map((i) => ({ value: i, label: i.replace(/_/g, ' ') }))}
          />
        </Field>

        <Field label="Timezone">
          <Input
            value={config.timezone}
            onChange={(v) => setConfig({ ...config, timezone: v })}
            placeholder="America/Los_Angeles"
          />
        </Field>
      </Section>

      {/* Voice Settings */}
      <Section title="Voice Settings">
        <Field label="AI Voice">
          <Select
            value={config.voice_id}
            onChange={(v) => setConfig({ ...config, voice_id: v })}
            options={voiceOptions.map((v) => ({
              value: v.id,
              label: `${v.name} — ${v.description}`,
            }))}
          />
        </Field>

        <Field label="Greeting Template">
          <textarea
            value={config.greeting_template}
            onChange={(e) => setConfig({ ...config, greeting_template: e.target.value })}
            placeholder="Hi, thanks for calling {business_name}. How can I help you?"
            rows={3}
            style={textareaStyle}
          />
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>
            Use {'{business_name}'} and {'{caller_name}'} as placeholders.
          </p>
        </Field>

        <Field label="Transfer Number">
          <Input
            value={config.transfer_number}
            onChange={(v) => setConfig({ ...config, transfer_number: v })}
            placeholder="+15551234567 (owner's cell)"
          />
        </Field>

        <Field label="Max Call Duration (seconds)">
          <Input
            value={String(config.max_call_duration_seconds)}
            onChange={(v) => setConfig({ ...config, max_call_duration_seconds: parseInt(v, 10) || 600 })}
            placeholder="600"
          />
        </Field>
      </Section>

      {/* Business Hours */}
      <Section title="Business Hours">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DAYS.map((day) => {
            const hours = config.business_hours[day];
            const isOpen = hours !== null;
            return (
              <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ width: 100, color: 'rgba(255,255,255,0.6)', fontSize: 13, textTransform: 'capitalize' }}>
                  {day}
                </label>
                <button
                  onClick={() => toggleDay(day)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 4,
                    border: 'none',
                    background: isOpen ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                    color: isOpen ? '#22c55e' : '#ef4444',
                    fontSize: 11,
                    cursor: 'pointer',
                    width: 60,
                  }}
                >
                  {isOpen ? 'Open' : 'Closed'}
                </button>
                {isOpen && hours && (
                  <>
                    <input
                      type="time"
                      value={hours.open}
                      onChange={(e) => updateHours(day, 'open', e.target.value)}
                      style={timeInputStyle}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>to</span>
                    <input
                      type="time"
                      value={hours.close}
                      onChange={(e) => updateHours(day, 'close', e.target.value)}
                      style={timeInputStyle}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Services */}
      <Section title="Services Offered">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {config.services.map((service, i) => (
            <span
              key={i}
              style={{
                padding: '4px 12px',
                borderRadius: 16,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {service}
              <button
                onClick={() => removeService(i)}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: 0 }}
              >
                x
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            value={newService}
            onChange={setNewService}
            placeholder="Add a service..."
            onKeyDown={(e) => e.key === 'Enter' && addService()}
          />
          <button onClick={addService} style={addBtnStyle}>Add</button>
        </div>
      </Section>

      {/* FAQ */}
      <Section title="Frequently Asked Questions">
        {config.faq.map((entry, i) => (
          <div
            key={i}
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <strong style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Q: {entry.question}</strong>
              <button
                onClick={() => removeFaq(i)}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
              >
                Remove
              </button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>A: {entry.answer}</p>
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <Input value={newFaq.question} onChange={(v) => setNewFaq({ ...newFaq, question: v })} placeholder="Question..." />
          <Input value={newFaq.answer} onChange={(v) => setNewFaq({ ...newFaq, answer: v })} placeholder="Answer..." />
          <button onClick={addFaq} style={addBtnStyle}>Add FAQ</button>
        </div>
      </Section>

      {/* Save Button */}
      <div style={{ marginTop: 32, marginBottom: 48 }}>
        <button onClick={handleSave} disabled={saving} style={saveBtnStyle}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Call Logs */}
      <Section title="Recent Call Logs">
        {callLogs.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            No voice calls recorded yet. Calls will appear here once Twilio is connected.
          </p>
        ) : (
          callLogs.map((log) => (
            <div
              key={log.id}
              style={{
                padding: 12,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                marginBottom: 8,
                cursor: 'pointer',
              }}
              onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                  {log.properties.caller_number ?? 'Unknown'}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                  {log.properties.status ?? 'completed'}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                  {log.properties.duration_seconds ?? 0}s
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                  {log.properties.turn_count ?? 0} turns
                </span>
              </div>
              {expandedLog === log.id && log.properties.transcript && (
                <pre
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 6,
                    background: 'rgba(0,0,0,0.3)',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 300,
                    overflow: 'auto',
                  }}
                >
                  {log.properties.transcript}
                </pre>
              )}
            </div>
          ))
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginBottom: 32,
        padding: 24,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <h2 style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: 600, marginBottom: 16, marginTop: 0 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      style={inputStyle}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  fontFamily: 'inherit',
};

const timeInputStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
  fontSize: 13,
};

const addBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.7)',
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const saveBtnStyle: React.CSSProperties = {
  padding: '12px 32px',
  borderRadius: 8,
  border: 'none',
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  width: '100%',
};
