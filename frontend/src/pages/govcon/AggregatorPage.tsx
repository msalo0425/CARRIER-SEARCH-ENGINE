import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import { DaysCountdown, formatCurrency } from '../../components/StatusBadge';
import { BoltIcon, MagnifyingGlassIcon, FunnelIcon, ArrowPathIcon, StarIcon, PlusCircleIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '../../store/authStore';

interface Solicitation {
  id: number;
  source: string;
  external_id: string;
  title: string;
  agency: string;
  naics_code?: string;
  set_aside_type?: string;
  response_due_date?: string;
  estimated_value_min?: number;
  estimated_value_max?: number;
  place_of_performance?: string;
  description?: string;
  status: string;
  is_wosb_eligible: boolean;
  is_edwosb_eligible: boolean;
  proposal_id?: number;
  created_at: string;
}

interface MarketIntel {
  agency: string;
  naics_code: string;
  total_awards: number;
  total_value: number;
  avg_value: number;
  wosb_awards: number;
}

interface SyncLog { id: number; status: string; source: string; records_fetched: number; records_upserted: number; completed_at?: string; started_at: string; error_message?: string; }

const SOURCES = ['sam.gov', 'usaspending', 'dla_dibbs', 'gsa_ebuy'];
const SET_ASIDES = ['Total Small Business', 'WOSB', 'EDWOSB', '8(a)', 'HUBZone', 'SDVOSB', 'Women Owned Small Business'];

export default function AggregatorPage() {
  const { user } = useAuthStore();
  const isViewer = user?.role === 'viewer';
  const [tab, setTab] = useState<'solicitations' | 'intelligence' | 'sync'>('solicitations');
  const [solicitations, setSolicitations] = useState<Solicitation[]>([]);
  const [intel, setIntel] = useState<MarketIntel[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [q, setQ] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [setAsideFilter, setSetAsideFilter] = useState('');
  const [wosbOnly, setWosbOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadSolicitations = useCallback(async (pg = 1) => {
    try {
      const params: Record<string, string | number> = { page: pg, page_size: 50 };
      if (q) params.q = q;
      if (agencyFilter) params.agency = agencyFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (setAsideFilter) params.set_aside = setAsideFilter;
      if (wosbOnly) params.wosb = 'true';
      const { data } = await api.get('/aggregator/solicitations', { params });
      setSolicitations(data.solicitations || []);
      setTotal(data.total || 0);
      setPage(pg);
    } catch { toast.error('Failed to load solicitations'); }
    finally { setLoading(false); }
  }, [q, agencyFilter, sourceFilter, setAsideFilter, wosbOnly]);

  const loadIntel = async () => {
    try {
      const { data } = await api.get('/aggregator/market-intelligence');
      setIntel(data || []);
    } catch { /* silent */ }
  };

  const loadSyncLogs = async () => {
    try {
      const { data } = await api.get('/aggregator/sync-logs');
      setSyncLogs(data || []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    loadSolicitations();
    loadIntel();
    loadSyncLogs();
  }, []);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await api.post('/aggregator/sync');
      toast.success('Sync started — this may take a few minutes');
      setTimeout(() => { loadSyncLogs(); loadSolicitations(); setSyncing(false); }, 3000);
    } catch { toast.error('Failed to start sync'); setSyncing(false); }
  };

  const addToProposals = async (sol: Solicitation) => {
    if (sol.proposal_id) { toast('Already added to proposals'); return; }
    try {
      await api.post(`/aggregator/solicitations/${sol.id}/add-to-proposals`);
      setSolicitations(prev => prev.map(s => s.id === sol.id ? { ...s, proposal_id: -1 } : s));
      toast.success('Added to proposals!');
    } catch (err: any) {
      if (err?.response?.status === 409) toast('Already in proposals');
      else toast.error('Failed to add');
    }
  };

  const sourceLabel = (s: string) => ({ 'sam.gov': 'SAM.gov', 'usaspending': 'USASpending', 'dla_dibbs': 'DLA DIBBS', 'gsa_ebuy': 'GSA eBuy' }[s] || s);
  const fmtDate = (s?: string) => { if (!s) return '—'; try { return format(parseISO(s), 'MMM d, yyyy'); } catch { return s; } };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Live Opportunities</h1>
          <p className="page-sub">{total.toLocaleString()} solicitations · SAM.gov + USASpending + DLA DIBBS</p>
        </div>
        <div className="flex items-center gap-2">
          {!isViewer && (
            <button onClick={triggerSync} disabled={syncing} className="btn btn-outline flex items-center gap-2">
              <ArrowPathIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-ink-700">
        <nav className="flex gap-4">
          {(['solicitations', 'intelligence', 'sync'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors flex items-center gap-1.5 ${tab === t ? 'border-gold-500 text-gold-400' : 'border-transparent text-ink-400 hover:text-ink-50'}`}>
              {t === 'solicitations' && <BoltIcon className="w-4 h-4" />}
              {t === 'intelligence' && <ChartBarIcon className="w-4 h-4" />}
              {t === 'sync' && <ArrowPathIcon className="w-4 h-4" />}
              {t === 'intelligence' ? 'Market Intelligence' : t === 'sync' ? 'Sync Logs' : 'Solicitations'}
            </button>
          ))}
        </nav>
      </div>

      {/* Solicitations Tab */}
      {tab === 'solicitations' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input className="input pl-9" placeholder="Search solicitations..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadSolicitations(1)} />
            </div>
            <input className="input w-48" placeholder="Agency..." value={agencyFilter} onChange={e => setAgencyFilter(e.target.value)} />
            <select className="select w-36" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
              <option value="">All Sources</option>
              {SOURCES.map(s => <option key={s} value={s}>{sourceLabel(s)}</option>)}
            </select>
            <select className="select w-44" value={setAsideFilter} onChange={e => setSetAsideFilter(e.target.value)}>
              <option value="">All Set-Asides</option>
              {SET_ASIDES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 card">
              <input type="checkbox" className="w-4 h-4 rounded" checked={wosbOnly} onChange={e => setWosbOnly(e.target.checked)} />
              <span className="text-sm text-gold-400 flex items-center gap-1"><StarIcon className="w-3.5 h-3.5 fill-gold-400" />WOSB Only</span>
            </label>
            <button onClick={() => loadSolicitations(1)} className="btn btn-outline flex items-center gap-1"><FunnelIcon className="w-4 h-4" />Filter</button>
          </div>

          <div className="text-xs text-ink-400">{total.toLocaleString()} results</div>

          <div className="space-y-2">
            {solicitations.length === 0 ? (
              <div className="card p-16 text-center">
                <BoltIcon className="w-12 h-12 mx-auto mb-4 text-ink-600" />
                <p className="text-ink-50 font-medium">No solicitations found</p>
                <p className="text-ink-400 text-sm mt-1">Try adjusting your filters or trigger a sync.</p>
              </div>
            ) : solicitations.map(sol => (
              <div key={sol.id} className="card p-4 hover:border-ink-600 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {(sol.is_wosb_eligible || sol.is_edwosb_eligible) && (
                        <span className="badge-wosb flex items-center gap-1 text-[10px]">
                          <StarIcon className="w-3 h-3 fill-gold-400" />
                          {sol.is_edwosb_eligible ? 'EDWOSB' : 'WOSB'}
                        </span>
                      )}
                      <span className="badge bg-ink-700 text-ink-300 border-ink-600 text-[10px]">{sourceLabel(sol.source)}</span>
                      {sol.set_aside_type && <span className="badge bg-purple-900/30 text-purple-300 border-purple-800 text-[10px]">{sol.set_aside_type}</span>}
                      {sol.status === 'Added to Proposals' && <span className="badge bg-green-900/30 text-green-400 border-green-800 text-[10px]">In Proposals</span>}
                    </div>
                    <h3 className="text-sm font-semibold text-ink-50 leading-snug">{sol.title}</h3>
                    <p className="text-xs text-gold-400 mt-0.5">{sol.agency}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-ink-400">
                      {sol.naics_code && <span>NAICS {sol.naics_code}</span>}
                      {sol.place_of_performance && <span>📍 {sol.place_of_performance}</span>}
                      {(sol.estimated_value_min || sol.estimated_value_max) && (
                        <span className="text-green-400">{formatCurrency(sol.estimated_value_min)} – {formatCurrency(sol.estimated_value_max)}</span>
                      )}
                    </div>
                    {sol.description && <p className="text-xs text-ink-400 mt-2 line-clamp-2">{sol.description}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <DaysCountdown date={sol.response_due_date || null} urgentDays={3} warnDays={7} />
                    <div className="text-[10px] text-ink-500">{fmtDate(sol.response_due_date)}</div>
                    {!isViewer && !sol.proposal_id && (
                      <button onClick={() => addToProposals(sol)} className="btn btn-gold text-xs py-1 px-2.5 flex items-center gap-1">
                        <PlusCircleIcon className="w-3.5 h-3.5" /> Add to Proposals
                      </button>
                    )}
                    {sol.proposal_id && <span className="text-green-400 text-xs">✓ In Proposals</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {total > 50 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => loadSolicitations(page - 1)} disabled={page <= 1} className="btn btn-ghost text-xs disabled:opacity-30">← Prev</button>
              <span className="text-xs text-ink-400">Page {page} of {Math.ceil(total / 50)}</span>
              <button onClick={() => loadSolicitations(page + 1)} disabled={page >= Math.ceil(total / 50)} className="btn btn-ghost text-xs disabled:opacity-30">Next →</button>
            </div>
          )}
        </div>
      )}

      {/* Market Intelligence Tab */}
      {tab === 'intelligence' && (
        <div className="space-y-4">
          <p className="text-sm text-ink-400">Spending data from USASpending.gov — historical contract awards in your NAICS codes</p>
          {intel.length === 0 ? (
            <div className="card p-12 text-center">
              <ChartBarIcon className="w-12 h-12 mx-auto mb-4 text-ink-600" />
              <p className="text-ink-50 font-medium">No intelligence data yet</p>
              <p className="text-ink-400 text-sm mt-1">Run a sync to pull USASpending data</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink-800 border-b border-ink-700">
                  <tr>
                    <th className="th text-left">Agency</th>
                    <th className="th">NAICS</th>
                    <th className="th">Total Awards</th>
                    <th className="th">Total Value</th>
                    <th className="th">Avg Award</th>
                    <th className="th">WOSB Awards</th>
                  </tr>
                </thead>
                <tbody>
                  {intel.map((row, i) => (
                    <tr key={i} className="tr-hover">
                      <td className="td font-medium text-ink-50 truncate max-w-[200px]">{row.agency}</td>
                      <td className="td text-center font-mono text-xs text-ink-300">{row.naics_code}</td>
                      <td className="td text-center text-ink-200">{row.total_awards?.toLocaleString()}</td>
                      <td className="td text-center text-green-400">{formatCurrency(row.total_value)}</td>
                      <td className="td text-center text-ink-300">{formatCurrency(row.avg_value)}</td>
                      <td className="td text-center">
                        {row.wosb_awards > 0 ? <span className="text-gold-400 font-medium">{row.wosb_awards}</span> : <span className="text-ink-500">0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sync Logs Tab */}
      {tab === 'sync' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-400">Sync runs twice daily at 6AM and 6PM EST</p>
            {!isViewer && (
              <button onClick={triggerSync} disabled={syncing} className="btn btn-gold flex items-center gap-2">
                <ArrowPathIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Trigger Sync'}
              </button>
            )}
          </div>
          {syncLogs.length === 0 ? (
            <div className="card p-12 text-center text-ink-400 text-sm">No sync logs yet.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink-800 border-b border-ink-700">
                  <tr>
                    <th className="th text-left">Started</th>
                    <th className="th">Source</th>
                    <th className="th">Status</th>
                    <th className="th">Fetched</th>
                    <th className="th">Upserted</th>
                    <th className="th">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map(log => (
                    <tr key={log.id} className="tr-hover">
                      <td className="td text-xs text-ink-300">{fmtDate(log.started_at)}</td>
                      <td className="td text-center text-xs">{sourceLabel(log.source)}</td>
                      <td className="td text-center">
                        <span className={`badge text-xs ${log.status === 'completed' ? 'bg-green-900/50 text-green-400 border-green-800' : log.status === 'failed' ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-amber-900/30 text-amber-400 border-amber-800'}`}>{log.status}</span>
                      </td>
                      <td className="td text-center text-ink-300">{log.records_fetched?.toLocaleString() || '—'}</td>
                      <td className="td text-center text-ink-300">{log.records_upserted?.toLocaleString() || '—'}</td>
                      <td className="td text-center text-xs text-ink-400">{log.completed_at ? fmtDate(log.completed_at) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
