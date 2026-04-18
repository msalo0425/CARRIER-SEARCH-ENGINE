import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/client';
import { StatusBadge, SafetyBadge, OpTypeBadge, InsuranceBadge, CrmBadge, CargoTags, formatPhone } from '../../components/StatusBadge';
import { Carrier, CallLog, FollowUp, CRM_STATUSES, CALL_OUTCOMES } from '../../types';
import { PhoneIcon, ClockIcon, TruckIcon, ShieldCheckIcon, MapPinIcon, ChevronDownIcon, CheckCircleIcon, PlusIcon, StarIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '../../store/authStore';

export default function CarrierProfilePage() {
  const { dotNumber } = useParams<{ dotNumber: string }>();
  const { user } = useAuthStore();
  const isViewer = user?.role === 'viewer';

  const [carrier, setCarrier] = useState<Carrier | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'crm' | 'followups'>('overview');

  // CRM form
  const [crmStatus, setCrmStatus] = useState('');
  const [crmNotes, setCrmNotes] = useState('');
  const [inPipeline, setInPipeline] = useState(false);
  const [crmSaving, setCrmSaving] = useState(false);

  // Call log form
  const [showCallForm, setShowCallForm] = useState(false);
  const [callOutcome, setCallOutcome] = useState('No Answer');
  const [callNotes, setCallNotes] = useState('');
  const [callContact, setCallContact] = useState('');
  const [callSaving, setCallSaving] = useState(false);

  // Follow-up form
  const [showFuForm, setShowFuForm] = useState(false);
  const [fuDate, setFuDate] = useState('');
  const [fuTime, setFuTime] = useState('');
  const [fuNotes, setFuNotes] = useState('');
  const [fuSaving, setFuSaving] = useState(false);

  useEffect(() => {
    if (!dotNumber) return;
    Promise.all([
      api.get(`/carriers/${dotNumber}`),
      api.get(`/carriers/${dotNumber}/calls`),
      api.get(`/carriers/${dotNumber}/follow-ups`),
    ]).then(([c, calls, fus]) => {
      setCarrier(c.data);
      setCrmStatus(c.data.crm_status || 'New');
      setCrmNotes(c.data.crm_notes || c.data.notes || '');
      setInPipeline(c.data.is_in_pipeline || false);
      setCallLogs(calls.data || []);
      setFollowUps(fus.data || []);
    }).catch(() => toast.error('Failed to load carrier'))
    .finally(() => setLoading(false));
  }, [dotNumber]);

  const saveCrm = async () => {
    setCrmSaving(true);
    try {
      await api.patch(`/carriers/${dotNumber}/crm`, { crm_status: crmStatus, notes: crmNotes, is_in_pipeline: inPipeline });
      toast.success('CRM updated');
      if (carrier) setCarrier({ ...carrier, crm_status: crmStatus, crm_notes: crmNotes, is_in_pipeline: inPipeline });
    } catch { toast.error('Failed to save'); }
    finally { setCrmSaving(false); }
  };

  const logCall = async () => {
    setCallSaving(true);
    try {
      const { data } = await api.post(`/carriers/${dotNumber}/calls`, { outcome: callOutcome, notes: callNotes, contact_name: callContact });
      setCallLogs(prev => [data, ...prev]);
      setShowCallForm(false); setCallNotes(''); setCallContact(''); setCallOutcome('No Answer');
      if (crmStatus === 'New') { setCrmStatus('Contacted'); if (carrier) setCarrier({ ...carrier, crm_status: 'Contacted' }); }
      toast.success('Call logged');
    } catch { toast.error('Failed to log call'); }
    finally { setCallSaving(false); }
  };

  const scheduleFollowUp = async () => {
    setFuSaving(true);
    try {
      const { data } = await api.post(`/carriers/${dotNumber}/follow-ups`, { due_date: fuDate, due_time: fuTime || null, notes: fuNotes });
      setFollowUps(prev => [data, ...prev]);
      setShowFuForm(false); setFuDate(''); setFuTime(''); setFuNotes('');
      toast.success('Follow-up scheduled');
    } catch { toast.error('Failed to schedule'); }
    finally { setFuSaving(false); }
  };

  const completeFollowUp = async (id: number) => {
    try {
      await api.patch(`/follow-ups/${id}/complete`);
      setFollowUps(prev => prev.filter(f => f.id !== id));
      toast.success('Done');
    } catch { toast.error('Failed'); }
  };

  const fmtDate = (s: string) => { try { return format(parseISO(s), 'MMM d, yyyy h:mm a'); } catch { return s; } };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!carrier) return <div className="p-8 text-center text-ink-400">Carrier not found.</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Link to="/carriers" className="text-xs text-ink-400 hover:text-gold-400 mb-1 block">← Back to Search</Link>
          <h1 className="text-2xl font-bold text-ink-50">{carrier.legal_name}</h1>
          {carrier.dba_name && <p className="text-ink-400 text-sm">DBA: {carrier.dba_name}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            <StatusBadge status={carrier.operating_status || null} />
            <SafetyBadge rating={carrier.safety_rating || null} />
            <OpTypeBadge carrier={carrier} />
            <InsuranceBadge carrier={carrier} />
            <CrmBadge status={carrier.crm_status || null} />
            {carrier.is_in_pipeline && <span className="badge-gold flex items-center gap-1"><StarIcon className="w-3 h-3" /> Pipeline</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!isViewer && <button onClick={() => { setTab('crm'); setShowCallForm(true); }} className="btn btn-gold flex items-center gap-1.5"><PhoneIcon className="w-4 h-4" />Log Call</button>}
          {carrier.telephone && <a href={`tel:${carrier.telephone}`} className="btn btn-outline flex items-center gap-1.5"><PhoneIcon className="w-4 h-4" />{formatPhone(carrier.telephone)}</a>}
        </div>
      </div>

      {/* ID Pills */}
      <div className="flex flex-wrap gap-3">
        <div className="bg-ink-800 rounded-lg px-4 py-2">
          <div className="text-[10px] text-ink-400 uppercase tracking-wide">DOT Number</div>
          <div className="font-mono text-ink-50 font-bold">{carrier.dot_number}</div>
        </div>
        {(carrier.mc_mx_ff_number || carrier.mc_number) && <div className="bg-ink-800 rounded-lg px-4 py-2">
          <div className="text-[10px] text-ink-400 uppercase tracking-wide">MC / MX / FF</div>
          <div className="font-mono text-ink-50 font-bold">{carrier.mc_mx_ff_number || carrier.mc_number}</div>
        </div>}
      </div>

      {/* Tabs */}
      <div className="border-b border-ink-700">
        <nav className="flex gap-4">
          {(['overview','crm','followups'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-gold-500 text-gold-400' : 'border-transparent text-ink-400 hover:text-ink-50'}`}>
              {t === 'followups' ? `Follow-Ups (${followUps.length})` : t === 'crm' ? `Calls (${callLogs.length})` : 'Overview'}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-ink-50 flex items-center gap-2"><MapPinIcon className="w-4 h-4 text-gold-400" />Contact & Location</h3>
            <div className="space-y-2 text-sm">
              <Row label="Phone" val={formatPhone(carrier.telephone || null)} />
              <Row label="City" val={carrier.phy_city} />
              <Row label="State" val={carrier.phy_state} />
              <Row label="ZIP" val={carrier.phy_zip} />
              <Row label="Address" val={carrier.phy_street} />
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-ink-50 flex items-center gap-2"><TruckIcon className="w-4 h-4 text-gold-400" />Fleet & Operations</h3>
            <div className="space-y-2 text-sm">
              <Row label="Power Units" val={carrier.nbr_power_unit} />
              <Row label="Drivers" val={carrier.drivers} />
              <Row label="Entity Type" val={carrier.entity_type} />
              <Row label="Operation" val={carrier.carrier_operation === 'A' ? 'Interstate' : carrier.carrier_operation === 'B' ? 'Intrastate HM' : carrier.carrier_operation === 'C' ? 'Intrastate' : carrier.carrier_operation} />
              <Row label="HM Flag" val={carrier.hm_flag ? 'Yes' : 'No'} />
              <Row label="PC Flag" val={carrier.pc_flag ? 'Yes' : 'No'} />
              <Row label="Op Carrier" val={carrier.op_carrier_flag ? 'Yes' : 'No'} />
              <Row label="Op Broker" val={carrier.op_broker_flag ? 'Yes' : 'No'} />
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-ink-50 flex items-center gap-2"><ShieldCheckIcon className="w-4 h-4 text-gold-400" />Safety & Insurance</h3>
            <div className="space-y-2 text-sm">
              <Row label="Safety Rating" val={carrier.safety_rating} />
              <Row label="Review Date" val={(carrier as Record<string,unknown>).safety_review_date as string} />
              <Row label="Review Type" val={(carrier as Record<string,unknown>).safety_review_type as string} />
              <Row label="Insurance on File" val={carrier.insurance_on_file ? 'Yes' : 'No'} />
              <Row label="BIPD Insurance" val={carrier.bipd_insurance_on_file ? 'Yes' : 'No'} />
              <Row label="Cargo Insurance" val={carrier.cargo_insurance_on_file ? 'Yes' : 'No'} />
              <Row label="Bond" val={(carrier as Record<string,unknown>).bond_insurance_on_file ? 'Yes' : 'No'} />
            </div>
          </div>

          <div className="card p-4 md:col-span-2 lg:col-span-3">
            <h3 className="text-sm font-semibold text-ink-50 mb-3">Cargo Types</h3>
            <CargoTags carrier={carrier} max={30} />
          </div>
        </div>
      )}

      {/* CRM Tab */}
      {tab === 'crm' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {!isViewer && (
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-ink-50">CRM Status</h3>
              <div className="field">
                <label className="label">Status</label>
                <select className="select" value={crmStatus} onChange={e => setCrmStatus(e.target.value)}>
                  {CRM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Notes</label>
                <textarea className="input" rows={4} value={crmNotes} onChange={e => setCrmNotes(e.target.value)} placeholder="Add notes about this carrier..." />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded" checked={inPipeline} onChange={e => setInPipeline(e.target.checked)} />
                <span className="text-sm text-ink-200 flex items-center gap-1"><StarIcon className="w-3.5 h-3.5 text-gold-400" />Add to Pipeline / Sub Roster</span>
              </label>
              <button onClick={saveCrm} disabled={crmSaving} className="btn btn-gold w-full">Save CRM</button>

              {!showCallForm ? (
                <button onClick={() => setShowCallForm(true)} className="btn btn-outline w-full flex items-center justify-center gap-2">
                  <PhoneIcon className="w-4 h-4" /> Log a Call
                </button>
              ) : (
                <div className="space-y-3 border-t border-ink-700 pt-4">
                  <p className="text-sm font-medium text-ink-50">Log Call</p>
                  <div className="field">
                    <label className="label">Outcome</label>
                    <select className="select" value={callOutcome} onChange={e => setCallOutcome(e.target.value)}>
                      {CALL_OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <input className="input" placeholder="Contact name (optional)" value={callContact} onChange={e => setCallContact(e.target.value)} />
                  <textarea className="input" rows={3} placeholder="Call notes..." value={callNotes} onChange={e => setCallNotes(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={logCall} disabled={callSaving} className="btn btn-gold flex-1">Save</button>
                    <button onClick={() => setShowCallForm(false)} className="btn btn-ghost">Cancel</button>
                  </div>
                </div>
              )}

              <button onClick={() => { setTab('followups'); setShowFuForm(true); }} className="btn btn-outline w-full flex items-center justify-center gap-2">
                <ClockIcon className="w-4 h-4" /> Schedule Follow-Up
              </button>
            </div>
          )}

          <div className={`card ${!isViewer ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <div className="flex items-center justify-between p-4 border-b border-ink-700">
              <h3 className="text-sm font-semibold text-ink-50">Call History ({callLogs.length})</h3>
            </div>
            <div className="divide-y divide-ink-700 max-h-[500px] overflow-y-auto">
              {callLogs.length === 0 ? (
                <div className="p-8 text-center text-ink-400 text-sm">No calls logged yet.</div>
              ) : callLogs.map(log => (
                <div key={log.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={`badge text-xs ${log.outcome === 'Interested' ? 'bg-green-900/50 text-green-400 border-green-800' : log.outcome === 'No Answer' ? 'bg-ink-700 text-ink-300 border-ink-600' : 'bg-gold-900/30 text-gold-400 border-gold-800'}`}>{log.outcome}</span>
                      {log.contact_name && <span className="ml-2 text-xs text-ink-400">with {log.contact_name}</span>}
                    </div>
                    <span className="text-[10px] text-ink-500 flex-shrink-0">{fmtDate(log.call_date || log.created_at)}</span>
                  </div>
                  {log.notes && <p className="mt-1 text-xs text-ink-300">{log.notes}</p>}
                  <p className="text-[10px] text-ink-500 mt-1">by {log.user_name || 'Unknown'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Follow-ups Tab */}
      {tab === 'followups' && (
        <div className="space-y-4">
          {!isViewer && (!showFuForm ? (
            <button onClick={() => setShowFuForm(true)} className="btn btn-gold flex items-center gap-2">
              <PlusIcon className="w-4 h-4" /> Schedule Follow-Up
            </button>
          ) : (
            <div className="card p-5 max-w-md space-y-4">
              <h3 className="text-sm font-semibold text-ink-50">New Follow-Up</h3>
              <div className="field">
                <label className="label">Date</label>
                <input type="date" className="input" value={fuDate} onChange={e => setFuDate(e.target.value)} min={format(new Date(), 'yyyy-MM-dd')} />
              </div>
              <div className="field">
                <label className="label">Time (optional)</label>
                <input type="time" className="input" value={fuTime} onChange={e => setFuTime(e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Notes</label>
                <textarea className="input" rows={3} placeholder="What to discuss..." value={fuNotes} onChange={e => setFuNotes(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button onClick={scheduleFollowUp} disabled={fuSaving || !fuDate} className="btn btn-gold flex-1 disabled:opacity-50">Schedule</button>
                <button onClick={() => setShowFuForm(false)} className="btn btn-ghost">Cancel</button>
              </div>
            </div>
          ))}

          <div className="card">
            <div className="p-4 border-b border-ink-700">
              <h3 className="text-sm font-semibold text-ink-50">Scheduled Follow-Ups ({followUps.length})</h3>
            </div>
            <div className="divide-y divide-ink-700">
              {followUps.length === 0 ? (
                <div className="p-8 text-center text-ink-400 text-sm">No follow-ups scheduled.</div>
              ) : (followUps as FollowUp[]).map(fu => (
                <div key={fu.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm text-ink-50 font-medium">{fu.due_date}{fu.due_time ? ` at ${fu.due_time}` : ' (All day)'}</p>
                    {fu.notes && <p className="text-xs text-ink-400 mt-0.5">{fu.notes}</p>}
                  </div>
                  {!isViewer && (
                    <button onClick={() => completeFollowUp(fu.id)} className="btn btn-ghost text-xs text-green-400 flex items-center gap-1">
                      <CheckCircleIcon className="w-4 h-4" /> Done
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, val }: { label: string; val: unknown }) {
  const display = val === null || val === undefined || val === '' ? '—' : String(val);
  return (
    <div className="flex justify-between gap-2">
      <span className="text-ink-400 flex-shrink-0">{label}</span>
      <span className="text-ink-200 text-right">{display}</span>
    </div>
  );
}
