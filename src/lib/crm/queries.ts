/**
 * CRM query functions for leads and contact history.
 *
 * All functions use the service-role client (bypasses RLS) because
 * CRM data is admin-only — callers are responsible for verifying
 * admin auth before invoking these.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import type {
  Lead,
  LeadInsert,
  LeadUpdate,
  LeadStatus,
  ContactHistory,
  ContactHistoryInsert,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Filter / Pagination types
// ---------------------------------------------------------------------------

export interface LeadFilters {
  status?: LeadStatus;
  source?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedLeads {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
}

export interface ContactFilters {
  lead_id?: string;
  customer_id?: string;
  channel?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedContacts {
  contacts: ContactHistory[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Lead queries
// ---------------------------------------------------------------------------

/**
 * Create a new lead.
 */
export async function createLead(data: LeadInsert): Promise<Lead> {
  const supabase = createServiceRoleClient();

  const { data: lead, error } = await supabase
    .from('leads')
    .insert(data)
    .select()
    .single();

  if (error || !lead) {
    throw new Error(`Failed to create lead: ${error?.message ?? 'Unknown error'}`);
  }

  return lead as Lead;
}

/**
 * List leads with optional filtering and pagination.
 */
export async function getLeads(filters: LeadFilters = {}): Promise<PaginatedLeads> {
  const supabase = createServiceRoleClient();
  const page = Math.max(filters.page ?? 1, 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.source) {
    query = query.eq('source', filters.source);
  }

  if (filters.search) {
    // Search across name, email, company, and phone
    const term = `%${filters.search}%`;
    query = query.or(
      `full_name.ilike.${term},email.ilike.${term},company.ilike.${term},phone.ilike.${term}`
    );
  }

  const { data: leads, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch leads: ${error.message}`);
  }

  return {
    leads: (leads ?? []) as Lead[],
    total: count ?? 0,
    page,
    limit,
  };
}

/**
 * Get a single lead by ID.
 */
export async function getLead(id: string): Promise<Lead | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to fetch lead: ${error.message}`);
  }

  return data as Lead;
}

/**
 * Update a lead by ID.
 * Returns the updated lead, or null if not found.
 */
export async function updateLead(id: string, data: LeadUpdate): Promise<Lead | null> {
  const supabase = createServiceRoleClient();

  const payload = { ...data, updated_at: new Date().toISOString() };

  const { data: lead, error } = await supabase
    .from('leads')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to update lead: ${error.message}`);
  }

  return lead as Lead;
}

/**
 * Soft-delete (archive) a lead by setting status to 'lost'.
 * Returns true if the lead existed and was archived.
 */
export async function archiveLead(id: string): Promise<boolean> {
  const supabase = createServiceRoleClient();

  const { error, count } = await supabase
    .from('leads')
    .update({ status: 'lost' as LeadStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');

  if (error) {
    throw new Error(`Failed to archive lead: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Contact history queries
// ---------------------------------------------------------------------------

/**
 * Log a new contact entry (call, email, sms, meeting, note).
 */
export async function createContactEntry(data: ContactHistoryInsert): Promise<ContactHistory> {
  const supabase = createServiceRoleClient();

  const { data: entry, error } = await supabase
    .from('contact_history')
    .insert(data)
    .select()
    .single();

  if (error || !entry) {
    throw new Error(`Failed to create contact entry: ${error?.message ?? 'Unknown error'}`);
  }

  return entry as ContactHistory;
}

/**
 * Get contact history with optional filtering by lead_id or customer_id.
 */
export async function getContactHistory(
  filters: ContactFilters = {}
): Promise<PaginatedContacts> {
  const supabase = createServiceRoleClient();
  const page = Math.max(filters.page ?? 1, 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('contact_history')
    .select('*', { count: 'exact' });

  if (filters.lead_id) {
    query = query.eq('lead_id', filters.lead_id);
  }

  if (filters.customer_id) {
    query = query.eq('customer_id', filters.customer_id);
  }

  if (filters.channel) {
    query = query.eq('channel', filters.channel);
  }

  const { data: contacts, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch contact history: ${error.message}`);
  }

  return {
    contacts: (contacts ?? []) as ContactHistory[],
    total: count ?? 0,
    page,
    limit,
  };
}

/**
 * Get contact history for a specific lead (convenience wrapper).
 */
export async function getContactHistoryForLead(
  leadId: string,
  opts: { page?: number; limit?: number } = {}
): Promise<PaginatedContacts> {
  return getContactHistory({ lead_id: leadId, ...opts });
}
