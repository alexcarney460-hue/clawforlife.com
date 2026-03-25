'use client';

import { useEffect, useState } from 'react';
import StatCard from '@/components/admin/StatCard';
import DataTable, { type Column } from '@/components/admin/DataTable';

interface RevenueTotals {
  gross_cents: number;
  tax_cents: number;
  refund_cents: number;
  net_cents: number;
  order_count: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  status: string;
  total_cents: number;
  tax_cents: number;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
}

interface TaxEntry {
  state: string;
  rate: number;
  taxable_amount_cents: number;
  tax_collected_cents: number;
}

interface TaxSummary {
  entries: TaxEntry[];
  total_tax_collected_cents: number;
  total_taxable_amount_cents: number;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function invoiceStatusBadge(status: string) {
  const colors: Record<string, string> = {
    paid: 'bg-emerald-400/10 text-emerald-400',
    issued: 'bg-blue-400/10 text-blue-400',
    draft: 'bg-white/5 text-white/40',
    void: 'bg-red-400/10 text-red-400',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] ?? colors.draft}`}>
      {status}
    </span>
  );
}

const invoiceColumns: Column<Record<string, unknown>>[] = [
  {
    key: 'invoice_number',
    label: 'Invoice',
    render: (row) => <span className="text-white font-medium">{String(row.invoice_number)}</span>,
  },
  {
    key: 'order_id',
    label: 'Order',
    render: (row) => (
      <span className="text-white/40 text-xs font-mono">{String(row.order_id).slice(0, 8)}...</span>
    ),
  },
  {
    key: 'total_cents',
    label: 'Total',
    sortable: true,
    render: (row) => (
      <span className="text-white">${formatCents(Number(row.total_cents))}</span>
    ),
  },
  {
    key: 'tax_cents',
    label: 'Tax',
    render: (row) => (
      <span className="text-white/50">${formatCents(Number(row.tax_cents))}</span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => invoiceStatusBadge(String(row.status)),
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
];

export default function AccountingPage() {
  const [totals, setTotals] = useState<RevenueTotals | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [revRes, invRes, taxRes] = await Promise.all([
          fetch('/api/accounting/revenue', { credentials: 'include' }),
          fetch('/api/accounting/invoices', { credentials: 'include' }),
          fetch('/api/accounting/tax', { credentials: 'include' }),
        ]);

        if (revRes.ok) {
          const revJson = await revRes.json();
          setTotals(revJson.totals ?? null);
        }
        if (invRes.ok) {
          const invJson = await invRes.json();
          setInvoices(invJson.invoices ?? []);
        }
        if (taxRes.ok) {
          const taxJson = await taxRes.json();
          setTaxSummary(taxJson);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white tracking-tight">Accounting</h1>
        <p className="text-sm text-white/30 mt-1">Revenue, invoices, and tax breakdown</p>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Gross Revenue"
          value={totals ? formatCents(totals.gross_cents) : '-'}
          prefix="$"
          loading={loading}
        />
        <StatCard
          label="Net Revenue"
          value={totals ? formatCents(totals.net_cents) : '-'}
          prefix="$"
          loading={loading}
        />
        <StatCard
          label="Tax Collected"
          value={totals ? formatCents(totals.tax_cents) : '-'}
          prefix="$"
          loading={loading}
        />
        <StatCard
          label="Refunds"
          value={totals ? formatCents(totals.refund_cents) : '-'}
          prefix="$"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice List */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Invoices
          </h2>
          <DataTable
            columns={invoiceColumns}
            data={invoices as unknown as Record<string, unknown>[]}
            keyField="id"
            loading={loading}
            emptyMessage="No invoices yet."
          />
        </div>

        {/* Tax by State */}
        <div>
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Tax by State
          </h2>
          <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex justify-between">
                    <div className="h-4 bg-white/5 rounded w-16" />
                    <div className="h-4 bg-white/5 rounded w-20" />
                  </div>
                ))}
              </div>
            ) : taxSummary?.entries && taxSummary.entries.length > 0 ? (
              <div className="space-y-3">
                {taxSummary.entries.map(entry => (
                  <div key={entry.state} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                    <div>
                      <span className="text-sm text-white/70 font-medium">{entry.state}</span>
                      <span className="text-xs text-white/30 ml-2">{(entry.rate * 100).toFixed(2)}%</span>
                    </div>
                    <span className="text-sm text-white/50 tabular-nums">
                      ${formatCents(entry.tax_collected_cents)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-xs text-white/40 font-medium uppercase">Total</span>
                  <span className="text-sm text-white font-medium tabular-nums">
                    ${formatCents(taxSummary.total_tax_collected_cents)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/30 text-center py-6">No tax data available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
