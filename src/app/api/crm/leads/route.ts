/**
 * GET  /api/crm/leads  — List leads (paginated, filterable). Admin only.
 * POST /api/crm/leads  — Create a new lead. Admin only.
 *
 * Query params (GET):
 *   ?page=1        — page number (default 1)
 *   ?limit=25      — page size (max 100)
 *   ?status=new    — filter by lead status
 *   ?source=sms    — filter by lead source
 *   ?search=term   — search name/email/company/phone
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminOrNull } from '@/lib/auth/session';
import { getLeads, createLead } from '@/lib/crm/queries';
import type { LeadStatus } from '@/lib/types';

const VALID_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'lost'];

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminOrNull();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') ?? '1', 10) || 1;
    const limit = parseInt(url.searchParams.get('limit') ?? '25', 10) || 25;
    const statusParam = url.searchParams.get('status') as LeadStatus | null;
    const source = url.searchParams.get('source');
    const search = url.searchParams.get('search');

    const status = statusParam && VALID_STATUSES.includes(statusParam) ? statusParam : undefined;

    const result = await getLeads({
      page,
      limit,
      status,
      source: source ?? undefined,
      search: search ?? undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[API /crm/leads GET] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminOrNull();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate: at least email or phone must be provided
    if (!body.email && !body.phone) {
      return NextResponse.json(
        { error: 'At least one of email or phone is required' },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const lead = await createLead({
      email: body.email ?? null,
      phone: body.phone ?? null,
      full_name: body.full_name ?? null,
      company: body.company ?? null,
      source: body.source ?? null,
      converted_to_customer_id: body.converted_to_customer_id ?? null,
      notes: body.notes ?? null,
      ...(body.status ? { status: body.status } : {}),
      ...(body.metadata ? { metadata: body.metadata } : {}),
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[API /crm/leads POST] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
