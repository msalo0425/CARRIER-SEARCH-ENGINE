import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import { DaysCountdown, formatCurrency } from '../../components/StatusBadge';
import { COMMON_AGENCIES } from '../../types';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '../../store/authStore';

interface Opportunity {
  id: number;
  title: string;
  agency_name?: string;
  solicitation_number?: string;
  naics_code?: string;
  set_aside_type?: string;
  response_due_date?: string;
  contract_value_estimate?: number;
  status: string;
  notes?: string;
  created_at: string;
}

const STATUSES = ['New', 'Monitoring', 'Bid/No Bid Decision', 'Pursuing', 'Submitted', 'Awarded', 'Not Awarded', 'Cancelled'];

const EMPTY: Partial<Opportunity> = { title: '', agency_name: '', solicitation_number: '', naics_code: '', set_aside_type: '', response_due_date: '', contract_value_estimate: undefined, status: 'Monitoring', notes: '' };

export default function OpportunitiesPage() {
  const { user } = useAuthStore();
  const isViewer = user?.role === 'viewer';
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState<Partial<Opportunity> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (q) params.q = q;
      if (agencyFilter) params.agency = agencyFilter;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/govcon/opportunities', { params });
      setOpps(data.opportunities || data || []);
    } catch { toast.error('Failed to load opportunities'); }
    finally { setLoading(false); }
  }, [q, agencyFilter, statusFilter]);

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!modal) return;
    if (!modal.title?.trim()) { toast.error('Title required'); return; }
    setSaving(true);
    try {
      if (modal.id) {
        const { data } = await api.put(`/govcon/opportunities/${modal.id}`, modal);
        setOpps(prev => prev.map(o => o.id === modal.id ? data : o));
      } else {
        const { data } = await api.post('/govcon/opportunities', modal);
        setOpps(prev => [data, ...prev]);
      }
      toast.success('Saved');
      setModal(null);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm('Delete this opportunity?')) return;
    try { await api.delete(`/govcon/opportunities/${id}`); setOpps(prev => prev.filter(o => o.id !== id)); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };

  const fmtDate = (s?: string) => { if (!s) return '—'; try { return format(parseISO(s), 'MMM d, yyyy'); } catch { return s; } };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Opportunities Tracker</h1>
          <p className="page-sub">{opps.length} active opportunities</p>
        </div>
        {!isViewer && <button onClick={() => setModal({ ...EMPTY })} className="btn btn-gold flex items-center gap-2"><PlusIcon className="w-4 h-4" />New Opportunity</button>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input className="input pl-9" placeholder="Search opportunities..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
        <select className="select w-52" value={agencyFilter} onChange={e => { setAgencyFilter(e.target.value); }}>
          <option value="">All Agencies</option>
          {COMMON_AGENCIES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="select w-48" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} className="btn btn-outline flex items-center gap-1"><FunnelIcon className="w-4 h-4" />Filter</button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-800 border-b border-ink-700">
            <tr>
              <th className="th text-left">Opportunity</th>
              <th className="th">Agency</th>
              <th className="th">Sol. #</th>
              <th className="th">Due Date</th>
              <th className="th">Value</th>
              <th className="th">Status</th>
              {!isViewer && <th className="th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {opps.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-ink-400 text-sm">No opportunities found. Click "New Opportunity" to add one.</td></tr>
            ) : opps.map(o => (
              <tr key={o.id} className="tr-hover">
                <td className="td">
                  <div className="font-medium text-white max-w-[250px] truncate">{o.title}</div>
                  {o.naics_code && <div className="text-xs text-ink-400">NAICS {o.naics_code}{o.set_aside_type ? ` · ${o.set_aside_type}` : ''}</div>}
                </td>
                <td className="td text-center text-xs text-ink-300 max-w-[140px]"><span className="truncate block">{o.agency_name}</span></td>
                <td className="td text-center font-mono text-xs text-ink-300">{o.solicitation_number || '—'}</td>
                <td className="td text-center">
                  <DaysCountdown date={o.response_due_date || null} />
                  <div className="text-[10px] text-ink-500 mt-0.5">{fmtDate(o.response_due_date)}</div>
                </td>
                <td className="td text-center text-ink-300 text-xs">{formatCurrency(o.contract_value_estimate)}</td>
                <td className="td text-center">
                  <span className={`badge text-xs ${
                    o.status === 'Awarded' ? 'bg-green-900/50 text-green-400 border-green-800' :
                    o.status === 'Pursuing' ? 'bg-blue-900/50 text-blue-400 border-blue-800' :
                    o.status === 'Submitted' ? 'bg-purple-900/50 text-purple-400 border-purple-800' :
                    o.status === 'Not Awarded' || o.status === 'Cancelled' ? 'bg-red-900/30 text-red-400 border-red-800' :
                    'bg-ink-700 text-ink-300 border-ink-600'
                  }`}>{o.status}</span>
                </td>
                {!isViewer && (
                  <td className="td">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setModal(o)} className="btn btn-ghost py-0.5 px-2 text-xs text-blue-400"><PencilIcon className="w-3.5 h-3.5" /></button>
                      <button onClick={() => del(o.id)} className="btn btn-ghost py-0.5 px-2 text-xs text-red-400"><TrashIcon className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && !isViewer && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-2xl p-6 space-y-4 my-8">
            <h2 className="text-lg font-bold text-white">{modal.id ? 'Edit Opportunity' : 'New Opportunity'}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="field sm:col-span-2">
                <label className="label">Title *</label>
                <input className="input" value={modal.title || ''} onChange={e => setModal(m => ({ ...m!, title: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Agency *</label>
                <input className="input" list="agencies-list" value={modal.agency_name || ''} onChange={e => setModal(m => ({ ...m!, agency: e.target.value }))} />
                <datalist id="agencies-list">{COMMON_AGENCIES.map(a => <option key={a} value={a} />)}</datalist>
              </div>
              <div className="field">
                <label className="label">Status</label>
                <select className="select" value={modal.status || 'Monitoring'} onChange={e => setModal(m => ({ ...m!, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Solicitation Number</label>
                <input className="input" value={modal.solicitation_number || ''} onChange={e => setModal(m => ({ ...m!, solicitation_number: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">NAICS Code</label>
                <input className="input" value={modal.naics_code || ''} onChange={e => setModal(m => ({ ...m!, naics_code: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Set-Aside</label>
                <input className="input" placeholder="e.g. WOSB, 8(a), SDVOSB" value={modal.set_aside_type || ''} onChange={e => setModal(m => ({ ...m!, set_aside: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Response Due Date</label>
                <input type="date" className="input" value={modal.response_due_date || ''} onChange={e => setModal(m => ({ ...m!, response_due_date: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Estimated Value ($)</label>
                <input type="number" className="input" value={modal.contract_value_estimate || ''} onChange={e => setModal(m => ({ ...m!, estimated_value: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div className="field sm:col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" rows={3} value={modal.notes || ''} onChange={e => setModal(m => ({ ...m!, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={save} disabled={saving} className="btn btn-gold flex-1">Save</button>
              <button onClick={() => setModal(null)} className="btn btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
