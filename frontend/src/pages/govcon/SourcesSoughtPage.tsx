import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import { COMMON_AGENCIES } from '../../types';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '../../store/authStore';

interface SourcesSought {
  id: number;
  title: string;
  agency_name?: string;
  notice_number?: string;
  naics_code?: string;
  date_posted?: string;
  response_due_date?: string;
  response_submitted_date?: string;
  estimated_value?: number;
  co_name?: string;
  co_email?: string;
  co_phone?: string;
  follow_up_date?: string;
  outcome: string;
  status?: string;
  response_submitted?: boolean;
  notes?: string;
  created_at: string;
}

const OUTCOMES = ['Pending', 'Response Submitted', 'No Response', 'Converted to RFP', 'Cancelled', 'Not Applicable'];

const EMPTY: Partial<SourcesSought> = {
  title: '', agency_name: '', notice_number: '', naics_code: '',
  date_posted: '', response_due_date: '', outcome: 'Pending',
  co_name: '', co_email: '', co_phone: '', notes: ''
};

export default function SourcesSoughtPage() {
  const { user } = useAuthStore();
  const isViewer = user?.role === 'viewer';
  const [items, setItems] = useState<SourcesSought[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [modal, setModal] = useState<Partial<SourcesSought> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (q) params.q = q;
      if (agencyFilter) params.agency = agencyFilter;
      if (outcomeFilter) params.outcome = outcomeFilter;
      const { data } = await api.get('/govcon/sources-sought', { params });
      setItems(data.items || data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [q, agencyFilter, outcomeFilter]);

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!modal) return;
    if (!modal.title?.trim()) { toast.error('Title required'); return; }
    setSaving(true);
    try {
      if (modal.id) {
        const { data } = await api.put(`/govcon/sources-sought/${modal.id}`, modal);
        setItems(prev => prev.map(i => i.id === modal.id ? data : i));
      } else {
        const { data } = await api.post('/govcon/sources-sought', modal);
        setItems(prev => [data, ...prev]);
      }
      toast.success('Saved'); setModal(null);
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm('Delete?')) return;
    try { await api.delete(`/govcon/sources-sought/${id}`); setItems(prev => prev.filter(i => i.id !== id)); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };

  const fmtDate = (s?: string) => { if (!s) return '—'; try { return format(parseISO(s), 'MMM d, yyyy'); } catch { return s; } };

  const outcomeColor = (o: string) => {
    if (o === 'Response Submitted' || o === 'Converted to RFP') return 'bg-green-900/50 text-green-400 border-green-800';
    if (o === 'No Response' || o === 'Cancelled') return 'bg-ink-700 text-ink-400 border-ink-600';
    return 'bg-gold-900/30 text-gold-400 border-gold-800';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  const submitted = items.filter(i => i.outcome === 'Response Submitted' || i.response_submitted_date);
  const pending = items.filter(i => i.outcome === 'Pending');
  const converted = items.filter(i => i.outcome === 'Converted to RFP');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Sources Sought Tracker</h1>
          <p className="page-sub">{items.length} entries tracked</p>
        </div>
        {!isViewer && <button onClick={() => setModal({ ...EMPTY })} className="btn btn-gold flex items-center gap-2"><PlusIcon className="w-4 h-4" />New Entry</button>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-white">{items.length}</div>
          <div className="text-xs text-ink-400 mt-0.5">Total</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{pending.length}</div>
          <div className="text-xs text-ink-400 mt-0.5">Pending</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{submitted.length}</div>
          <div className="text-xs text-ink-400 mt-0.5">Submitted</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{converted.length}</div>
          <div className="text-xs text-ink-400 mt-0.5">Converted to RFP</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input className="input pl-9" placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
        <select className="select w-52" value={agencyFilter} onChange={e => setAgencyFilter(e.target.value)}>
          <option value="">All Agencies</option>
          {COMMON_AGENCIES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="select w-48" value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)}>
          <option value="">All Outcomes</option>
          {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <button onClick={load} className="btn btn-outline text-sm">Filter</button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-800 border-b border-ink-700">
            <tr>
              <th className="th text-left">Title</th>
              <th className="th">Agency</th>
              <th className="th">Notice #</th>
              <th className="th">Posted</th>
              <th className="th">Response Due</th>
              <th className="th">Outcome</th>
              <th className="th">CO Contact</th>
              {!isViewer && <th className="th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-ink-400 text-sm">No entries yet.</td></tr>
            ) : items.map(item => (
              <tr key={item.id} className="tr-hover">
                <td className="td">
                  <div className="font-medium text-white max-w-[220px] truncate">{item.title}</div>
                  {item.naics_code && <div className="text-xs text-ink-400">NAICS {item.naics_code}</div>}
                  {item.notes && <div className="text-xs text-ink-500 truncate max-w-[220px]">{item.notes}</div>}
                </td>
                <td className="td text-center text-xs text-ink-300"><span className="truncate block max-w-[130px]">{item.agency_name || '—'}</span></td>
                <td className="td text-center font-mono text-xs text-ink-300">{item.notice_number || '—'}</td>
                <td className="td text-center text-xs text-ink-400">{fmtDate(item.date_posted)}</td>
                <td className="td text-center text-xs text-ink-400">{fmtDate(item.response_due_date)}</td>
                <td className="td text-center">
                  <span className={`badge text-xs ${outcomeColor(item.outcome)}`}>{item.outcome}</span>
                </td>
                <td className="td text-center text-xs text-ink-400">
                  {item.co_name ? <span className="truncate block max-w-[120px]">{item.co_name}</span> : '—'}
                  {item.co_email && <a href={`mailto:${item.co_email}`} className="text-gold-400 text-[10px] hover:underline block truncate">{item.co_email}</a>}
                </td>
                {!isViewer && (
                  <td className="td">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setModal(item)} className="btn btn-ghost py-0.5 px-1.5 text-blue-400"><PencilIcon className="w-3.5 h-3.5" /></button>
                      <button onClick={() => del(item.id)} className="btn btn-ghost py-0.5 px-1.5 text-red-400"><TrashIcon className="w-3.5 h-3.5" /></button>
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
            <h2 className="text-lg font-bold text-white">{modal.id ? 'Edit Entry' : 'New Sources Sought Entry'}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="field sm:col-span-2">
                <label className="label">Title *</label>
                <input className="input" value={modal.title || ''} onChange={e => setModal(m => ({ ...m!, title: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Agency</label>
                <input className="input" list="agencies-ss" value={modal.agency_name || ''} onChange={e => setModal(m => ({ ...m!, agency_name: e.target.value }))} />
                <datalist id="agencies-ss">{COMMON_AGENCIES.map(a => <option key={a} value={a} />)}</datalist>
              </div>
              <div className="field">
                <label className="label">Outcome</label>
                <select className="select" value={modal.outcome || 'Pending'} onChange={e => setModal(m => ({ ...m!, outcome: e.target.value }))}>
                  {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Notice Number</label>
                <input className="input" value={modal.notice_number || ''} onChange={e => setModal(m => ({ ...m!, notice_number: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">NAICS Code</label>
                <input className="input" value={modal.naics_code || ''} onChange={e => setModal(m => ({ ...m!, naics_code: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Date Posted</label>
                <input type="date" className="input" value={modal.date_posted || ''} onChange={e => setModal(m => ({ ...m!, date_posted: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Response Due Date</label>
                <input type="date" className="input" value={modal.response_due_date || ''} onChange={e => setModal(m => ({ ...m!, response_due_date: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Response Submitted Date</label>
                <input type="date" className="input" value={modal.response_submitted_date || ''} onChange={e => setModal(m => ({ ...m!, response_submitted_date: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Follow-Up Date</label>
                <input type="date" className="input" value={modal.follow_up_date || ''} onChange={e => setModal(m => ({ ...m!, follow_up_date: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">CO Name</label>
                <input className="input" value={modal.co_name || ''} onChange={e => setModal(m => ({ ...m!, co_name: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">CO Email</label>
                <input type="email" className="input" value={modal.co_email || ''} onChange={e => setModal(m => ({ ...m!, co_email: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">CO Phone</label>
                <input className="input" value={modal.co_phone || ''} onChange={e => setModal(m => ({ ...m!, co_phone: e.target.value }))} />
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
