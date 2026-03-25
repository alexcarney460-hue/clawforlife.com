import { NextRequest, NextResponse } from 'next/server';
import { getAdminOrNull } from '@/lib/auth/session';
import { getDashboardStats, getConversionFunnel } from '@/lib/analytics/queries';

// ---------------------------------------------------------------------------
// GET /api/analytics/dashboard?from=2026-03-01&to=2026-03-24
// Auth: Admin only
// Response: DashboardStats + funnel steps
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
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
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Default to last 30 days if not provided
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const range = {
      from: isValidDate(from) ? from : thirtyDaysAgo.toISOString().slice(0, 10),
      to: isValidDate(to) ? to : now.toISOString().slice(0, 10),
    };

    const [stats, funnel] = await Promise.all([
      getDashboardStats(range),
      getConversionFunnel(range),
    ]);

    return NextResponse.json({
      ...stats,
      funnel,
      dateRange: range,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    console.error('[analytics/dashboard] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
