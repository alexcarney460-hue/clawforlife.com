/**
 * Caller lookup and CRM integration.
 *
 * When a call comes in, we look up the caller's phone number against
 * the leads table in Supabase. If no match is found, a new lead is
 * automatically created so every caller is captured in the CRM.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Lead, ContactHistory } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CallerInfo {
  readonly lead: Lead;
  readonly isNewCaller: boolean;
  readonly recentInteractions: readonly ContactHistory[];
  readonly displayName: string | null;
  readonly customerStatus: 'new' | 'returning' | 'vip';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a caller by phone number. Creates a new lead if not found.
 */
export async function lookupCaller(phone: string): Promise<CallerInfo> {
  const normalised = normalisePhone(phone);
  const supabase = createServiceRoleClient();

  // Try exact match first, then normalised match
  const { data: existingLeads, error: lookupError } = await supabase
    .from('leads')
    .select('*')
    .or(`phone.eq.${normalised},phone.eq.${phone}`)
    .order('created_at', { ascending: false })
    .limit(1);

  if (lookupError) {
    console.error('[CallerLookup] Supabase lookup error:', lookupError.message);
  }

  const existingLead = existingLeads?.[0] as Lead | undefined;

  if (existingLead) {
    // Fetch recent contact history
    const recentInteractions = await getRecentInteractions(
      supabase,
      existingLead.id,
    );

    const interactionCount = recentInteractions.length;
    const customerStatus: CallerInfo['customerStatus'] =
      interactionCount >= 5 ? 'vip' : interactionCount >= 1 ? 'returning' : 'new';

    return {
      lead: existingLead,
      isNewCaller: false,
      recentInteractions,
      displayName: existingLead.full_name,
      customerStatus,
    };
  }

  // Create new lead
  const newLead = await createCallerLead(supabase, normalised);

  return {
    lead: newLead,
    isNewCaller: true,
    recentInteractions: [],
    displayName: null,
    customerStatus: 'new',
  };
}

/**
 * Update a lead's name after learning it during the call.
 */
export async function updateCallerName(
  leadId: string,
  fullName: string,
): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('leads')
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq('id', leadId);

  if (error) {
    console.error('[CallerLookup] Failed to update caller name:', error.message);
  }
}

/**
 * Log a contact interaction for the call.
 */
export async function logCallInteraction(params: {
  leadId: string;
  direction: 'inbound' | 'outbound';
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from('contact_history').insert({
    lead_id: params.leadId,
    customer_id: null,
    channel: 'phone' as const,
    direction: params.direction,
    subject: params.subject,
    body: params.body,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error('[CallerLookup] Failed to log interaction:', error.message);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a phone number to E.164-ish format.
 * Strips everything except digits and leading +.
 */
function normalisePhone(phone: string): string {
  // Remove all non-digit chars except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // If it starts with 1 and is 11 digits, add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // If it is 10 digits (US), prepend +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // If already has +, return as is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  return cleaned;
}

async function getRecentInteractions(
  supabase: ReturnType<typeof createServiceRoleClient>,
  leadId: string,
): Promise<ContactHistory[]> {
  const { data, error } = await supabase
    .from('contact_history')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[CallerLookup] Failed to fetch interactions:', error.message);
    return [];
  }

  return (data ?? []) as ContactHistory[];
}

async function createCallerLead(
  supabase: ReturnType<typeof createServiceRoleClient>,
  phone: string,
): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .insert({
      phone,
      email: null,
      full_name: null,
      company: null,
      source: 'voice_call',
      status: 'new' as const,
      converted_to_customer_id: null,
      notes: 'Auto-created from inbound voice call',
      metadata: { created_by: 'voice_system' },
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[CallerLookup] Failed to create lead:', error?.message);
    // Return a minimal fallback lead object so the call can continue
    return {
      id: 'unknown',
      phone,
      email: null,
      full_name: null,
      company: null,
      source: 'voice_call',
      status: 'new',
      converted_to_customer_id: null,
      notes: null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return data as Lead;
}

/**
 * Build a human-readable summary of the caller's history for the AI prompt.
 */
export function summariseCallerHistory(
  interactions: readonly ContactHistory[],
): string | null {
  if (interactions.length === 0) return null;

  const summary = interactions
    .slice(0, 5)
    .map((i) => {
      const date = new Date(i.created_at).toLocaleDateString('en-US');
      return `${date}: ${i.subject ?? 'Call'} (${i.direction})`;
    })
    .join('; ');

  return `Recent interactions: ${summary}`;
}
