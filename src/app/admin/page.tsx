'use client';

import { useEffect, useState } from 'react';
import StatCard from '@/components/admin/StatCard';
import DataTable, { type Column } from '@/components/admin/DataTable';

interface DashboardData {
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

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    delivered: 'bg-emerald-400/10 text-emerald-400',
    paid: 'bg-emerald-400/10 text-emerald-400',
    processing: 'bg-yellow-400/10 text-yellow-400',
    shipped: 'bg-blue-400/10 text-blue-400',
    cancelled: 'bg-red-400/10 text-red-400',
    refunded: 'bg-red-400/10 text-red-400',
    pending: 'bg-white/5 text-white/40',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] ?? colors.pending}`}>
      {status}
    </span>
  );
}

const orderColumns: Column<Record<string, unknown>>[] = [
  {
    key: 'order_number',
    label: 'Order',
    render: (row) => <span className="text-white font-medium">{String(row.order_number)}</span>,
  },
  {
    key: 'email',
    label: 'Customer',
    render: (row) => <span className="text-white/60">{String(row.email)}</span>,
  },
  {
    key: 'created_at',
    label: 'Date',
    sortable: true,
    render: (row) => (
      <span className="text-white/40 text-xs">
        {new Date(String(row.created_at)).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}
      </span>
    ),
  },
  {
    key: 'total_cents',
    label: 'Total',
    sortable: true,
    render: (row) => (
      <span className="text-white font-medium">${formatCents(Number(row.total_cents))}</span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => statusBadge(String(row.status)),
  },
];

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/analytics/dashboard', { credentials: 'include' });
        if (!res.ok) {
          setError('Failed to load dashboard data');
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError('Network error loading dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-white/30 mt-1">Overview of your store performance</p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Revenue"
          value={data ? formatCents(data.totalRevenueCents) : '-'}
          prefix="$"
          loading={loading}
        />
        <StatCard
          label="Orders Today"
          value={data?.ordersToday ?? '-'}
          loading={loading}
        />
        <StatCard
          label="Active Customers"
          value={data?.activeCustomers ?? '-'}
          loading={loading}
        />
        <StatCard
          label="Conversion Rate"
          value={data ? `${data.conversionRate.toFixed(1)}%` : '-'}
          loading={loading}
        />
      </div>

      {/* Two-column layout: Recent Orders + Top Skills */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Recent Orders
          </h2>
          <DataTable
            columns={orderColumns}
            data={(data?.recentOrders ?? []) as unknown as Record<string, unknown>[]}
            keyField="id"
            loading={loading}
            emptyMessage="No orders yet."
          />
        </div>

        {/* Top Skills */}
        <div>
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Top Skills
          </h2>
          <div className="bg-dark-800 border border-white/5 rounded-xl p-4 space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="h-4 bg-white/5 rounded flex-1" />
                  <div className="h-4 bg-white/5 rounded w-8" />
                </div>
              ))
            ) : data?.topSkills && data.topSkills.length > 0 ? (
              data.topSkills.map((skill, idx) => {
                const max = data.topSkills[0].count;
                const pct = max > 0 ? (skill.count / max) * 100 : 0;
                return (
                  <div key={skill.slug} className="flex items-center gap-3">
                    <span className="text-xs text-white/30 w-4">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/70 truncate">{skill.name}</div>
                      <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand/60 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-white/40 tabular-nums">{skill.count}</span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-white/30 text-center py-4">No skill data yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
