import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { ProposalStatusBadge, DaysCountdown, formatCurrency } from '../../components/StatusBadge';
import { Proposal, PROPOSAL_STATUSES, COMMON_AGENCIES } from '../../types';
import { PlusIcon, MagnifyingGlassIcon, Squares2X2Icon, TableCellsIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '../../store/authStore';

const KANBAN_COLS = [
  ['Identified', 'Bid/No Bid Decision', 'Proposal In Progress'],
  ['Internal Review', 'Waiting on Sub Quote', 'Waiting on Teaming Partner'],
  ['Submitted', 'Awarded', 'Not Awarded'],
  ['No Bid', 'Cancelled'],
];

const FLAT_COLS = KANBAN_COLS.flat();

const COL_COLORS: Record<string, string> = {
  'Identified': 'border-t-ink-400',
  'Bid/No Bid Decision': 'border-t-amber-500',
  'Proposal In Progress': 'border-t-yellow-500',
  'Internal Review': 'border-t-purple-500',
  'Waiting on Sub Quote': 'border-t-orange-500',
  'Waiting on Teaming Partner': 'border-t-orange-400',
  'Submitted': 'border-t-blue-500',
  'Awarded': 'border-t-green-500',
  'Not Awarded': 'border-t-red-500',
  'No Bid': 'border-t-ink-600',
  'Cancelled': 'border-t-ink-600',
};

export default function ProposalsPage() {
  const { user } = useAuthStore();
  const isViewer = user?.role === 'viewer';
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [q, setQ] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (q) params.q = q;
      if (agencyFilter) params.agency = agencyFilter;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/govcon/proposals', { params });
      setProposals(data.proposals || data || []);
    } catch { toast.error('Failed to load proposals'); }
    finally { setLoading(false); }
  }, [q, agencyFilter, statusFilter]);

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: number, status: string) => {
    try {
      const { data } = await api.patch(`/govcon/proposals/${id}`, { status });
      setProposals(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    } catch { toast.error('Failed to update status'); }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    if (dragging !== null && !isViewer) {
      updateStatus(dragging, targetStatus);
    }
    setDragging(null); setDragOver(null);
  };

  const byStatus = (status: string) => proposals.filter(p => p.status === status);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Proposal Management</h1>
          <p className="page-sub">{proposals.length} proposals · Drag cards to update status</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('kanban')} className={`btn ${view === 'kanban' ? 'btn-gold' : 'btn-ghost'} p-2`}><Squares2X2Icon className="w-4 h-4" /></button>
          <button onClick={() => setView('list')} className={`btn ${view === 'list' ? 'btn-gold' : 'btn-ghost'} p-2`}><TableCellsIcon className="w-4 h-4" /></button>
          {!isViewer && <Link to="/proposals/new" className="btn btn-gold flex items-center gap-2"><PlusIcon className="w-4 h-4" />New Proposal</Link>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input className="input pl-9" placeholder="Search proposals..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
        <select className="select w-52" value={agencyFilter} onChange={e => { setAgencyFilter(e.target.value); }}>
          <option value="">All Agencies</option>
          {COMMON_AGENCIES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {view === 'list' && (
          <select className="select w-52" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {PROPOSAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {/* Kanban Board */}
      {view === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {FLAT_COLS.map(col => {
              const colCards = byStatus(col);
              const isDragTarget = dragOver === col;
              return (
                <div
                  key={col}
                  className={`w-64 flex-shrink-0 rounded-xl border-t-2 ${COL_COLORS[col] || 'border-t-ink-600'} bg-ink-800/50 ${isDragTarget ? 'ring-2 ring-gold-500/50' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(col); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => handleDrop(e, col)}
                >
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-xs font-semibold text-ink-200">{col}</span>
                    <span className="text-xs bg-ink-700 text-ink-300 rounded-full px-1.5">{colCards.length}</span>
                  </div>
                  <div className="space-y-2 p-2 min-h-[100px]">
                    {colCards.map(p => (
                      <div
                        key={p.id}
                        draggable={!isViewer}
                        onDragStart={() => setDragging(p.id)}
                        onDragEnd={() => { setDragging(null); setDragOver(null); }}
                        className={`bg-ink-900 border border-ink-700 rounded-lg p-3 cursor-pointer hover:border-gold-700 transition-all ${dragging === p.id ? 'opacity-50' : ''}`}
                      >
                        <Link to={`/proposals/${p.id}`} className="block" onClick={e => dragging !== null && e.preventDefault()}>
                          <p className="text-xs font-medium text-white leading-snug line-clamp-2 mb-2">{p.contract_name}</p>
                          <p className="text-[10px] text-gold-400 truncate mb-1">{p.agency}</p>
                          <div className="flex items-center justify-between mt-2">
                            <DaysCountdown date={p.proposal_due_date || null} />
                            <span className="text-[10px] text-ink-400">{formatCurrency(p.contract_value)}</span>
                          </div>
                          {p.pending_quotes > 0 && (
                            <div className="mt-1.5 text-[10px] text-orange-400">⚠ {p.pending_quotes} sub quote{p.pending_quotes > 1 ? 's' : ''} pending</div>
                          )}
                        </Link>
                      </div>
                    ))}
                    {colCards.length === 0 && <div className="text-center py-4 text-[10px] text-ink-600">Drop here</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-800 border-b border-ink-700">
              <tr>
                <th className="th text-left">Proposal</th>
                <th className="th">Agency</th>
                <th className="th">Sol. #</th>
                <th className="th">Due Date</th>
                <th className="th">Value</th>
                <th className="th">Status</th>
                <th className="th">Sub Quotes</th>
              </tr>
            </thead>
            <tbody>
              {proposals.filter(p => !statusFilter || p.status === statusFilter).map(p => (
                <tr key={p.id} className="tr-hover">
                  <td className="td">
                    <Link to={`/proposals/${p.id}`} className="font-medium text-white hover:text-gold-400 block max-w-[220px] truncate">{p.contract_name}</Link>
                    {p.solicitation_number && <div className="text-xs text-ink-400 font-mono">{p.solicitation_number}</div>}
                  </td>
                  <td className="td text-center text-xs text-ink-300"><span className="truncate block max-w-[140px]">{p.agency}</span></td>
                  <td className="td text-center font-mono text-xs text-ink-400">{p.solicitation_number || '—'}</td>
                  <td className="td text-center">
                    <DaysCountdown date={p.proposal_due_date || null} />
                    {p.proposal_due_date && <div className="text-[10px] text-ink-500 mt-0.5">{format(new Date(p.proposal_due_date), 'MMM d')}</div>}
                  </td>
                  <td className="td text-center text-ink-300 text-xs">{formatCurrency(p.contract_value)}</td>
                  <td className="td text-center"><ProposalStatusBadge status={p.status} /></td>
                  <td className="td text-center">
                    {p.pending_quotes > 0 ? <span className="text-orange-400 text-xs">⚠ {p.pending_quotes}</span> : <span className="text-ink-500 text-xs">—</span>}
                  </td>
                </tr>
              ))}
              {proposals.length === 0 && (
                <tr><td colSpan={7} className="text-center py-16 text-ink-400 text-sm">No proposals yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
