/**
 * GET /api/accounting/tax — Tax summary by state/rate (admin only)
 *
 * Query params:
 *   start — ISO date for range start (e.g., 2026-01-01)
 *   end   — ISO date for range end (e.g., 2026-03-31)
 *
 * Response: { entries: [...], total_tax_collected_cents, total_taxable_amount_cents }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminOrNull } from '@/lib/auth/session';
import { getTaxSummary } from '@/lib/accounting/queries';

export async function GET(request: NextRequest) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = request.nextUrl;
  const start = url.searchParams.get('start') ?? undefined;
  const end = url.searchParams.get('end') ?? undefined;

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

  try {
    const summary = await getTaxSummary({ start, end });
    return NextResponse.json(summary);
  } catch (err) {
    console.error('[ACCOUNTING] Failed to fetch tax summary:', err);
    return NextResponse.json(
      { error: 'Failed to fetch tax summary' },
      { status: 500 }
    );
  }
}
