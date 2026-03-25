'use client';

import { useEffect, useState } from 'react';

interface RevenuePoint {
  date: string;
  revenueCents: number;
  orderCount: number;
}

interface FunnelStep {
  name: string;
  count: number;
  rate: number;
}

interface DashboardData {
  topSkills: Array<{ slug: string; name: string; count: number }>;
  conversionRate: number;
  funnel: FunnelStep[];
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function AnalyticsPage() {
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [revRes, dashRes] = await Promise.all([
          fetch(`/api/analytics/revenue?period=${period}`, { credentials: 'include' }),
          fetch('/api/analytics/dashboard', { credentials: 'include' }),
        ]);

        if (revRes.ok) {
          const revJson = await revRes.json();
          setRevenue(revJson.series ?? []);
        }
        if (dashRes.ok) {
          const dashJson = await dashRes.json();
          setDashboard(dashJson);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [period]);

  const maxRevenue = Math.max(...revenue.map(r => r.revenueCents), 1);
  const maxFunnel = dashboard?.funnel?.[0]?.count ?? 1;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white tracking-tight">Analytics</h1>
        <p className="text-sm text-white/30 mt-1">Revenue trends and conversion insights</p>
      </div>

      {/* Revenue Chart */}
      <div className="bg-dark-800 border border-white/5 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider">Revenue</h2>
          <div className="flex gap-1 bg-dark-700 rounded-lg p-1">
            {(['day', 'week', 'month'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                  period === p
                    ? 'bg-brand/10 text-brand'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
          </div>
        ) : revenue.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-white/30 text-sm">
            No revenue data available.
          </div>
        ) : (
          <div>
            {/* Bar Chart */}
            <div className="flex items-end gap-1 h-48 mb-2">
              {revenue.slice(-30).map((point, idx) => {
                const height = (point.revenueCents / maxRevenue) * 100;
                return (
                  <div
                    key={idx}
                    className="flex-1 min-w-0 group relative"
                  >
                    <div
                      className="w-full bg-brand/30 hover:bg-brand/50 rounded-t transition-all duration-200 cursor-pointer"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                        <div className="text-white font-medium">${formatCents(point.revenueCents)}</div>
                        <div className="text-white/40">{point.orderCount} orders</div>
                        <div className="text-white/30">{point.date}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* X-axis labels (show first, middle, last) */}
            <div className="flex justify-between text-[10px] text-white/20">
              <span>{revenue[0]?.date ?? ''}</span>
              <span>{revenue[revenue.length - 1]?.date ?? ''}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <div className="bg-dark-800 border border-white/5 rounded-xl p-6">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-5">
            Conversion Funnel
          </h2>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 bg-white/5 rounded w-24 mb-2" />
                  <div className="h-8 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : dashboard?.funnel && dashboard.funnel.length > 0 ? (
            <div className="space-y-4">
              {dashboard.funnel.map((step, idx) => {
                const width = (step.count / maxFunnel) * 100;
                const funnelColors = [
                  'bg-brand/40',
                  'bg-brand/30',
                  'bg-brand/20',
                  'bg-brand/15',
                  'bg-brand/10',
                ];
                return (
                  <div key={step.name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-white/50 capitalize">{step.name}</span>
                      <span className="text-xs text-white/30">
                        {step.count.toLocaleString()} ({step.rate.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-8 bg-white/[0.02] rounded-lg overflow-hidden">
                      <div
                        className={`h-full ${funnelColors[idx] ?? 'bg-brand/10'} rounded-lg transition-all duration-700`}
                        style={{ width: `${Math.max(width, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-white/30 text-center py-8">No funnel data available.</p>
          )}
        </div>

        {/* Top Skills Breakdown */}
        <div className="bg-dark-800 border border-white/5 rounded-xl p-6">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-5">
            Top Skills
          </h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="h-4 bg-white/5 rounded flex-1" />
                  <div className="h-4 bg-white/5 rounded w-12" />
                </div>
              ))}
            </div>
          ) : dashboard?.topSkills && dashboard.topSkills.length > 0 ? (
            <div className="space-y-3">
              {dashboard.topSkills.map((skill, idx) => {
                const max = dashboard.topSkills[0].count;
                const pct = max > 0 ? (skill.count / max) * 100 : 0;
                return (
                  <div key={skill.slug} className="flex items-center gap-3">
                    <span className="text-xs text-white/20 w-5 text-right tabular-nums">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-white/70 truncate">{skill.name}</span>
                        <span className="text-xs text-white/30 tabular-nums ml-2">{skill.count}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand/60 to-brand/30 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-white/30 text-center py-8">No skill data available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
