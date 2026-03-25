/**
 * GET    /api/crm/leads/[id]  — Single lead + contact history. Admin only.
 * PATCH  /api/crm/leads/[id]  — Update a lead. Admin only.
 * DELETE /api/crm/leads/[id]  — Archive a lead (sets status to 'lost'). Admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminOrNull } from '@/lib/auth/session';
import { getLead, updateLead, archiveLead, getContactHistoryForLead } from '@/lib/crm/queries';
import type { LeadStatus } from '@/lib/types';

const VALID_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'lost'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminOrNull();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const lead = await getLead(id);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Fetch contact history for this lead
    const contactResult = await getContactHistoryForLead(id, { limit: 50 });

    return NextResponse.json({
      lead,
      contact_history: contactResult.contacts,
      contact_history_total: contactResult.total,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[API /crm/leads/[id] GET] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminOrNull();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();

    // Validate status if provided
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Build update payload — only include fields that were provided
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'email', 'phone', 'full_name', 'company', 'source',
      'status', 'notes', 'metadata', 'converted_to_customer_id',
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      );
    }

    const lead = await updateLead(id, updateData);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ lead });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[API /crm/leads/[id] PATCH] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminOrNull();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const archived = await archiveLead(id);

    if (!archived) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Lead archived' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[API /crm/leads/[id] DELETE] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
