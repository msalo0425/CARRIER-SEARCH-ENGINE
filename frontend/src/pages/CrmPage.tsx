import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { CrmBadge, formatPhone } from '../components/StatusBadge';
import { CRM_STATUSES, CALL_OUTCOMES } from '../types';
import { PhoneIcon, ClockIcon, MagnifyingGlassIcon, CheckCircleIcon, PlusIcon, FunnelIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '../store/authStore';

interface CrmCarrier {
  dot_number: string;
  legal_name: string;
  phy_city?: string;
  phy_state?: string;
  telephone?: string;
  crm_status?: string;
  crm_notes?: string;
  in_pipeline?: boolean;
  last_contact?: string;
  follow_up_count?: number;
}

interface FollowUpToday {
  id: number;
  dot_number: string;
  carrier_name?: string;
  telephone?: string;
  due_time?: string;
  notes?: string;
}

export default function CrmPage() {
  const { user } = useAuthStore();
  const isViewer = user?.role === 'viewer';
  const [carriers, setCarriers] = useState<CrmCarrier[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpToday[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'today'>('today');

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Log call modal
  const [logModal, setLogModal] = useState<{ dot_number: string; carrier_name: string } | null>(null);
  const [callOutcome, setCallOutcome] = useState('No Answer');
  const [callNotes, setCallNotes] = useState('');
  const [callContact, setCallContact] = useState('');
  const [callSaving, setCallSaving] = useState(false);

  const loadCarriers = useCallback(async (pg = 1) => {
    try {
      const params: Record<string, string> = { page: String(pg), page_size: '50' };
      if (q) params.q = q;
      if (statusFilter) params.crm_status = statusFilter;
      const { data } = await api.get('/carriers/crm', { params });
      setCarriers(data.carriers || []);
      setTotal(data.total || 0);
      setPage(pg);
    } catch { toast.error('Failed to load CRM'); }
  }, [q, statusFilter]);

  const loadFollowUps = async () => {
    const { data } = await api.get('/carriers/follow-ups/today');
    setFollowUps(data || []);
  };

  useEffect(() => {
    Promise.all([loadCarriers(), loadFollowUps()]).finally(() => setLoading(false));
  }, []);

  const completeFollowUp = async (id: number) => {
    try {
      await api.patch(`/follow-ups/${id}/complete`);
      setFollowUps(prev => prev.filter(f => f.id !== id));
      toast.success('Done');
    } catch { toast.error('Failed'); }
  };

  const submitCall = async () => {
    if (!logModal) return;
    setCallSaving(true);
    try {
      await api.post(`/carriers/${logModal.dot_number}/calls`, { outcome: callOutcome, notes: callNotes, contact_name: callContact });
      toast.success('Call logged');
      setLogModal(null); setCallNotes(''); setCallContact(''); setCallOutcome('No Answer');
      loadCarriers(page);
    } catch { toast.error('Failed to log call'); }
    finally { setCallSaving(false); }
  };

  const fmtDate = (s?: string) => { if (!s) return '—'; try { return format(parseISO(s), 'MMM d, yyyy'); } catch { return s; } };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Cold Call CRM</h1>
          <p className="page-sub">Track outreach activity and follow-ups</p>
        </div>
        <Link to="/carriers" className="btn btn-gold flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> Find Carriers
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CRM_STATUSES.map(s => {
          const count = carriers.filter(c => c.crm_status === s).length;
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)} className={`card p-4 text-left transition-all ${statusFilter === s ? 'border-gold-600' : ''}`}>
              <div className="text-2xl font-bold text-white">{count}</div>
              <CrmBadge status={s} />
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="border-b border-ink-700">
        <nav className="flex gap-4">
          <button onClick={() => setTab('today')} className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === 'today' ? 'border-gold-500 text-gold-400' : 'border-transparent text-ink-400 hover:text-white'}`}>
            <ClockIcon className="w-4 h-4" /> Follow-Ups Today
            {followUps.length > 0 && <span className="bg-red-600 text-white text-[10px] px-1.5 rounded-full">{followUps.length}</span>}
          </button>
          <button onClick={() => setTab('all')} className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === 'all' ? 'border-gold-500 text-gold-400' : 'border-transparent text-ink-400 hover:text-white'}`}>
            <PhoneIcon className="w-4 h-4" /> All CRM Records ({total})
          </button>
        </nav>
      </div>

      {/* Today's Follow-Ups */}
      {tab === 'today' && (
        <div className="space-y-3">
          {followUps.length === 0 ? (
            <div className="card p-12 text-center">
              <CheckCircleIcon className="w-10 h-10 mx-auto mb-3 text-green-600/50" />
              <p className="text-white font-medium">All caught up!</p>
              <p className="text-ink-400 text-sm mt-1">No follow-ups due today.</p>
            </div>
          ) : followUps.map(fu => (
            <div key={fu.id} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-red-900/30 border border-red-800/50 flex items-center justify-center flex-shrink-0">
                <ClockIcon className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <Link to={`/carriers/${fu.dot_number}`} className="font-medium text-white hover:text-gold-400">
                  {fu.carrier_name || `DOT ${fu.dot_number}`}
                </Link>
                <p className="text-xs text-ink-400">{fu.due_time ? `Due at ${fu.due_time}` : 'All day'}{fu.notes && ` · ${fu.notes}`}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {fu.telephone && <a href={`tel:${fu.telephone}`} className="btn btn-gold py-1 px-3 text-xs flex items-center gap-1">
                  <PhoneIcon className="w-3 h-3" /> {formatPhone(fu.telephone)}
                </a>}
                {!isViewer && <button onClick={() => completeFollowUp(fu.id)} className="btn btn-ghost text-xs text-green-400 flex items-center gap-1">
                  <CheckCircleIcon className="w-4 h-4" /> Done
                </button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All CRM Records */}
      {tab === 'all' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input className="input pl-9" placeholder="Search carriers..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadCarriers(1)} />
            </div>
            <select className="select w-48" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); }}>
              <option value="">All Statuses</option>
              {CRM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => loadCarriers(1)} className="btn btn-outline"><FunnelIcon className="w-4 h-4" /></button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-800 border-b border-ink-700">
                <tr>
                  <th className="th text-left">Carrier</th>
                  <th className="th">Location</th>
                  <th className="th">Phone</th>
                  <th className="th">CRM Status</th>
                  <th className="th">Last Contact</th>
                  <th className="th">Follow-Ups</th>
                  {!isViewer && <th className="th">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {carriers.map(c => (
                  <tr key={c.dot_number} className="tr-hover">
                    <td className="td">
                      <Link to={`/carriers/${c.dot_number}`} className="font-medium text-white hover:text-gold-400">{c.legal_name}</Link>
                      {c.crm_notes && <p className="text-[10px] text-ink-400 truncate max-w-[200px]">{c.crm_notes}</p>}
                    </td>
                    <td className="td text-center text-ink-300 text-xs">{c.phy_city}{c.phy_state ? `, ${c.phy_state}` : ''}</td>
                    <td className="td text-center text-xs">{c.telephone ? <a href={`tel:${c.telephone}`} className="text-gold-400 hover:text-gold-300">{formatPhone(c.telephone)}</a> : '—'}</td>
                    <td className="td text-center"><CrmBadge status={c.crm_status || null} /></td>
                    <td className="td text-center text-xs text-ink-400">{fmtDate(c.last_contact)}</td>
                    <td className="td text-center">
                      {(c.follow_up_count || 0) > 0 ? <span className="badge bg-red-900/30 text-red-400 border-red-800">{c.follow_up_count}</span> : '—'}
                    </td>
                    {!isViewer && (
                      <td className="td">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setLogModal({ dot_number: c.dot_number, carrier_name: c.legal_name })} className="btn btn-ghost py-0.5 px-2 text-xs flex items-center gap-0.5 text-blue-400">
                            <PhoneIcon className="w-3 h-3" /> Log
                          </button>
                          <Link to={`/carriers/${c.dot_number}`} className="btn btn-ghost py-0.5 px-2 text-xs">View</Link>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {carriers.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-ink-400 text-sm">No CRM records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log Call Modal */}
      {logModal && !isViewer && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Log Call — {logModal.carrier_name}</h2>
            <div className="field">
              <label className="label">Outcome</label>
              <select className="select" value={callOutcome} onChange={e => setCallOutcome(e.target.value)}>
                {CALL_OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Contact Name (optional)</label>
              <input className="input" placeholder="Who did you speak with?" value={callContact} onChange={e => setCallContact(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Notes</label>
              <textarea className="input" rows={4} placeholder="Call notes..." value={callNotes} onChange={e => setCallNotes(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button onClick={submitCall} disabled={callSaving} className="btn btn-gold flex-1">Save Call</button>
              <button onClick={() => setLogModal(null)} className="btn btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
