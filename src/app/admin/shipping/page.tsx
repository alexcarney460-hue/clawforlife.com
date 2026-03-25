'use client';

import { useEffect, useState, useCallback } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';

interface Shipment {
  id: string;
  order_id: string;
  carrier: string | null;
  tracking_number: string | null;
  status: string;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

const SHIPMENT_STATUSES = ['all', 'label_created', 'in_transit', 'out_for_delivery', 'delivered', 'exception'] as const;

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    delivered: 'bg-emerald-400/10 text-emerald-400',
    in_transit: 'bg-yellow-400/10 text-yellow-400',
    out_for_delivery: 'bg-blue-400/10 text-blue-400',
    label_created: 'bg-white/5 text-white/40',
    exception: 'bg-red-400/10 text-red-400',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${colors[status] ?? 'bg-white/5 text-white/40'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function ShippingPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchShipments = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (status && status !== 'all') params.set('status', status);
      const res = await fetch(`/api/shipping?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setShipments(json.shipments ?? []);
        setTotal(json.total ?? 0);
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShipments(activeTab);
  }, [activeTab, fetchShipments]);

  async function updateStatus(shipmentId: string, newStatus: string) {
    setUpdating(shipmentId);
    try {
      const res = await fetch(`/api/shipping/${shipmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchShipments(activeTab);
      }
    } catch {
      // Silently handle
    } finally {
      setUpdating(null);
    }
  }

  const nextStatusMap: Record<string, string> = {
    label_created: 'in_transit',
    in_transit: 'out_for_delivery',
    out_for_delivery: 'delivered',
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'order_id',
      label: 'Order',
      render: (row) => (
        <span className="text-white font-medium font-mono text-xs">{String(row.order_id).slice(0, 8)}...</span>
      ),
    },
    {
      key: 'carrier',
      label: 'Carrier',
      render: (row) => (
        <span className="text-white/70 uppercase text-xs">{String(row.carrier || '-')}</span>
      ),
    },
    {
      key: 'tracking_number',
      label: 'Tracking',
      render: (row) => (
        <span className="text-white/50 font-mono text-xs">{String(row.tracking_number || '-')}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => statusBadge(String(row.status)),
    },
    {
      key: 'shipped_at',
      label: 'Shipped',
      sortable: true,
      render: (row) => (
        <span className="text-white/40 text-xs">
          {row.shipped_at
            ? new Date(String(row.shipped_at)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '-'}
        </span>
      ),
    },
    {
      key: 'delivered_at',
      label: 'Delivered',
      render: (row) => (
        <span className="text-white/40 text-xs">
          {row.delivered_at
            ? new Date(String(row.delivered_at)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => {
        const status = String(row.status);
        const nextStatus = nextStatusMap[status];
        if (!nextStatus) return null;
        const isUpdating = updating === String(row.id);
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateStatus(String(row.id), nextStatus);
            }}
            disabled={isUpdating}
            className="px-2.5 py-1 bg-brand/10 text-brand border border-brand/20 rounded-md text-xs font-medium hover:bg-brand/20 transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {isUpdating ? '...' : `Mark ${nextStatus.replace(/_/g, ' ')}`}
          </button>
        );
      },
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white tracking-tight">Shipping</h1>
        <p className="text-sm text-white/30 mt-1">{total} shipments</p>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-6 bg-dark-800 border border-white/5 rounded-lg p-1 w-fit overflow-x-auto">
        {SHIPMENT_STATUSES.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-brand/10 text-brand border border-brand/20'
                : 'text-white/40 hover:text-white/60 border border-transparent'
            }`}
          >
            {tab.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={shipments as unknown as Record<string, unknown>[]}
        keyField="id"
        loading={loading}
        emptyMessage="No shipments match this filter."
      />
    </div>
  );
}
