'use client';

import { useEffect, useState, useCallback } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  email: string;
  total_cents: number;
  status: string;
  created_at: string;
  items?: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price_cents: number;
  }>;
}

const STATUS_TABS = ['all', 'pending', 'paid', 'processing', 'shipped', 'delivered'] as const;

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
    in_transit: 'bg-yellow-400/10 text-yellow-400',
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (status && status !== 'all') params.set('status', status);
      const res = await fetch(`/api/orders?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setOrders(json.orders ?? []);
        setTotal(json.total ?? 0);
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(activeTab);
  }, [activeTab, fetchOrders]);

  async function handleRowClick(row: Record<string, unknown>) {
    const id = String(row.id);
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedOrder(null);
      return;
    }
    setExpandedId(id);
    try {
      const res = await fetch(`/api/orders/${id}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setExpandedOrder(json.order ?? json);
      }
    } catch {
      // Silently handle
    }
  }

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'order_number',
      label: 'Order',
      render: (row) => <span className="text-white font-medium">{String(row.order_number)}</span>,
    },
    {
      key: 'email',
      label: 'Customer',
      render: (row) => <span className="text-white/60">{String(row.email ?? '-')}</span>,
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
            year: 'numeric',
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

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white tracking-tight">Orders</h1>
        <p className="text-sm text-white/30 mt-1">{total} total orders</p>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-6 bg-dark-800 border border-white/5 rounded-lg p-1 w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
              activeTab === tab
                ? 'bg-brand/10 text-brand border border-brand/20'
                : 'text-white/40 hover:text-white/60 border border-transparent'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={orders as unknown as Record<string, unknown>[]}
        keyField="id"
        loading={loading}
        emptyMessage="No orders match this filter."
        onRowClick={handleRowClick}
      />

      {/* Expanded Detail */}
      {expandedId && expandedOrder && (
        <div className="mt-4 bg-dark-800 border border-white/5 rounded-xl p-6 animate-in fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">
              Order {expandedOrder.order_number} Details
            </h3>
            <button
              onClick={() => { setExpandedId(null); setExpandedOrder(null); }}
              className="text-white/30 hover:text-white/60 text-xs"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-white/30 mb-0.5">Customer</p>
              <p className="text-sm text-white/70">{expandedOrder.email}</p>
            </div>
            <div>
              <p className="text-xs text-white/30 mb-0.5">Status</p>
              {statusBadge(expandedOrder.status)}
            </div>
            <div>
              <p className="text-xs text-white/30 mb-0.5">Total</p>
              <p className="text-sm text-white font-medium">${formatCents(expandedOrder.total_cents)}</p>
            </div>
            <div>
              <p className="text-xs text-white/30 mb-0.5">Date</p>
              <p className="text-sm text-white/70">
                {new Date(expandedOrder.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          {expandedOrder.items && expandedOrder.items.length > 0 && (
            <div>
              <p className="text-xs text-white/30 mb-2">Items</p>
              <div className="space-y-1">
                {expandedOrder.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm text-white/60 py-1 border-b border-white/5 last:border-0">
                    <span>{item.product_name} x{item.quantity}</span>
                    <span className="text-white/40">${formatCents(item.unit_price_cents * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
