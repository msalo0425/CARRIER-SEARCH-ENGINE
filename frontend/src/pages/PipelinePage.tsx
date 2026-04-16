import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { StatusBadge, SafetyBadge, CargoTags, formatPhone } from '../components/StatusBadge';
import { Carrier } from '../types';
import { TruckIcon, MagnifyingGlassIcon, StarIcon, PhoneIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

export default function PipelinePage() {
  const { user } = useAuthStore();
  const isViewer = user?.role === 'viewer';
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const load = async () => {
    try {
      const { data } = await api.get('/carriers/pipeline');
      setCarriers(data || []);
    } catch { toast.error('Failed to load pipeline'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const removeFromPipeline = async (dotNumber: string) => {
    try {
      await api.patch(`/carriers/${dotNumber}/crm`, { is_in_pipeline: false });
      setCarriers(prev => prev.filter(c => c.dot_number !== dotNumber));
      toast.success('Removed from pipeline');
    } catch { toast.error('Failed'); }
  };

  const saveNotes = async (dotNumber: string) => {
    setSaving(prev => ({ ...prev, [dotNumber]: true }));
    try {
      await api.patch(`/carriers/${dotNumber}/crm`, { notes: editNotes[dotNumber] });
      setCarriers(prev => prev.map(c => c.dot_number === dotNumber ? { ...c, crm_notes: editNotes[dotNumber] } : c));
      toast.success('Notes saved');
    } catch { toast.error('Failed'); }
    finally { setSaving(prev => ({ ...prev, [dotNumber]: false })); }
  };

  const filtered = carriers.filter(c => {
    if (stateFilter && c.phy_state !== stateFilter) return false;
    if (q) {
      const lq = q.toLowerCase();
      return (c.legal_name || '').toLowerCase().includes(lq) || (c.dot_number || '').includes(lq) || (c.phy_city || '').toLowerCase().includes(lq);
    }
    return true;
  });

  const states = [...new Set(carriers.map(c => c.phy_state).filter(Boolean))].sort() as string[];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Pipeline / Subcontractor Roster</h1>
          <p className="page-sub">{carriers.length} carriers in pipeline</p>
        </div>
        <Link to="/carriers" className="btn btn-gold flex items-center gap-2">
          <MagnifyingGlassIcon className="w-4 h-4" /> Find Carriers
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-2xl font-bold text-gold-400">{carriers.length}</div>
          <div className="text-xs text-ink-400 mt-0.5">Total in Pipeline</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-400">{carriers.filter(c => (c.operating_status || '').toLowerCase() === 'active').length}</div>
          <div className="text-xs text-ink-400 mt-0.5">Active Carriers</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-blue-400">{[...new Set(carriers.map(c => c.phy_state))].length}</div>
          <div className="text-xs text-ink-400 mt-0.5">States Covered</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-purple-400">{carriers.reduce((s, c) => s + (c.nbr_power_unit || 0), 0).toLocaleString()}</div>
          <div className="text-xs text-ink-400 mt-0.5">Total Power Units</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input className="input pl-9" placeholder="Search pipeline..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="select w-40" value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
          <option value="">All States</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <TruckIcon className="w-12 h-12 mx-auto mb-4 text-ink-600" />
          <p className="text-white font-medium text-lg mb-2">Pipeline is empty</p>
          <p className="text-ink-400 text-sm mb-4">Add carriers to your pipeline from the Carrier Search page.</p>
          <Link to="/carriers" className="btn btn-gold">Search Carriers</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.dot_number} className="card p-4">
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarIcon className="w-4 h-4 text-gold-400 flex-shrink-0 fill-gold-400" />
                    <Link to={`/carriers/${c.dot_number}`} className="font-semibold text-white hover:text-gold-400 text-base">{c.legal_name}</Link>
                    <StatusBadge status={c.operating_status || null} />
                    <SafetyBadge rating={c.safety_rating || null} />
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-ink-300">
                    <span>DOT {c.dot_number}</span>
                    {c.mc_mx_ff_number && <span>MC {c.mc_mx_ff_number.split(',')[0]}</span>}
                    <span>{c.phy_city}{c.phy_state ? `, ${c.phy_state}` : ''}</span>
                    {c.nbr_power_unit !== undefined && <span>{c.nbr_power_unit} power units</span>}
                    {c.telephone && <a href={`tel:${c.telephone}`} className="text-gold-400 hover:text-gold-300 flex items-center gap-1">
                      <PhoneIcon className="w-3 h-3" />{formatPhone(c.telephone)}
                    </a>}
                  </div>
                  <div>
                    <CargoTags carrier={c} max={6} />
                  </div>
                </div>

                <div className="flex flex-col gap-2 lg:w-64 xl:w-72">
                  <textarea
                    className="input text-xs"
                    rows={2}
                    placeholder="Pipeline notes..."
                    value={editNotes[c.dot_number] ?? (c.crm_notes || '')}
                    onChange={e => setEditNotes(prev => ({ ...prev, [c.dot_number]: e.target.value }))}
                    disabled={isViewer}
                  />
                  {!isViewer && (
                    <div className="flex gap-2">
                      <button onClick={() => saveNotes(c.dot_number)} disabled={saving[c.dot_number]} className="btn btn-outline text-xs py-1 flex-1">
                        {saving[c.dot_number] ? 'Saving...' : 'Save Notes'}
                      </button>
                      <button onClick={() => removeFromPipeline(c.dot_number)} className="btn btn-ghost text-xs py-1 text-red-400 hover:bg-red-900/20 flex items-center gap-1">
                        <TrashIcon className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
