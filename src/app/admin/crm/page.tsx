'use client';

import { useEffect, useState, useCallback } from 'react';
import DataTable, { type Column } from '@/components/admin/DataTable';

interface Lead {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

const LEAD_STATUSES = ['all', 'new', 'contacted', 'qualified', 'converted', 'lost'] as const;

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    new: 'bg-blue-400/10 text-blue-400',
    contacted: 'bg-yellow-400/10 text-yellow-400',
    qualified: 'bg-emerald-400/10 text-emerald-400',
    converted: 'bg-brand/10 text-brand',
    lost: 'bg-red-400/10 text-red-400',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] ?? 'bg-white/5 text-white/40'}`}>
      {status}
    </span>
  );
}

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedLead, setExpandedLead] = useState<Lead | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    company: '',
    source: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (activeTab !== 'all') params.set('status', activeTab);
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/crm/leads?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setLeads(json.leads ?? []);
        setTotal(json.total ?? 0);
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    const timeout = setTimeout(fetchLeads, search ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [fetchLeads, search]);

  async function handleRowClick(row: Record<string, unknown>) {
    const id = String(row.id);
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedLead(null);
      return;
    }
    setExpandedId(id);
    try {
      const res = await fetch(`/api/crm/leads/${id}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setExpandedLead(json.lead ?? json);
      }
    } catch {
      // Silently handle
    }
  }

  async function handleAddLead(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.email && !formData.phone) return;
    setSubmitting(true);
    try {
      const body: Record<string, string> = {};
      if (formData.full_name) body.full_name = formData.full_name;
      if (formData.email) body.email = formData.email;
      if (formData.phone) body.phone = formData.phone;
      if (formData.company) body.company = formData.company;
      if (formData.source) body.source = formData.source;
      if (formData.notes) body.notes = formData.notes;

      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowAddForm(false);
        setFormData({ full_name: '', email: '', phone: '', company: '', source: '', notes: '' });
        fetchLeads();
      }
    } catch {
      // Silently handle
    } finally {
      setSubmitting(false);
    }
  }

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'company',
      label: 'Company',
      render: (row) => (
        <span className="text-white font-medium">{String(row.company || '-')}</span>
      ),
    },
    {
      key: 'full_name',
      label: 'Contact',
      render: (row) => (
        <span className="text-white/70">{String(row.full_name || '-')}</span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (row) => (
        <span className="text-white/50 text-xs">{String(row.email || '-')}</span>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (row) => (
        <span className="text-white/50 text-xs">{String(row.phone || '-')}</span>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      render: (row) => (
        <span className="text-white/40 text-xs capitalize">{String(row.source || '-')}</span>
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">CRM</h1>
          <p className="text-sm text-white/30 mt-1">{total} leads</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-brand/10 text-brand border border-brand/20 rounded-lg text-sm font-medium hover:bg-brand/20 transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add Lead'}
        </button>
      </div>

      {/* Add Lead Form */}
      {showAddForm && (
        <form onSubmit={handleAddLead} className="bg-dark-800 border border-white/5 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">New Lead</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {(['full_name', 'email', 'phone', 'company', 'source'] as const).map(field => (
              <div key={field}>
                <label className="text-xs text-white/30 capitalize mb-1 block">
                  {field.replace('_', ' ')}
                </label>
                <input
                  type={field === 'email' ? 'email' : 'text'}
                  value={formData[field]}
                  onChange={(e) => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
                  className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:border-brand/30 focus:outline-none transition-colors"
                  placeholder={field === 'email' ? 'email@example.com' : ''}
                />
              </div>
            ))}
          </div>
          <div className="mb-4">
            <label className="text-xs text-white/30 mb-1 block">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:border-brand/30 focus:outline-none transition-colors h-20 resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || (!formData.email && !formData.phone)}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Save Lead'}
          </button>
        </form>
      )}

      {/* Search + Status Tabs */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leads..."
          className="flex-1 max-w-xs bg-dark-800 border border-white/5 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:border-white/10 focus:outline-none transition-colors"
        />
        <div className="flex gap-1 bg-dark-800 border border-white/5 rounded-lg p-1 w-fit">
          {LEAD_STATUSES.map(tab => (
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
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={leads as unknown as Record<string, unknown>[]}
        keyField="id"
        loading={loading}
        emptyMessage="No leads match this filter."
        onRowClick={handleRowClick}
      />

      {/* Expanded Lead Detail */}
      {expandedId && expandedLead && (
        <div className="mt-4 bg-dark-800 border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">
              {expandedLead.full_name || expandedLead.company || 'Lead Detail'}
            </h3>
            <button
              onClick={() => { setExpandedId(null); setExpandedLead(null); }}
              className="text-white/30 hover:text-white/60 text-xs"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-white/30 mb-0.5">Company</p>
              <p className="text-sm text-white/70">{expandedLead.company ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-white/30 mb-0.5">Email</p>
              <p className="text-sm text-white/70">{expandedLead.email ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-white/30 mb-0.5">Phone</p>
              <p className="text-sm text-white/70">{expandedLead.phone ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-white/30 mb-0.5">Source</p>
              <p className="text-sm text-white/70 capitalize">{expandedLead.source ?? '-'}</p>
            </div>
          </div>
          {expandedLead.notes && (
            <div>
              <p className="text-xs text-white/30 mb-1">Notes</p>
              <p className="text-sm text-white/50 whitespace-pre-wrap">{expandedLead.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
