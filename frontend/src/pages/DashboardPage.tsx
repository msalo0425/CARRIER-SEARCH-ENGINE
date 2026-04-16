import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { formatCurrency, DaysCountdown } from '../components/StatusBadge';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { TruckIcon, PhoneIcon, ChartBarIcon, ClockIcon, CheckCircleIcon, DocumentTextIcon, BoltIcon, ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const [carrierData, setCarrierData] = useState<Record<string,unknown>>({});
  const [govData, setGovData] = useState<Record<string,unknown>>({});
  const [aggData, setAggData] = useState<Record<string,unknown>>({});
  const [followUps, setFollowUps] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/carriers/dashboard'),
      api.get('/govcon/dashboard'),
      api.get('/aggregator/dashboard'),
      api.get('/carriers/follow-ups/today'),
    ]).then(([c, g, a, f]) => {
      setCarrierData(c.data);
      setGovData(g.data);
      setAggData(a.data);
      setFollowUps(f.data);
    }).catch(() => toast.error('Failed to load dashboard'))
    .finally(() => setLoading(false));
  }, []);

  const complete = async (id: number) => {
    try { await api.patch(`/follow-ups/${id}/complete`); setFollowUps(prev => (prev as {id:number}[]).filter(f=>f.id!==id)); toast.success('Done'); }
    catch { toast.error('Failed'); }
  };

  const fmtTime = (s: string) => { try { return format(parseISO(s), 'MMM d h:mm a'); } catch { return s; } };

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin"/></div>;

  const statCards = [
    { label: 'Total Carriers', val: Number(carrierData.total_carriers||0).toLocaleString(), icon: TruckIcon, color: 'text-gold-400', bg: 'bg-gold-900/20' },
    { label: 'Active Carriers', val: Number(carrierData.active_carriers||0).toLocaleString(), icon: CheckCircleIcon, color: 'text-green-400', bg: 'bg-green-900/20' },
    { label: 'Contacted', val: Number(carrierData.total_contacted||0).toLocaleString(), icon: PhoneIcon, color: 'text-blue-400', bg: 'bg-blue-900/20' },
    { label: 'In Pipeline', val: Number(carrierData.in_pipeline||0).toLocaleString(), icon: ChartBarIcon, color: 'text-purple-400', bg: 'bg-purple-900/20' },
    { label: 'Follow-Ups Today', val: String(followUps.length), icon: ClockIcon, color: followUps.length>0?'text-red-400':'text-ink-400', bg: followUps.length>0?'bg-red-900/20':'bg-ink-700' },
    { label: 'Active Opportunities', val: String(govData.active_opportunities||0), icon: DocumentTextIcon, color: 'text-gold-400', bg: 'bg-gold-900/20' },
    { label: 'Active Proposals', val: String(govData.total_proposals||0), icon: BoltIcon, color: 'text-amber-400', bg: 'bg-amber-900/20' },
    { label: 'Pipeline Value', val: formatCurrency(govData.pipeline_value as number), icon: ChartBarIcon, color: 'text-green-400', bg: 'bg-green-900/20' },
    { label: 'Won Value', val: formatCurrency(govData.won_value as number), icon: CheckCircleIcon, color: 'text-gold-400', bg: 'bg-gold-900/20' },
    { label: 'Win Rate', val: `${govData.win_rate||0}%`, icon: ChartBarIcon, color: 'text-green-400', bg: 'bg-green-900/20' },
    { label: 'Outstanding Sub Quotes', val: String(govData.outstanding_sub_quotes||0), icon: ExclamationTriangleIcon, color: 'text-orange-400', bg: 'bg-orange-900/20' },
    { label: 'New Opportunities Today', val: String(aggData.new_today||0), icon: BoltIcon, color: 'text-gold-400', bg: 'bg-gold-900/20' },
  ];

  const expiringCerts = (govData.expiring_certifications as unknown[]) || [];
  const proposalsDueThisWeek = (govData.proposals_due_this_week as unknown[]) || [];
  const recentActivity = (carrierData.recent_activity as unknown[]) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="page-title">Master Dashboard</h1>
        <p className="page-sub">Black Clover Logistics — {format(new Date(),'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {statCards.map(({label, val, icon: Icon, color, bg}) => (
          <div key={label} className="card p-4">
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className={`text-xl font-bold ${color}`}>{val}</div>
            <div className="text-xs text-ink-400 mt-0.5 leading-tight">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Follow-ups */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between p-4 border-b border-ink-700">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-red-400" /> Follow-Ups Today
              {followUps.length > 0 && <span className="bg-red-600 text-white text-xs px-1.5 rounded-full">{followUps.length}</span>}
            </h2>
            <Link to="/crm" className="text-xs text-gold-400 hover:text-gold-300">View all →</Link>
          </div>
          <div className="divide-y divide-ink-700">
            {followUps.length === 0 ? (
              <div className="p-6 text-center text-ink-400">
                <CheckCircleIcon className="w-8 h-8 mx-auto mb-2 text-green-600/50" />
                <p className="text-sm">All caught up!</p>
              </div>
            ) : (followUps as {id:number;dot_number:string;carrier_name?:string;telephone?:string;due_time?:string;notes?:string}[]).slice(0,6).map(fu => (
              <div key={fu.id} className="flex gap-3 p-3 hover:bg-ink-700/40">
                <div className="flex-1 min-w-0">
                  <Link to={`/carriers/${fu.dot_number}`} className="text-xs font-medium text-white hover:text-gold-400 truncate block">{fu.carrier_name||`DOT ${fu.dot_number}`}</Link>
                  <p className="text-[10px] text-ink-400">{fu.due_time||'All day'}{fu.notes&&` · ${fu.notes}`}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Link to={`/carriers/${fu.dot_number}`} className="btn btn-outline py-0.5 px-2 text-xs">Call</Link>
                  <button onClick={()=>complete(fu.id)} className="btn btn-ghost py-0.5 px-2 text-xs text-green-400">Done</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Proposals due */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between p-4 border-b border-ink-700">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <DocumentTextIcon className="w-4 h-4 text-amber-400" /> Proposals Due This Week
            </h2>
            <Link to="/proposals" className="text-xs text-gold-400 hover:text-gold-300">View all →</Link>
          </div>
          <div className="divide-y divide-ink-700">
            {proposalsDueThisWeek.length === 0 ? (
              <div className="p-6 text-center text-ink-400 text-sm">No proposals due this week</div>
            ) : (proposalsDueThisWeek as {contract_name:string;agency?:string;proposal_due_date?:string;contract_value?:number}[]).map((p,i) => (
              <div key={i} className="flex items-start gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{p.contract_name}</p>
                  <p className="text-[10px] text-ink-400 truncate">{p.agency}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <DaysCountdown date={p.proposal_due_date||null} />
                  <p className="text-[10px] text-ink-400 mt-0.5">{formatCurrency(p.contract_value)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Aggregator widget */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between p-4 border-b border-ink-700">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <BoltIcon className="w-4 h-4 text-gold-400" /> Solicitation Aggregator
            </h2>
            <Link to="/aggregator" className="text-xs text-gold-400 hover:text-gold-300">View all →</Link>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              {label:'New Today', val:aggData.new_today||0, color:'text-gold-400'},
              {label:'WOSB Available', val:aggData.wosb_available||0, color:'text-gold-400'},
              {label:'Expiring Soon', val:aggData.expiring_soon||0, color:'text-red-400'},
              {label:'Total Active', val:aggData.total_solicitations||0, color:'text-white'},
            ].map(({label,val,color})=>(
              <div key={label} className="bg-ink-700/50 rounded-lg p-3">
                <div className={`text-lg font-bold ${color}`}>{String(val)}</div>
                <div className="text-[10px] text-ink-400">{label}</div>
              </div>
            ))}
          </div>
          {(aggData as {last_sync?:{completed_at?:string;status?:string}}).last_sync && (
            <div className="px-4 pb-4 text-[10px] text-ink-500">
              Last sync: {fmtTime((aggData as any).last_sync?.completed_at||'')}
            </div>
          )}
        </div>
      </div>

      {/* Expiring certs + Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {expiringCerts.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-ink-700">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <ShieldCheckIcon className="w-4 h-4 text-amber-400" /> Certifications Expiring Soon
              </h2>
              <Link to="/certifications" className="text-xs text-gold-400">Manage →</Link>
            </div>
            <div className="divide-y divide-ink-700">
              {(expiringCerts as {name:string;expiration_date?:string;days_until_expiry?:number}[]).map((c,i) => (
                <div key={i} className="flex items-center justify-between p-3">
                  <span className="text-xs text-white">{c.name}</span>
                  <span className={`text-xs font-semibold ${(c.days_until_expiry||0)<=30?'text-red-400':'text-amber-400'}`}>
                    {c.expiration_date} ({c.days_until_expiry}d)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="p-4 border-b border-ink-700">
            <h2 className="font-semibold text-white">Recent Activity</h2>
          </div>
          <div className="divide-y divide-ink-700">
            {recentActivity.length === 0 ? (
              <p className="p-6 text-center text-ink-400 text-sm">No recent activity</p>
            ) : (recentActivity as {id:number;user_name?:string;action:string;carrier_name?:string;dot_number?:string;description?:string;created_at:string}[]).map(item => (
              <div key={item.id} className="flex gap-3 p-3 hover:bg-ink-700/40">
                <div className="w-7 h-7 rounded-full bg-ink-600 flex items-center justify-center text-xs text-ink-300 flex-shrink-0 font-bold">
                  {(item.user_name||'?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white">
                    <span className="font-medium">{item.user_name||'System'}</span>
                    {' '}{item.action.toLowerCase().replace(/_/g,' ')}
                    {item.carrier_name && <> · <Link to={`/carriers/${item.dot_number}`} className="text-gold-400">{item.carrier_name}</Link></>}
                  </p>
                  <p className="text-[10px] text-ink-500">{fmtTime(item.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card p-5">
        <p className="text-sm font-semibold text-white mb-3">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          <Link to="/carriers" className="btn btn-gold">Search Carriers</Link>
          <Link to="/crm" className="btn btn-ghost">Log a Call</Link>
          <Link to="/proposals" className="btn btn-ghost">New Proposal</Link>
          <Link to="/aggregator" className="btn btn-outline">Browse Solicitations</Link>
          <Link to="/opportunities" className="btn btn-ghost">Track Opportunity</Link>
        </div>
      </div>
    </div>
  );
}
