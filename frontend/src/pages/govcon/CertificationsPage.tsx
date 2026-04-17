import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { ShieldCheckIcon, PlusIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useAuthStore } from '../../store/authStore';

interface Certification {
  id: number;
  name: string;
  issuing_body?: string;
  certification_number?: string;
  issued_date?: string;
  expiration_date?: string;
  renewal_reminder_days?: number;
  status: string;
  notes?: string;
  days_until_expiry?: number;
  created_at: string;
}

const CERT_STATUSES = ['Active', 'Pending Renewal', 'Expired', 'In Progress', 'Submitted'];
const COMMON_CERTS = ['WOSB Certification', 'EDWOSB Certification', 'SAM.gov Registration', '8(a) Business Development', 'HUBZone', 'SDVOSB', 'DBE Certification', 'DOT Authority', 'FMCSA Operating License', 'Hazmat Certification', 'ISO 9001', 'TSA Certified Cargo Screener', 'CTPAT', 'SmartWay Partnership', 'State DOT License'];

const EMPTY: Partial<Certification> = { name: '', issuing_body: '', certification_number: '', issued_date: '', expiration_date: '', renewal_reminder_days: 365, status: 'Active', notes: '' };

export default function CertificationsPage() {
  const { user } = useAuthStore();
  const isViewer = user?.role === 'viewer';
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<Certification> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/govcon/certifications');
      setCerts(data || []);
    } catch { toast.error('Failed to load certifications'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!modal?.name?.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      if (modal.id) {
        const { data } = await api.put(`/govcon/certifications/${modal.id}`, modal);
        setCerts(prev => prev.map(c => c.id === modal.id ? data : c));
      } else {
        const { data } = await api.post('/govcon/certifications', modal);
        setCerts(prev => [...prev, data]);
      }
      toast.success('Saved'); setModal(null);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm('Delete this certification?')) return;
    try { await api.delete(`/govcon/certifications/${id}`); setCerts(prev => prev.filter(c => c.id !== id)); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };

  const getDaysUntil = (dateStr?: string) => {
    if (!dateStr) return null;
    try { return differenceInDays(parseISO(dateStr), new Date()); } catch { return null; }
  };

  const urgentCerts = certs.filter(c => { const d = getDaysUntil(c.expiration_date); return d !== null && d >= 0 && d <= 60; });
  const expiredCerts = certs.filter(c => { const d = getDaysUntil(c.expiration_date); return d !== null && d < 0; });
  const activeCerts = certs.filter(c => c.status === 'Active' && (getDaysUntil(c.expiration_date) === null || (getDaysUntil(c.expiration_date) || 0) > 60));

  const fmtDate = (s?: string) => { if (!s) return '—'; try { return format(parseISO(s), 'MMM d, yyyy'); } catch { return s; } };

  const expiryDisplay = (c: Certification) => {
    const days = getDaysUntil(c.expiration_date);
    if (days === null) return <span className="text-ink-400 text-xs">No expiry</span>;
    if (days < 0) return <span className="text-red-400 text-xs font-semibold">Expired {Math.abs(days)}d ago</span>;
    if (days <= 30) return <span className="text-red-400 text-xs font-semibold">{days}d left ⚠</span>;
    if (days <= 60) return <span className="text-amber-400 text-xs font-semibold">{days}d left</span>;
    return <span className="text-green-400 text-xs">{days}d left</span>;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Certifications & Compliance</h1>
          <p className="page-sub">{certs.length} certifications tracked</p>
        </div>
        {!isViewer && <button onClick={() => setModal({ ...EMPTY })} className="btn btn-gold flex items-center gap-2"><PlusIcon className="w-4 h-4" />Add Certification</button>}
      </div>

      {/* Alerts */}
      {(urgentCerts.length > 0 || expiredCerts.length > 0) && (
        <div className="space-y-2">
          {expiredCerts.length > 0 && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-semibold text-sm">Expired Certifications ({expiredCerts.length})</p>
                <p className="text-red-400/80 text-xs mt-0.5">{expiredCerts.map(c => c.name).join(', ')}</p>
              </div>
            </div>
          )}
          {urgentCerts.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-4 flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 font-semibold text-sm">Expiring Within 60 Days ({urgentCerts.length})</p>
                <p className="text-amber-400/80 text-xs mt-0.5">{urgentCerts.map(c => `${c.name} (${getDaysUntil(c.expiration_date)}d)`).join(', ')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{activeCerts.length}</div>
          <div className="text-xs text-ink-400 mt-0.5">Active</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{urgentCerts.length}</div>
          <div className="text-xs text-ink-400 mt-0.5">Expiring Soon</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{expiredCerts.length}</div>
          <div className="text-xs text-ink-400 mt-0.5">Expired</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{certs.filter(c => c.status === 'In Progress' || c.status === 'Submitted').length}</div>
          <div className="text-xs text-ink-400 mt-0.5">In Progress</div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-800 border-b border-ink-700">
            <tr>
              <th className="th text-left">Certification</th>
              <th className="th">Issued By</th>
              <th className="th">Cert. Number</th>
              <th className="th">Issue Date</th>
              <th className="th">Expiration</th>
              <th className="th">Time Left</th>
              <th className="th">Status</th>
              {!isViewer && <th className="th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {certs.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16">
                <ShieldCheckIcon className="w-10 h-10 mx-auto mb-3 text-ink-600" />
                <p className="text-ink-400 text-sm">No certifications tracked. Add your first one.</p>
              </td></tr>
            ) : certs.map(c => (
              <tr key={c.id} className={`tr-hover ${getDaysUntil(c.expiration_date) !== null && (getDaysUntil(c.expiration_date) || 0) < 0 ? 'bg-red-950/10' : getDaysUntil(c.expiration_date) !== null && (getDaysUntil(c.expiration_date) || 0) <= 60 ? 'bg-amber-950/10' : ''}`}>
                <td className="td">
                  <div className="font-medium text-ink-50">{c.name}</div>
                  {c.notes && <div className="text-xs text-ink-400 truncate max-w-[200px]">{c.notes}</div>}
                </td>
                <td className="td text-center text-xs text-ink-300">{c.issuing_body || '—'}</td>
                <td className="td text-center font-mono text-xs text-ink-300">{c.certification_number || '—'}</td>
                <td className="td text-center text-xs text-ink-300">{fmtDate(c.issued_date)}</td>
                <td className="td text-center text-xs text-ink-300">{fmtDate(c.expiration_date)}</td>
                <td className="td text-center">{expiryDisplay(c)}</td>
                <td className="td text-center">
                  <span className={`badge text-xs ${
                    c.status === 'Active' ? 'bg-green-900/50 text-green-400 border-green-800' :
                    c.status === 'Expired' ? 'bg-red-900/30 text-red-400 border-red-800' :
                    c.status === 'Pending Renewal' ? 'bg-amber-900/30 text-amber-400 border-amber-800' :
                    'bg-blue-900/30 text-blue-400 border-blue-800'
                  }`}>{c.status}</span>
                </td>
                {!isViewer && (
                  <td className="td">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setModal(c)} className="btn btn-ghost py-0.5 px-1.5 text-blue-400"><PencilIcon className="w-3.5 h-3.5" /></button>
                      <button onClick={() => del(c.id)} className="btn btn-ghost py-0.5 px-1.5 text-red-400"><TrashIcon className="w-3.5 h-3.5" /></button>
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
          <div className="card w-full max-w-xl p-6 space-y-4 my-8">
            <h2 className="text-lg font-bold text-ink-50">{modal.id ? 'Edit Certification' : 'Add Certification'}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="field sm:col-span-2">
                <label className="label">Certification Name *</label>
                <input className="input" list="cert-names" value={modal.name || ''} onChange={e => setModal(m => ({ ...m!, name: e.target.value }))} />
                <datalist id="cert-names">{COMMON_CERTS.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="field">
                <label className="label">Issuing Body</label>
                <input className="input" placeholder="SBA, WBENC, SAM.gov..." value={modal.issuing_body || ''} onChange={e => setModal(m => ({ ...m!, issuing_body: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Certification Number</label>
                <input className="input" value={modal.certification_number || ''} onChange={e => setModal(m => ({ ...m!, certification_number: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Status</label>
                <select className="select" value={modal.status || 'Active'} onChange={e => setModal(m => ({ ...m!, status: e.target.value }))}>
                  {CERT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Renewal Period (days)</label>
                <input type="number" className="input" value={modal.renewal_reminder_days || ''} onChange={e => setModal(m => ({ ...m!, renewal_reminder_days: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div className="field">
                <label className="label">Issue Date</label>
                <input type="date" className="input" value={modal.issued_date || ''} onChange={e => setModal(m => ({ ...m!, issued_date: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Expiration Date</label>
                <input type="date" className="input" value={modal.expiration_date || ''} onChange={e => setModal(m => ({ ...m!, expiration_date: e.target.value }))} />
              </div>
              <div className="field sm:col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={modal.notes || ''} onChange={e => setModal(m => ({ ...m!, notes: e.target.value }))} />
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
