/**
 * GET /api/accounting/invoices — List invoices (admin only)
 * POST /api/accounting/invoices — Create invoice from order (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminOrNull } from '@/lib/auth/session';
import { createInvoice, getInvoices } from '@/lib/accounting/queries';
import type { InvoiceStatus } from '@/lib/types';

// ---------------------------------------------------------------------------
// GET — List invoices with pagination, status filter, date range
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = request.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '25', 10)));
  const offset = (page - 1) * limit;
  const status = url.searchParams.get('status') as InvoiceStatus | null;
  const start = url.searchParams.get('start') ?? undefined;
  const end = url.searchParams.get('end') ?? undefined;

  // Validate status if provided
  const validStatuses: InvoiceStatus[] = ['draft', 'issued', 'paid', 'void'];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
      { status: 400 }
    );
  }

  // Validate date formats if provided
  if (start && isNaN(Date.parse(start))) {
    return NextResponse.json(
      { error: 'Invalid start date format. Use ISO 8601 (e.g., 2026-01-01)' },
      { status: 400 }
    );
  }
  if (end && isNaN(Date.parse(end))) {
    return NextResponse.json(
      { error: 'Invalid end date format. Use ISO 8601 (e.g., 2026-03-31)' },
      { status: 400 }
    );
  }

  try {
    const result = await getInvoices({
      limit,
      offset,
      status: status ?? undefined,
      start,
      end,
    });

    return NextResponse.json({
      invoices: result.invoices,
      total: result.total,
      page,
      limit,
    });
  } catch (err) {
    console.error('[ACCOUNTING] Failed to fetch invoices:', err);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create invoice from an order
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { order_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.order_id || typeof body.order_id !== 'string') {
    return NextResponse.json(
      { error: 'Missing required field: order_id (string)' },
      { status: 400 }
    );
  }

  // Basic UUID format validation
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(body.order_id)) {
    return NextResponse.json(
      { error: 'Invalid order_id format. Must be a UUID.' },
      { status: 400 }
    );
  }

  try {
    const invoice = await createInvoice({ order_id: body.order_id });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    // Distinguish between "not found" and "duplicate" vs internal errors
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('already exists')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    console.error('[ACCOUNTING] Failed to create invoice:', err);
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}
