import { NextRequest, NextResponse } from 'next/server';
import { getAdminOrNull } from '@/lib/auth/session';
import { getRevenueTimeseries } from '@/lib/analytics/queries';

// ---------------------------------------------------------------------------
// GET /api/analytics/revenue?period=day|week|month&start=2026-01-01&end=2026-03-24
// Auth: Admin only
// Response: { series: [{ date, revenueCents, orderCount }], period, dateRange }
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_PERIODS = ['day', 'week', 'month'] as const;

type Period = (typeof VALID_PERIODS)[number];

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
}

function isValidPeriod(value: unknown): value is Period {
  return typeof value === 'string' && VALID_PERIODS.includes(value as Period);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const admin = await getAdminOrNull();
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Support both "from/to" and "start/end" param names for flexibility
    const start = searchParams.get('start') ?? searchParams.get('from');
    const end = searchParams.get('end') ?? searchParams.get('to');
    const periodParam = searchParams.get('period') ?? searchParams.get('interval');

    // Defaults
    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const range = {
      from: isValidDate(start) ? start : ninetyDaysAgo.toISOString().slice(0, 10),
      to: isValidDate(end) ? end : now.toISOString().slice(0, 10),
    };

    const period: Period = isValidPeriod(periodParam) ? periodParam : 'day';

    const series = await getRevenueTimeseries(range, period);

    return NextResponse.json({
      series,
      period,
      dateRange: range,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    console.error('[analytics/revenue] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
