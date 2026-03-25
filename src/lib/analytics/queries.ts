import { createServiceRoleClient } from '@/lib/supabase/server';
import type { AnalyticsEventInsert } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardStats {
  totalRevenueCents: number;
  ordersToday: number;
  ordersTotal: number;
  activeCustomers: number;
  conversionRate: number;
  avgOrderValueCents: number;
  topSkills: Array<{ slug: string; name: string; count: number }>;
  recentOrders: Array<{
    id: string;
    order_number: string;
    email: string;
    total_cents: number;
    status: string;
    created_at: string;
  }>;
}

export interface RevenueDataPoint {
  date: string;
  revenueCents: number;
  orderCount: number;
}

export interface FunnelStep {
  name: string;
  count: number;
  rate: number;
}

export interface DateRange {
  from: string; // ISO date string YYYY-MM-DD
  to: string;
}

// ---------------------------------------------------------------------------
// trackEvent — insert a single analytics event
// ---------------------------------------------------------------------------

export async function trackEvent(
  event: Omit<AnalyticsEventInsert, 'event_type'> & { event_type: string }
): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from('analytics_events').insert({
    event_type: event.event_type,
    session_id: event.session_id ?? null,
    customer_id: event.customer_id ?? null,
    page_url: event.page_url ?? null,
    referrer: event.referrer ?? null,
    utm_source: event.utm_source ?? null,
    utm_medium: event.utm_medium ?? null,
    utm_campaign: event.utm_campaign ?? null,
    properties: event.properties ?? {},
  });

  if (error) {
    console.error('[analytics] Failed to track event:', error.message);
    // Non-critical — do not throw. Analytics should never break the user flow.
  }
}

// ---------------------------------------------------------------------------
// getDashboardStats — aggregate metrics for admin dashboard
// ---------------------------------------------------------------------------

export async function getDashboardStats(
  range: DateRange
): Promise<DashboardStats> {
  const supabase = createServiceRoleClient();

  const from = `${range.from}T00:00:00Z`;
  const to = `${range.to}T23:59:59Z`;

  // Run independent queries in parallel for performance
  const [
    revenueResult,
    ordersTodayResult,
    activeCustomersResult,
    topSkillsResult,
    recentOrdersResult,
    pageViewsResult,
    purchasesResult,
  ] = await Promise.all([
    // Total revenue + order count in date range (paid orders only)
    supabase
      .from('orders')
      .select('total_cents')
      .gte('created_at', from)
      .lte('created_at', to)
      .in('status', ['paid', 'processing', 'shipped', 'delivered']),

    // Orders created today
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
      .in('status', ['paid', 'processing', 'shipped', 'delivered']),

    // Distinct customers with orders in range
    supabase
      .from('orders')
      .select('customer_id')
      .gte('created_at', from)
      .lte('created_at', to)
      .not('customer_id', 'is', null)
      .in('status', ['paid', 'processing', 'shipped', 'delivered']),

    // Top skills by entitlement count
    supabase
      .from('skill_entitlements')
      .select('skill_slug, product_id')
      .eq('active', true)
      .gte('created_at', from)
      .lte('created_at', to)
      .limit(500),

    // Recent orders (last 10)
    supabase
      .from('orders')
      .select('id, order_number, email, total_cents, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10),

    // Page views in range (for conversion rate)
    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'page_view')
      .gte('created_at', from)
      .lte('created_at', to),

    // Purchase events in range (for conversion rate)
    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'purchase')
      .gte('created_at', from)
      .lte('created_at', to),
  ]);

  // Aggregate revenue
  const orders = revenueResult.data ?? [];
  const totalRevenueCents = orders.reduce(
    (sum: number, o: { total_cents: number }) => sum + (o.total_cents ?? 0),
    0
  );
  const ordersTotal = orders.length;
  const avgOrderValueCents =
    ordersTotal > 0 ? Math.round(totalRevenueCents / ordersTotal) : 0;

  // Unique active customers
  const customerIds = new Set(
    (activeCustomersResult.data ?? [])
      .map((r: { customer_id: string | null }) => r.customer_id)
      .filter(Boolean)
  );

  // Top skills — aggregate in JS since Supabase doesn't support GROUP BY via client
  const skillCounts = new Map<string, number>();
  for (const ent of topSkillsResult.data ?? []) {
    const slug = ent.skill_slug;
    skillCounts.set(slug, (skillCounts.get(slug) ?? 0) + 1);
  }
  const topSkills = Array.from(skillCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([slug, count]) => ({ slug, name: slug, count }));

  // Conversion rate: purchases / page_views
  const pageViews = pageViewsResult.count ?? 0;
  const purchases = purchasesResult.count ?? 0;
  const conversionRate =
    pageViews > 0 ? Number(((purchases / pageViews) * 100).toFixed(2)) : 0;

  return {
    totalRevenueCents,
    ordersToday: ordersTodayResult.count ?? 0,
    ordersTotal,
    activeCustomers: customerIds.size,
    conversionRate,
    avgOrderValueCents,
    topSkills,
    recentOrders: (recentOrdersResult.data ?? []).map((o: { id: string; order_number: string; email: string; total_cents: number; status: string; created_at: string }) => ({
      id: o.id,
      order_number: o.order_number,
      email: o.email,
      total_cents: o.total_cents,
      status: o.status,
      created_at: o.created_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// getRevenueTimeseries — daily/weekly/monthly revenue for charts
// ---------------------------------------------------------------------------

export async function getRevenueTimeseries(
  range: DateRange,
  period: 'day' | 'week' | 'month'
): Promise<RevenueDataPoint[]> {
  const supabase = createServiceRoleClient();

  const from = `${range.from}T00:00:00Z`;
  const to = `${range.to}T23:59:59Z`;

  const { data: orders, error } = await supabase
    .from('orders')
    .select('total_cents, created_at')
    .gte('created_at', from)
    .lte('created_at', to)
    .in('status', ['paid', 'processing', 'shipped', 'delivered'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[analytics] Revenue timeseries query failed:', error.message);
    return [];
  }

  // Bucket orders by period
  const buckets = new Map<string, { revenueCents: number; orderCount: number }>();

  for (const order of orders ?? []) {
    const key = bucketKey(order.created_at, period);
    const existing = buckets.get(key) ?? { revenueCents: 0, orderCount: 0 };
    existing.revenueCents += order.total_cents;
    existing.orderCount += 1;
    buckets.set(key, existing);
  }

  // Fill gaps so the chart has continuous data points
  const filled = fillDateGaps(range.from, range.to, period, buckets);
  return filled;
}

// ---------------------------------------------------------------------------
// getTopSkills — most installed skills (for dashboard widgets)
// ---------------------------------------------------------------------------

export async function getTopSkills(
  range: DateRange,
  limit = 10
): Promise<Array<{ slug: string; name: string; count: number }>> {
  const supabase = createServiceRoleClient();

  const from = `${range.from}T00:00:00Z`;
  const to = `${range.to}T23:59:59Z`;

  const { data, error } = await supabase
    .from('skill_entitlements')
    .select('skill_slug')
    .eq('active', true)
    .gte('created_at', from)
    .lte('created_at', to)
    .limit(1000);

  if (error) {
    console.error('[analytics] Top skills query failed:', error.message);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.skill_slug, (counts.get(row.skill_slug) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slug, count]) => ({ slug, name: slug, count }));
}

// ---------------------------------------------------------------------------
// getConversionFunnel — step-by-step drop-off analysis
// ---------------------------------------------------------------------------

export async function getConversionFunnel(
  range: DateRange
): Promise<FunnelStep[]> {
  const supabase = createServiceRoleClient();

  const from = `${range.from}T00:00:00Z`;
  const to = `${range.to}T23:59:59Z`;

  const steps = [
    'page_view',
    'add_to_cart',
    'checkout_start',
    'purchase',
  ] as const;

  // Count each step in parallel
  const results = await Promise.all(
    steps.map((eventType) =>
      supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', eventType)
        .gte('created_at', from)
        .lte('created_at', to)
    )
  );

  const counts = results.map((r: { count: number | null }) => r.count ?? 0);
  const topCount = counts[0] || 1; // avoid division by zero

  return steps.map((name, i) => ({
    name,
    count: counts[i],
    rate: Number(((counts[i] / topCount) * 100).toFixed(2)),
  }));
}

// ---------------------------------------------------------------------------
// Helpers (private)
// ---------------------------------------------------------------------------

function bucketKey(isoDate: string, period: 'day' | 'week' | 'month'): string {
  const d = new Date(isoDate);
  if (period === 'day') {
    return d.toISOString().slice(0, 10);
  }
  if (period === 'week') {
    // ISO week start (Monday)
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
    return monday.toISOString().slice(0, 10);
  }
  // month
  return d.toISOString().slice(0, 7) + '-01';
}

function fillDateGaps(
  from: string,
  to: string,
  period: 'day' | 'week' | 'month',
  buckets: Map<string, { revenueCents: number; orderCount: number }>
): RevenueDataPoint[] {
  const result: RevenueDataPoint[] = [];
  const current = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T23:59:59Z');

  while (current <= end) {
    const key = bucketKey(current.toISOString(), period);
    const data = buckets.get(key) ?? { revenueCents: 0, orderCount: 0 };
    result.push({ date: key, ...data });

    // Advance cursor
    if (period === 'day') {
      current.setUTCDate(current.getUTCDate() + 1);
    } else if (period === 'week') {
      current.setUTCDate(current.getUTCDate() + 7);
    } else {
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
  }

  // Deduplicate (week/month boundaries can create dupes)
  const seen = new Set<string>();
  return result.filter((p) => {
    if (seen.has(p.date)) return false;
    seen.add(p.date);
    return true;
  });
}
