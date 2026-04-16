import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import { COMMON_AGENCIES } from '../../types';
import { PlusIcon, PencilIcon, MagnifyingGlassIcon, BuildingOfficeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '../../store/authStore';

interface Agency {
  id: number;
  agency_name: string;
  department?: string;
  acronym?: string;
  sb_contact_name?: string;
  sb_contact_email?: string;
  sb_contact_phone?: string;
  primary_contact_title?: string;
  naics_focus?: string;
  set_aside_focus?: string;
  relationship_status: string;
  notes?: string;
  last_contact_date?: string;
  last_interaction_date?: string;
  interactions?: AgencyInteraction[];
}

interface AgencyInteraction {
  id: number;
  interaction_type?: string;
  interaction_date: string;
  notes?: string;
  user_name?: string;
}

const RELATIONSHIP_STATUSES = ['Cold', 'Identified', 'Initial Contact', 'Active Relationship', 'Bidding', 'Awarded', 'Dormant', 'No Relationship'];

const EMPTY_AGENCY: Partial<Agency> = {
  agency_name: '', acronym: '', department: '', relationship_status: 'Cold',
  sb_contact_name: '', primary_contact_title: '', sb_contact_email: '',
  sb_contact_phone: '', naics_focus: '', set_aside_focus: '', notes: ''
};

export default function AgenciesPage() {
  const { user } = useAuthStore();
  const isViewer = user?.role === 'viewer';
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selected, setSelected] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState<Partial<Agency> | null>(null);
  const [saving, setSaving] = useState(false);
  const [interactionForm, setInteractionForm] = useState(false);
  const [intType, setIntType] = useState('Meeting');
  const [intNotes, setIntNotes] = useState('');
  const [intDate, setIntDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [intSaving, setIntSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (q) params.q = q;
      if (statusFilter) params.relationship_status = statusFilter;
      const { data } = await api.get('/govcon/agencies', { params });
      setAgencies(data.agencies || data || []);
    } catch { toast.error('Failed to load agencies'); }
    finally { setLoading(false); }
  }, [q, statusFilter]);

  useEffect(() => { load(); }, []);

  const selectAgency = async (a: Agency) => {
    try {
      const { data } = await api.get(`/govcon/agencies/${a.id}`);
      setSelected(data);
    } catch { setSelected(a); }
    setInteractionForm(false);
  };

  const save = async () => {
    if (!modal?.agency_name?.trim()) { toast.error('Agency name required'); return; }
    setSaving(true);
    try {
      if (modal.id) {
        const { data } = await api.put(`/govcon/agencies/${modal.id}`, modal);
        setAgencies(prev => prev.map(a => a.id === modal.id ? data : a));
        if (selected?.id === modal.id) setSelected(data);
      } else {
        const { data } = await api.post('/govcon/agencies', modal);
        setAgencies(prev => [data, ...prev]);
      }
      toast.success('Saved'); setModal(null);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const logInteraction = async () => {
    if (!selected) return;
    setIntSaving(true);
    try {
      const { data } = await api.post(`/govcon/agencies/${selected.id}/interactions`, {
        interaction_type: intType, notes: intNotes, interaction_date: intDate
      });
      setSelected(prev => prev ? { ...prev, interactions: [data, ...(prev.interactions || [])] } : prev);
      setInteractionForm(false); setIntNotes('');
      toast.success('Interaction logged');
      load();
    } catch { toast.error('Failed'); }
    finally { setIntSaving(false); }
  };

  const statusColor = (s: string) => {
    if (s === 'Active Relationship' || s === 'Awarded') return 'bg-green-900/50 text-green-400 border-green-800';
    if (s === 'Bidding') return 'bg-blue-900/50 text-blue-400 border-blue-800';
    if (s === 'Initial Contact') return 'bg-gold-900/30 text-gold-400 border-gold-800';
    if (s === 'Dormant' || s === 'No Relationship' || s === 'Cold') return 'bg-ink-700 text-ink-400 border-ink-600';
    return 'bg-purple-900/30 text-purple-400 border-purple-800';
  };

  const fmtDate = (s?: string) => { if (!s) return '—'; try { return format(parseISO(s), 'MMM d, yyyy'); } catch { return s; } };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Agency Relationship Manager</h1>
          <p className="page-sub">{agencies.length} agencies tracked</p>
        </div>
        {!isViewer && <button onClick={() => setModal({ ...EMPTY_AGENCY })} className="btn btn-gold flex items-center gap-2"><PlusIcon className="w-4 h-4" />Add Agency</button>}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input className="input pl-9" placeholder="Search agencies..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
        <select className="select w-52" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); }}>
          <option value="">All Relationship Statuses</option>
          {RELATIONSHIP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} className="btn btn-outline text-sm">Filter</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Agency List */}
        <div className="lg:col-span-1 card overflow-hidden">
          <div className="p-3 border-b border-ink-700">
            <p className="text-xs font-semibold text-ink-300 uppercase tracking-wide">{agencies.length} Agencies</p>
          </div>
          <div className="divide-y divide-ink-700 max-h-[600px] overflow-y-auto">
            {agencies.length === 0 ? (
              <div className="p-8 text-center text-ink-400 text-sm">No agencies. Click "Add Agency" to start tracking.</div>
            ) : agencies.map(a => (
              <button key={a.id} onClick={() => selectAgency(a)} className={`w-full text-left px-4 py-3 hover:bg-ink-700/50 transition-colors ${selected?.id === a.id ? 'bg-ink-700/80' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-white text-sm truncate">{a.agency_name}</span>
                  {a.acronym && <span className="text-xs text-ink-400 flex-shrink-0">{a.acronym}</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`badge text-[10px] ${statusColor(a.relationship_status)}`}>{a.relationship_status}</span>
                  {a.last_contact_date && <span className="text-[10px] text-ink-500">{fmtDate(a.last_contact_date)}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Agency Detail */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="card p-16 text-center">
              <BuildingOfficeIcon className="w-12 h-12 mx-auto mb-4 text-ink-600" />
              <p className="text-white font-medium">Select an agency</p>
              <p className="text-ink-400 text-sm mt-1">Click an agency from the list to view details</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selected.agency_name}</h2>
                    {selected.department && <p className="text-ink-400 text-sm">{selected.department}</p>}
                    {selected.acronym && <p className="text-ink-500 text-xs">{selected.acronym}</p>}
                    <div className="mt-2"><span className={`badge ${statusColor(selected.relationship_status)}`}>{selected.relationship_status}</span></div>
                  </div>
                  {!isViewer && (
                    <button onClick={() => setModal(selected)} className="btn btn-outline text-xs flex items-center gap-1"><PencilIcon className="w-3.5 h-3.5" />Edit</button>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-4 mt-4 text-sm">
                  {selected.sb_contact_name && (
                    <div>
                      <p className="text-ink-400 text-xs">Small Business Contact</p>
                      <p className="text-white font-medium">{selected.sb_contact_name}</p>
                      {selected.primary_contact_title && <p className="text-ink-400 text-xs">{selected.primary_contact_title}</p>}
                      {selected.sb_contact_email && <a href={`mailto:${selected.sb_contact_email}`} className="text-gold-400 text-xs hover:underline block">{selected.sb_contact_email}</a>}
                      {selected.sb_contact_phone && <a href={`tel:${selected.sb_contact_phone}`} className="text-xs text-ink-300 flex items-center gap-1 mt-0.5"><PhoneIcon className="w-3 h-3" />{selected.sb_contact_phone}</a>}
                    </div>
                  )}
                  <div>
                    {selected.naics_focus && <><p className="text-ink-400 text-xs">NAICS Focus</p><p className="text-ink-200 text-xs mb-2">{selected.naics_focus}</p></>}
                    {selected.set_aside_focus && <><p className="text-ink-400 text-xs">Set-Aside Focus</p><p className="text-ink-200 text-xs">{selected.set_aside_focus}</p></>}
                  </div>
                  {selected.notes && <div className="sm:col-span-2"><p className="text-ink-400 text-xs">Notes</p><p className="text-ink-200 text-xs mt-0.5">{selected.notes}</p></div>}
                </div>
              </div>

              {/* Interactions */}
              <div className="card">
                <div className="flex items-center justify-between p-4 border-b border-ink-700">
                  <h3 className="text-sm font-semibold text-white">Interactions ({(selected.interactions || []).length})</h3>
                  {!isViewer && <button onClick={() => setInteractionForm(!interactionForm)} className="btn btn-outline text-xs flex items-center gap-1"><PlusIcon className="w-3.5 h-3.5" />Log Interaction</button>}
                </div>
                {interactionForm && (
                  <div className="p-4 border-b border-ink-700 space-y-3">
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="field">
                        <label className="label">Type</label>
                        <select className="select" value={intType} onChange={e => setIntType(e.target.value)}>
                          {['Meeting', 'Email', 'Phone Call', 'Conference', 'Site Visit', 'Proposal Submission', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label className="label">Date</label>
                        <input type="date" className="input" value={intDate} onChange={e => setIntDate(e.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label className="label">Notes</label>
                      <textarea className="input" rows={2} value={intNotes} onChange={e => setIntNotes(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={logInteraction} disabled={intSaving} className="btn btn-gold text-sm">Save</button>
                      <button onClick={() => setInteractionForm(false)} className="btn btn-ghost text-sm">Cancel</button>
                    </div>
                  </div>
                )}
                <div className="divide-y divide-ink-700 max-h-[300px] overflow-y-auto">
                  {!(selected.interactions || []).length ? (
                    <div className="p-6 text-center text-ink-400 text-sm">No interactions logged.</div>
                  ) : (selected.interactions || []).map(i => (
                    <div key={i.id} className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="badge bg-ink-700 text-ink-200 border-ink-600 text-xs">{i.interaction_type || 'Interaction'}</span>
                        <span className="text-[10px] text-ink-500">{fmtDate(i.interaction_date)}</span>
                      </div>
                      {i.notes && <p className="text-xs text-ink-300 mt-1">{i.notes}</p>}
                      {i.user_name && <p className="text-[10px] text-ink-500 mt-1">by {i.user_name}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agency Modal */}
      {modal && !isViewer && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-2xl p-6 space-y-4 my-8">
            <h2 className="text-lg font-bold text-white">{modal.id ? 'Edit Agency' : 'Add Agency'}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="field">
                <label className="label">Agency Name *</label>
                <input className="input" list="known-agencies" value={modal.agency_name || ''} onChange={e => setModal(m => ({ ...m!, agency_name: e.target.value }))} />
                <datalist id="known-agencies">{COMMON_AGENCIES.map(a => <option key={a} value={a} />)}</datalist>
              </div>
              <div className="field">
                <label className="label">Acronym</label>
                <input className="input" placeholder="e.g. DOD, USAF" value={modal.acronym || ''} onChange={e => setModal(m => ({ ...m!, acronym: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Department / Sub-Agency</label>
                <input className="input" value={modal.department || ''} onChange={e => setModal(m => ({ ...m!, department: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Relationship Status</label>
                <select className="select" value={modal.relationship_status || 'Cold'} onChange={e => setModal(m => ({ ...m!, relationship_status: e.target.value }))}>
                  {RELATIONSHIP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">NAICS Focus</label>
                <input className="input" placeholder="484110, 488510..." value={modal.naics_focus || ''} onChange={e => setModal(m => ({ ...m!, naics_focus: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Set-Aside Focus</label>
                <input className="input" placeholder="WOSB, 8(a)..." value={modal.set_aside_focus || ''} onChange={e => setModal(m => ({ ...m!, set_aside_focus: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">SB Contact Name</label>
                <input className="input" value={modal.sb_contact_name || ''} onChange={e => setModal(m => ({ ...m!, sb_contact_name: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Contact Title</label>
                <input className="input" value={modal.primary_contact_title || ''} onChange={e => setModal(m => ({ ...m!, primary_contact_title: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Contact Email</label>
                <input type="email" className="input" value={modal.sb_contact_email || ''} onChange={e => setModal(m => ({ ...m!, sb_contact_email: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Contact Phone</label>
                <input className="input" value={modal.sb_contact_phone || ''} onChange={e => setModal(m => ({ ...m!, sb_contact_phone: e.target.value }))} />
              </div>
              <div className="field sm:col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" rows={3} value={modal.notes || ''} onChange={e => setModal(m => ({ ...m!, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={save} disabled={saving} className="btn btn-gold flex-1">Save</button>
              <button onClick={() => setModal(null)} className="btn btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
