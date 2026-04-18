import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { StatusBadge, SafetyBadge, CrmBadge, OpTypeBadge, formatPhone } from '../../components/StatusBadge';
import { US_STATES, CARGO_TYPES, CRM_STATUSES } from '../../types';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon, PhoneIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

interface CarrierRow {
  dot_number: string;
  legal_name: string;
  dba_name?: string;
  phy_state?: string;
  phy_city?: string;
  telephone?: string | null;
  operating_status?: string;
  safety_rating?: string;
  carrier_operation?: string;
  nbr_power_unit?: number;
  crm_status?: string;
  mc_mx_ff_number?: string;
  mc_number?: string;
  insurance_on_file?: boolean;
}

const PAGE_SIZE = 50;

export default function SearchPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [carriers, setCarriers] = useState<CarrierRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [q, setQ] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [operatingStatus, setOperatingStatus] = useState('');
  const [safetyRating, setSafetyRating] = useState('');
  const [carrierOperation, setCarrierOperation] = useState('');
  const [minUnits, setMinUnits] = useState('');
  const [maxUnits, setMaxUnits] = useState('');
  const [insuranceOnly, setInsuranceOnly] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [crmStatus, setCrmStatus] = useState('');
  const [inPipeline, setInPipeline] = useState(false);
  const [selectedCargo, setSelectedCargo] = useState<string[]>([]);

  const search = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: pg,
        limit: PAGE_SIZE,
      };
      if (q) params.q = q;
      if (stateFilter) params.state = stateFilter;
      if (operatingStatus) params.operating_status = operatingStatus;
      if (safetyRating) params.safety_rating = safetyRating;
      if (carrierOperation) params.carrier_operation = carrierOperation;
      if (minUnits) params.min_power_units = minUnits;
      if (maxUnits) params.max_power_units = maxUnits;
      if (insuranceOnly) params.insurance_on_file = 'true';
      if (hasPhone) params.has_phone = 'true';
      if (crmStatus) params.crm_status = crmStatus;
      if (inPipeline) params.in_pipeline = 'true';
      if (selectedCargo.length === 1) params.cargo_type = selectedCargo[0];

      const { data } = await api.get('/carriers', { params });
      setCarriers(data.carriers || []);
      setTotal(data.total || 0);
      setPage(pg);
    } catch {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  }, [q, stateFilter, operatingStatus, safetyRating, carrierOperation, minUnits, maxUnits, insuranceOnly, hasPhone, crmStatus, inPipeline, selectedCargo]);

  useEffect(() => { search(1); }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); search(1); };

  const clearFilters = () => {
    setQ(''); setStateFilter(''); setOperatingStatus(''); setSafetyRating('');
    setCarrierOperation(''); setMinUnits(''); setMaxUnits('');
    setInsuranceOnly(false); setHasPhone(false); setCrmStatus(''); setInPipeline(false);
    setSelectedCargo([]);
  };

  const toggleCargo = (field: string) => {
    setSelectedCargo(prev => prev.includes(field) ? prev.filter(c => c !== field) : [...prev, field]);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ format: 'csv' });
      if (q) params.append('q', q);
      if (stateFilter) params.append('state', stateFilter);
      const res = await api.get(`/carriers/export?${params.toString()}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a'); a.href = url; a.download = 'carriers.csv'; a.click();
    } catch { toast.error('Export failed'); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeFilters = [stateFilter, operatingStatus, safetyRating, carrierOperation, minUnits, maxUnits, crmStatus].filter(Boolean).length + (insuranceOnly ? 1 : 0) + (hasPhone ? 1 : 0) + (inPipeline ? 1 : 0) + selectedCargo.length;

  return (
    <div className="flex h-full">
      {/* Filter sidebar */}
      <aside className={`${sidebarOpen ? 'w-64 xl:w-72' : 'w-0'} transition-all flex-shrink-0 overflow-hidden bg-ink-900 border-r border-ink-700 flex flex-col`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-700 flex-shrink-0">
          <span className="text-sm font-semibold text-ink-50 flex items-center gap-1.5">
            <FunnelIcon className="w-4 h-4 text-gold-400" /> Filters
            {activeFilters > 0 && <span className="bg-gold-600 text-ink-50 text-[10px] px-1.5 rounded-full">{activeFilters}</span>}
          </span>
          <button onClick={clearFilters} className="text-xs text-ink-400 hover:text-gold-400">Clear all</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-hide">
          <div className="field">
            <label className="label">State</label>
            <select className="select" value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
              <option value="">All States</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="field">
            <label className="label">Operating Status</label>
            <select className="select" value={operatingStatus} onChange={e => setOperatingStatus(e.target.value)}>
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="OUT-OF-SERVICE">Out of Service</option>
            </select>
          </div>

          <div className="field">
            <label className="label">Safety Rating</label>
            <select className="select" value={safetyRating} onChange={e => setSafetyRating(e.target.value)}>
              <option value="">All</option>
              <option value="Satisfactory">Satisfactory</option>
              <option value="Conditional">Conditional</option>
              <option value="Unsatisfactory">Unsatisfactory</option>
            </select>
          </div>

          <div className="field">
            <label className="label">Operation Type</label>
            <select className="select" value={carrierOperation} onChange={e => setCarrierOperation(e.target.value)}>
              <option value="">All</option>
              <option value="A">Interstate (A)</option>
              <option value="B">Intrastate HM (B)</option>
              <option value="C">Intrastate (C)</option>
            </select>
          </div>

          <div>
            <label className="label mb-2">Fleet Size (Power Units)</label>
            <div className="flex gap-2">
              <input type="number" className="input flex-1" placeholder="Min" min="0" value={minUnits} onChange={e => setMinUnits(e.target.value)} />
              <input type="number" className="input flex-1" placeholder="Max" min="0" value={maxUnits} onChange={e => setMaxUnits(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label className="label">CRM Status</label>
            <select className="select" value={crmStatus} onChange={e => setCrmStatus(e.target.value)}>
              <option value="">All</option>
              {CRM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-ink-600 bg-ink-700 text-gold-500" checked={insuranceOnly} onChange={e => setInsuranceOnly(e.target.checked)} />
              <span className="text-sm text-ink-200">Insurance on File</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-ink-600 bg-ink-700 text-gold-500" checked={hasPhone} onChange={e => setHasPhone(e.target.checked)} />
              <span className="text-sm text-ink-200 flex items-center gap-1"><PhoneIcon className="w-3.5 h-3.5 text-gold-400" />Has Phone Number</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-ink-600 bg-ink-700 text-gold-500" checked={inPipeline} onChange={e => setInPipeline(e.target.checked)} />
              <span className="text-sm text-ink-200">In Pipeline Only</span>
            </label>
          </div>

          <div>
            <label className="label mb-2">Cargo Types</label>
            <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-hide">
              {Object.entries(CARGO_TYPES).map(([field, label]) => (
                <label key={field} className="flex items-center gap-2 cursor-pointer py-0.5">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded border-ink-600 bg-ink-700 text-gold-500" checked={selectedCargo.includes(field)} onChange={() => toggleCargo(field)} />
                  <span className="text-xs text-ink-200">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 p-4 border-b border-ink-700 bg-ink-950">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg text-ink-400 hover:text-ink-50 hover:bg-ink-700 flex-shrink-0">
              <FunnelIcon className="w-4 h-4" />
            </button>
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  type="text"
                  className="input pl-9 w-full"
                  placeholder="Search by carrier name, DOT#, MC#, city..."
                  value={q}
                  onChange={e => setQ(e.target.value)}
                />
                {q && <button type="button" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-50">
                  <XMarkIcon className="w-4 h-4" />
                </button>}
              </div>
              <button type="submit" className="btn btn-gold px-5">Search</button>
            </form>
            {user?.role !== 'viewer' && (
              <button onClick={handleExport} className="btn btn-outline flex items-center gap-1.5 flex-shrink-0">
                <ArrowDownTrayIcon className="w-4 h-4" /> Export
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-2 border-b border-ink-700 flex items-center gap-3">
          <span className="text-xs text-ink-400">{total.toLocaleString()} carriers found</span>
          {loading && <span className="text-xs text-gold-400 animate-pulse">Searching...</span>}
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ink-900 border-b border-ink-700">
              <tr>
                <th className="th text-left">Carrier</th>
                <th className="th">DOT #</th>
                <th className="th">MC #</th>
                <th className="th">State</th>
                <th className="th">Phone</th>
                <th className="th">Status</th>
                <th className="th">Safety</th>
                <th className="th">Op Type</th>
                <th className="th">Fleet</th>
                <th className="th">CRM</th>
              </tr>
            </thead>
            <tbody>
              {carriers.length === 0 && !loading ? (
                <tr><td colSpan={10} className="text-center py-16 text-ink-400">
                  <MagnifyingGlassIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No carriers found. Try adjusting your filters.</p>
                </td></tr>
              ) : carriers.map(c => (
                <tr key={c.dot_number} className="tr-hover cursor-pointer" onClick={() => navigate(`/carriers/${c.dot_number}`)}>
                  <td className="td">
                    <div className="font-medium text-ink-50 truncate max-w-[200px]">{c.legal_name}</div>
                    {c.dba_name && <div className="text-xs text-ink-400 truncate">{c.dba_name}</div>}
                  </td>
                  <td className="td text-center font-mono text-xs">{c.dot_number}</td>
                  <td className="td text-center text-xs text-ink-300">{c.mc_mx_ff_number?.split(',')[0] || c.mc_number || '—'}</td>
                  <td className="td text-center">{c.phy_state || '—'}</td>
                  <td className="td text-center text-xs" onClick={e => e.stopPropagation()}>
                    {c.telephone
                      ? <a href={`tel:${c.telephone}`} className="text-gold-400 hover:text-gold-300 flex items-center justify-center gap-1 whitespace-nowrap">
                          <PhoneIcon className="w-3 h-3" />{formatPhone(c.telephone)}
                        </a>
                      : <span className="text-ink-600">—</span>}
                  </td>
                  <td className="td text-center"><StatusBadge status={c.operating_status || null} /></td>
                  <td className="td text-center"><SafetyBadge rating={c.safety_rating || null} /></td>
                  <td className="td text-center">
                    {c.carrier_operation === 'A' && <span className="badge-interstate text-xs">Interstate</span>}
                    {c.carrier_operation === 'B' && <span className="badge-intrastate text-xs">Intrastate HM</span>}
                    {c.carrier_operation === 'C' && <span className="badge-intrastate text-xs">Intrastate</span>}
                  </td>
                  <td className="td text-center text-ink-300">{c.nbr_power_unit ?? '—'}</td>
                  <td className="td text-center"><CrmBadge status={c.crm_status || null} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-ink-700 bg-ink-950">
            <span className="text-xs text-ink-400">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => search(page - 1)} disabled={page <= 1} className="btn btn-ghost p-1.5 disabled:opacity-30">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button key={pg} onClick={() => search(pg)} className={`btn text-xs px-2.5 py-1 ${pg === page ? 'btn-gold' : 'btn-ghost'}`}>
                    {pg}
                  </button>
                );
              })}
              <button onClick={() => search(page + 1)} disabled={page >= totalPages} className="btn btn-ghost p-1.5 disabled:opacity-30">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
