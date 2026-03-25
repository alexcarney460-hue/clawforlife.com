/**
 * GET  /api/crm/contacts  — List contact history (paginated, filterable). Admin only.
 * POST /api/crm/contacts  — Log a new contact (call, email, sms, meeting, note). Admin only.
 *
 * Query params (GET):
 *   ?page=1           — page number (default 1)
 *   ?limit=25         — page size (max 100)
 *   ?lead_id=uuid     — filter by lead
 *   ?customer_id=uuid — filter by customer
 *   ?channel=email    — filter by channel
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminOrNull } from '@/lib/auth/session';
import { getContactHistory, createContactEntry } from '@/lib/crm/queries';
import type { ContactChannel, ContactDirection } from '@/lib/types';

const VALID_CHANNELS: ContactChannel[] = ['email', 'phone', 'sms', 'telegram', 'manual'];
const VALID_DIRECTIONS: ContactDirection[] = ['inbound', 'outbound'];

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminOrNull();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') ?? '1', 10) || 1;
    const limit = parseInt(url.searchParams.get('limit') ?? '25', 10) || 25;
    const lead_id = url.searchParams.get('lead_id') ?? undefined;
    const customer_id = url.searchParams.get('customer_id') ?? undefined;
    const channel = url.searchParams.get('channel') ?? undefined;

    // Validate channel if provided
    if (channel && !VALID_CHANNELS.includes(channel as ContactChannel)) {
      return NextResponse.json(
        { error: `Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await getContactHistory({
      page,
      limit,
      lead_id,
      customer_id,
      channel,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[API /crm/contacts GET] Error:', message);
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

    // Validate: at least one of lead_id or customer_id is required
    if (!body.lead_id && !body.customer_id) {
      return NextResponse.json(
        { error: 'At least one of lead_id or customer_id is required' },
        { status: 400 }
      );
    }

    // Validate channel
    if (!body.channel || !VALID_CHANNELS.includes(body.channel)) {
      return NextResponse.json(
        { error: `channel is required and must be one of: ${VALID_CHANNELS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate direction
    if (!body.direction || !VALID_DIRECTIONS.includes(body.direction)) {
      return NextResponse.json(
        { error: `direction is required and must be one of: ${VALID_DIRECTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    const entry = await createContactEntry({
      lead_id: body.lead_id ?? null,
      customer_id: body.customer_id ?? null,
      channel: body.channel,
      direction: body.direction,
      subject: body.subject ?? null,
      body: body.body ?? null,
      ...(body.metadata ? { metadata: body.metadata } : {}),
    });

    return NextResponse.json({ contact: entry }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[API /crm/contacts POST] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
