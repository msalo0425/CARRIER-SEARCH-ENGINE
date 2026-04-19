import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { CrmBadge, OpTypeBadge } from '../../components/StatusBadge';
import { FireIcon, PhoneIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface HotCarrier {
  dot_number: string;
  legal_name: string;
  dba_name: string | null;
  phy_state: string | null;
  phy_city: string | null;
  telephone: string | null;
  mc_mx_ff_number: string | null;
  mc_number: string | null;
  operating_status: string | null;
  nbr_power_unit: number | null;
  safety_rating: string | null;
  carrier_operation: string | null;
  op_carrier_flag: boolean;
  crm_status: string | null;
  is_in_pipeline: boolean | null;
}

// DOT numbers are issued sequentially — higher = more recently registered
const DOT_RANGE_OPTIONS = [
  { label: 'Newest ~50K (4,150,000+)', value: '4150000' },
  { label: 'Newer ~200K (4,000,000+)', value: '4000000' },
  { label: 'Recent ~500K (3,700,000+)', value: '3700000' },
  { label: 'Last ~1M (3,200,000+)', value: '3200000' },
  { label: 'All carriers', value: '0' },
];

function formatPhone(phone: string | null): string {
  if (!phone) return '—';
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return phone;
}

export default function HotSheetPage() {
  const [carriers, setCarriers] = useState<HotCarrier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  const [minDot, setMinDot] = useState('4150000');
  const [stateFilter, setStateFilter] = useState('');
  const [hasPhone, setHasPhone] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { min_dot: minDot, page: String(p), limit: '50' };
      if (stateFilter) params.state = stateFilter;
      if (hasPhone) params.has_phone = 'true';
      if (activeOnly) params.operating_status = 'Active';
      const { data } = await api.get('/carriers/hot-sheet', { params });
      setCarriers(data.carriers || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
      setPage(p);
    } catch { toast.error('Failed to load hot sheet'); }
    finally { setLoading(false); }
  }, [minDot, stateFilter, hasPhone, activeOnly]);

  useEffect(() => { load(1); }, [minDot, stateFilter, hasPhone, activeOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToCrm = async (dot: string) => {
    setAdding(dot);
    try {
      await api.patch(`/carriers/${dot}/crm`, { crm_status: 'New' });
      setCarriers(prev => prev.map(c => c.dot_number === dot ? { ...c, crm_status: 'New' } : c));
      toast.success('Added to CRM');
    } catch { toast.error('Failed to add to CRM'); }
    finally { setAdding(null); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FireIcon className="w-6 h-6 text-orange-400" /> Hot Sheet
          </h1>
          <p className="page-sub">
            {total.toLocaleString()} carriers · Sorted by DOT # (newest registrations first)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="select w-56"
          value={minDot}
          onChange={e => setMinDot(e.target.value)}
        >
          {DOT_RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input
          className="input w-32"
          placeholder="State (e.g. TX)"
          value={stateFilter}
          maxLength={2}
          onChange={e => setStateFilter(e.target.value.toUpperCase())}
        />
        <label className="flex items-center gap-2 text-sm text-ink-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasPhone}
            onChange={e => setHasPhone(e.target.checked)}
            className="w-4 h-4 accent-[#F96B2F]"
          />
          Has Phone
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={e => setActiveOnly(e.target.checked)}
            className="w-4 h-4 accent-[#F96B2F]"
          />
          Active Only
        </label>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ink-800 border-b border-ink-700">
              <tr>
                <th className="th text-left">DOT #</th>
                <th className="th text-left">Carrier</th>
                <th className="th">MC #</th>
                <th className="th">State</th>
                <th className="th">Phone</th>
                <th className="th">Trucks</th>
                <th className="th">Type</th>
                <th className="th">CRM</th>
              </tr>
            </thead>
            <tbody>
              {carriers.map(c => (
                <tr key={c.dot_number} className="tr-hover">
                  <td className="td text-xs text-gold-400 font-mono font-semibold">{c.dot_number}</td>
                  <td className="td">
                    <Link
                      to={`/carriers/${c.dot_number}`}
                      className="font-medium text-ink-50 hover:text-gold-400 block max-w-[200px] truncate"
                    >
                      {c.legal_name}
                    </Link>
                    {c.dba_name && (
                      <div className="text-[10px] text-ink-400 truncate max-w-[200px]">{c.dba_name}</div>
                    )}
                    {c.phy_city && <div className="text-[10px] text-ink-500">{c.phy_city}</div>}
                  </td>
                  <td className="td text-center font-mono text-xs text-ink-300">
                    {c.mc_mx_ff_number || c.mc_number || '—'}
                  </td>
                  <td className="td text-center text-xs text-ink-300">{c.phy_state || '—'}</td>
                  <td className="td text-center">
                    {c.telephone ? (
                      <a
                        href={`tel:${c.telephone}`}
                        className="flex items-center justify-center gap-1 text-xs text-green-400 hover:text-green-300"
                      >
                        <PhoneIcon className="w-3 h-3" />
                        {formatPhone(c.telephone)}
                      </a>
                    ) : (
                      <span className="text-ink-500 text-xs">—</span>
                    )}
                  </td>
                  <td className="td text-center text-xs text-ink-300">
                    {c.nbr_power_unit ?? '—'}
                  </td>
                  <td className="td text-center">
                    <OpTypeBadge carrier={c as any} />
                  </td>
                  <td className="td text-center">
                    {c.crm_status ? (
                      <CrmBadge status={c.crm_status} />
                    ) : (
                      <button
                        onClick={() => addToCrm(c.dot_number)}
                        disabled={adding === c.dot_number}
                        className="btn btn-ghost text-xs py-1 px-2 flex items-center gap-1 mx-auto"
                      >
                        <PlusIcon className="w-3 h-3" />
                        {adding === c.dot_number ? '…' : 'Add'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {carriers.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-ink-400 text-sm">
                    No carriers found. Try adjusting the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-ink-400">
          <span>Page {page} of {totalPages} · {total.toLocaleString()} carriers</span>
          <div className="flex gap-2">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1}
              className="btn btn-ghost p-2 disabled:opacity-40"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => load(page + 1)}
              disabled={page >= totalPages}
              className="btn btn-ghost p-2 disabled:opacity-40"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
