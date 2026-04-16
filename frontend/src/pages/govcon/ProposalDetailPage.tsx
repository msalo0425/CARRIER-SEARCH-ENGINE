import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/client';
import { ProposalStatusBadge, DaysCountdown, formatCurrency } from '../../components/StatusBadge';
import { Proposal, SubQuote, PROPOSAL_STATUSES, COMMON_AGENCIES } from '../../types';
import { ArrowLeftIcon, PlusIcon, PencilIcon, TrashIcon, ClockIcon, CheckCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '../../store/authStore';

interface ProposalActivity { id: number; action: string; notes?: string; created_at: string; user_name?: string; }

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isViewer = user?.role === 'viewer';
  const isNew = id === 'new';

  const [proposal, setProposal] = useState<Partial<Proposal>>({
    contract_name: '', agency: '', solicitation_number: '', naics_code: '', set_aside_type: '',
    proposal_due_date: '', contract_value: undefined, status: 'Identified', notes: '',
    period_of_performance: '', place_of_performance: '',
  });
  const [subQuotes, setSubQuotes] = useState<SubQuote[]>([]);
  const [activity, setActivity] = useState<ProposalActivity[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'details' | 'subquotes' | 'activity'>('details');
  const [editing, setEditing] = useState(isNew);

  // Sub quote form
  const [sqForm, setSqForm] = useState<Partial<SubQuote> | null>(null);
  const [sqSaving, setSqSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    api.get(`/govcon/proposals/${id}`).then(({ data }) => {
      setProposal(data);
      setSubQuotes(data.sub_quotes || []);
      setActivity(data.activity || []);
    }).catch(() => toast.error('Failed to load proposal'))
    .finally(() => setLoading(false));
  }, [id, isNew]);

  const save = async () => {
    if (!proposal.contract_name?.trim()) { toast.error('Contract name required'); return; }
    if (!proposal.agency?.trim()) { toast.error('Agency required'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const { data } = await api.post('/govcon/proposals', proposal);
        toast.success('Proposal created');
        navigate(`/proposals/${data.id}`, { replace: true });
      } else {
        const { data } = await api.put(`/govcon/proposals/${id}`, proposal);
        setProposal(data);
        setActivity(data.activity || activity);
        setEditing(false);
        toast.success('Saved');
      }
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (status: string) => {
    try {
      const { data } = await api.patch(`/govcon/proposals/${id}`, { status });
      setProposal(p => ({ ...p, status }));
      setActivity(data.activity || activity);
    } catch { toast.error('Failed'); }
  };

  const saveSubQuote = async () => {
    if (!sqForm) return;
    setSqSaving(true);
    try {
      if (sqForm.id) {
        const { data } = await api.put(`/govcon/proposals/${id}/sub-quotes/${sqForm.id}`, sqForm);
        setSubQuotes(prev => prev.map(q => q.id === sqForm.id ? data : q));
      } else {
        const { data } = await api.post(`/govcon/proposals/${id}/sub-quotes`, sqForm);
        setSubQuotes(prev => [...prev, data]);
      }
      setSqForm(null); toast.success('Saved');
    } catch { toast.error('Failed'); }
    finally { setSqSaving(false); }
  };

  const deleteSubQuote = async (sqId: number) => {
    try { await api.delete(`/govcon/proposals/${id}/sub-quotes/${sqId}`); setSubQuotes(prev => prev.filter(q => q.id !== sqId)); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };

  const fmtDate = (s?: string) => { if (!s) return '—'; try { return format(parseISO(s), 'MMM d, yyyy h:mm a'); } catch { return s; } };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  const pendingSQ = subQuotes.filter(q => q.status === 'Pending' || q.status === 'Requested').length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/proposals" className="text-xs text-ink-400 hover:text-gold-400 mb-1 flex items-center gap-1"><ArrowLeftIcon className="w-3 h-3" />Back to Proposals</Link>
          <h1 className="text-2xl font-bold text-white">{isNew ? 'New Proposal' : (proposal.contract_name || 'Proposal Detail')}</h1>
          {!isNew && proposal.agency && <p className="text-ink-400 text-sm mt-0.5">{proposal.agency}</p>}
          {!isNew && proposal.status && (
            <div className="flex items-center gap-3 mt-2">
              <ProposalStatusBadge status={proposal.status} />
              <DaysCountdown date={proposal.proposal_due_date || null} />
              <span className="text-ink-400 text-sm">{formatCurrency(proposal.contract_value as number)}</span>
            </div>
          )}
        </div>
        {!isNew && !isViewer && (
          <div className="flex gap-2 flex-shrink-0">
            {!editing && <button onClick={() => setEditing(true)} className="btn btn-outline flex items-center gap-1.5"><PencilIcon className="w-4 h-4" />Edit</button>}
            <select className="select text-xs" value={proposal.status} onChange={e => updateStatus(e.target.value)}>
              {PROPOSAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Status quick-change row */}
      {!isNew && !isViewer && !editing && (
        <div className="flex flex-wrap gap-2">
          {PROPOSAL_STATUSES.map(s => (
            <button key={s} onClick={() => updateStatus(s)} className={`text-xs px-2.5 py-1 rounded-full border transition-all ${proposal.status === s ? 'bg-gold-600 border-gold-500 text-white' : 'border-ink-600 text-ink-400 hover:border-gold-700 hover:text-gold-400'}`}>{s}</button>
          ))}
        </div>
      )}

      {/* Tabs */}
      {!isNew && (
        <div className="border-b border-ink-700">
          <nav className="flex gap-4">
            {(['details', 'subquotes', 'activity'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors flex items-center gap-1.5 ${tab === t ? 'border-gold-500 text-gold-400' : 'border-transparent text-ink-400 hover:text-white'}`}>
                {t === 'subquotes' ? <>Sub Quotes {pendingSQ > 0 && <span className="bg-orange-600 text-white text-[10px] px-1.5 rounded-full">{pendingSQ}</span>}</> : t === 'activity' ? 'Activity Log' : 'Details'}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Details Form */}
      {(tab === 'details' || isNew) && (
        <div className="card p-6">
          {editing || isNew ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="field sm:col-span-2">
                <label className="label">Contract Name *</label>
                <input className="input" value={proposal.contract_name || ''} onChange={e => setProposal(p => ({ ...p, contract_name: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Agency *</label>
                <input className="input" list="agencies-prop" value={proposal.agency || ''} onChange={e => setProposal(p => ({ ...p, agency: e.target.value }))} />
                <datalist id="agencies-prop">{COMMON_AGENCIES.map(a => <option key={a} value={a} />)}</datalist>
              </div>
              <div className="field">
                <label className="label">Status</label>
                <select className="select" value={proposal.status || 'Identified'} onChange={e => setProposal(p => ({ ...p, status: e.target.value }))}>
                  {PROPOSAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Solicitation Number</label>
                <input className="input" value={proposal.solicitation_number || ''} onChange={e => setProposal(p => ({ ...p, solicitation_number: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">NAICS Code</label>
                <input className="input" value={proposal.naics_code || ''} onChange={e => setProposal(p => ({ ...p, naics_code: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Set-Aside Type</label>
                <input className="input" placeholder="WOSB, 8(a), SDVOSB, Full & Open..." value={proposal.set_aside_type || ''} onChange={e => setProposal(p => ({ ...p, set_aside_type: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Proposal Due Date</label>
                <input type="date" className="input" value={proposal.proposal_due_date || ''} onChange={e => setProposal(p => ({ ...p, proposal_due_date: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Contract Value ($)</label>
                <input type="number" className="input" value={proposal.contract_value || ''} onChange={e => setProposal(p => ({ ...p, contract_value: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div className="field">
                <label className="label">Period of Performance</label>
                <input className="input" placeholder="e.g. 1 year base + 4 option years" value={proposal.period_of_performance || ''} onChange={e => setProposal(p => ({ ...p, period_of_performance: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Place of Performance</label>
                <input className="input" placeholder="City, State or Nationwide" value={proposal.place_of_performance || ''} onChange={e => setProposal(p => ({ ...p, place_of_performance: e.target.value }))} />
              </div>
              <div className="field sm:col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" rows={4} value={proposal.notes || ''} onChange={e => setProposal(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button onClick={save} disabled={saving} className="btn btn-gold">{saving ? 'Saving...' : 'Save Proposal'}</button>
                {!isNew && <button onClick={() => setEditing(false)} className="btn btn-ghost">Cancel</button>}
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Row label="Agency" val={proposal.agency} />
              <Row label="Solicitation #" val={proposal.solicitation_number} />
              <Row label="NAICS Code" val={proposal.naics_code} />
              <Row label="Set-Aside" val={proposal.set_aside_type} />
              <Row label="Proposal Due" val={proposal.proposal_due_date} />
              <Row label="Contract Value" val={formatCurrency(proposal.contract_value as number)} />
              <Row label="Period of Performance" val={proposal.period_of_performance} />
              <Row label="Place of Performance" val={proposal.place_of_performance} />
              {proposal.notes && <div className="sm:col-span-2"><p className="text-ink-400 text-xs mb-1">Notes</p><p className="text-ink-200 text-sm">{proposal.notes}</p></div>}
            </div>
          )}
        </div>
      )}

      {/* Sub Quotes */}
      {tab === 'subquotes' && !isNew && (
        <div className="space-y-4">
          {!isViewer && (
            <button onClick={() => setSqForm({ company_name: '', status: 'Not Requested', quote_amount: undefined, naics_code: '', notes: '' })} className="btn btn-gold flex items-center gap-2">
              <PlusIcon className="w-4 h-4" /> Request Sub Quote
            </button>
          )}
          {sqForm && (
            <div className="card p-5 space-y-4 max-w-xl">
              <h3 className="text-sm font-semibold text-white">Sub Quote</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="field">
                  <label className="label">Vendor Name</label>
                  <input className="input" value={sqForm.company_name || ''} onChange={e => setSqForm(q => ({ ...q!, company_name: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="label">Status</label>
                  <select className="select" value={sqForm.status || 'Not Requested'} onChange={e => setSqForm(q => ({ ...q!, status: e.target.value, quote_received: e.target.value === 'Received' || e.target.value === 'Accepted' }))}>
                    {['Not Requested', 'Requested', 'Pending', 'Received', 'Accepted', 'Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Quoted Amount ($)</label>
                  <input type="number" className="input" value={sqForm.quote_amount || ''} onChange={e => setSqForm(q => ({ ...q!, quote_amount: e.target.value ? Number(e.target.value) : undefined }))} />
                </div>
                <div className="field">
                  <label className="label">NAICS Code</label>
                  <input className="input" value={sqForm.naics_code || ''} onChange={e => setSqForm(q => ({ ...q!, naics_code: e.target.value }))} />
                </div>
                <div className="field sm:col-span-2">
                  <label className="label">Notes</label>
                  <textarea className="input" rows={2} value={sqForm.notes || ''} onChange={e => setSqForm(q => ({ ...q!, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveSubQuote} disabled={sqSaving} className="btn btn-gold flex-1">Save</button>
                <button onClick={() => setSqForm(null)} className="btn btn-ghost">Cancel</button>
              </div>
            </div>
          )}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-800 border-b border-ink-700">
                <tr>
                  <th className="th text-left">Vendor</th>
                  <th className="th">Status</th>
                  <th className="th">Amount</th>
                  <th className="th">NAICS</th>
                  <th className="th">Notes</th>
                  {!isViewer && <th className="th">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {subQuotes.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-ink-400 text-sm">No sub quotes yet.</td></tr>
                ) : subQuotes.map(sq => (
                  <tr key={sq.id} className="tr-hover">
                    <td className="td font-medium text-white">{sq.company_name}</td>
                    <td className="td text-center">
                      <span className={`badge text-xs ${sq.quote_received ? 'bg-green-900/50 text-green-400 border-green-800' : sq.status === 'Rejected' ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-orange-900/30 text-orange-400 border-orange-800'}`}>{sq.status || (sq.quote_received ? 'Received' : 'Pending')}</span>
                    </td>
                    <td className="td text-center text-ink-300">{formatCurrency(sq.quote_amount)}</td>
                    <td className="td text-center text-xs text-ink-400">{(sq as any).naics_code || '—'}</td>
                    <td className="td text-xs text-ink-400 max-w-[160px] truncate">{sq.notes || '—'}</td>
                    {!isViewer && (
                      <td className="td">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setSqForm(sq)} className="btn btn-ghost py-0.5 px-1.5 text-blue-400"><PencilIcon className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteSubQuote(sq.id)} className="btn btn-ghost py-0.5 px-1.5 text-red-400"><TrashIcon className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity Log */}
      {tab === 'activity' && !isNew && (
        <div className="card divide-y divide-ink-700">
          {activity.length === 0 ? (
            <div className="p-8 text-center text-ink-400 text-sm">No activity yet.</div>
          ) : activity.map(a => (
            <div key={a.id} className="flex gap-3 p-4">
              <div className="w-7 h-7 rounded-full bg-ink-700 flex items-center justify-center text-xs text-ink-300 flex-shrink-0 font-bold">
                {(a.user_name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm text-white">
                  <span className="font-medium">{a.user_name || 'System'}</span>
                  {' — '}<span className="text-ink-300">{a.action.replace(/_/g, ' ')}</span>
                </p>
                {a.notes && <p className="text-xs text-ink-400 mt-0.5">{a.notes}</p>}
                <p className="text-[10px] text-ink-500 mt-1">{fmtDate(a.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, val }: { label: string; val: unknown }) {
  const display = val === null || val === undefined || val === '' ? '—' : String(val);
  return (
    <div>
      <p className="text-xs text-ink-400">{label}</p>
      <p className="text-ink-200 mt-0.5">{display}</p>
    </div>
  );
}
