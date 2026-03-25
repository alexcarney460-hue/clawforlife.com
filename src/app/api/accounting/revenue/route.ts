/**
 * GET /api/accounting/revenue — Revenue summary (admin only)
 *
 * Query params:
 *   start  — ISO date for range start (e.g., 2026-01-01)
 *   end    — ISO date for range end (e.g., 2026-03-31)
 *   group_by — "month" (default) or "day"
 *
 * Response: { periods: [...], totals: { gross_cents, tax_cents, refund_cents, net_cents, order_count } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminOrNull } from '@/lib/auth/session';
import { getRevenueSummary } from '@/lib/accounting/queries';

export async function GET(request: NextRequest) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = request.nextUrl;
  const start = url.searchParams.get('start') ?? undefined;
  const end = url.searchParams.get('end') ?? undefined;
  const groupBy = url.searchParams.get('group_by') ?? 'month';

  // Validate date formats
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

  // Validate group_by
  if (groupBy !== 'month' && groupBy !== 'day') {
    return NextResponse.json(
      { error: 'Invalid group_by value. Must be "month" or "day".' },
      { status: 400 }
    );
  }

  try {
    const summary = await getRevenueSummary({
      start,
      end,
      group_by: groupBy,
    });

    return NextResponse.json(summary);
  } catch (err) {
    console.error('[ACCOUNTING] Failed to fetch revenue summary:', err);
    return NextResponse.json(
      { error: 'Failed to fetch revenue summary' },
      { status: 500 }
    );
  }
}
