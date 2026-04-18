import React from 'react';
import { Carrier, CARGO_TYPES } from '../types';

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="badge-inactive">Unknown</span>;
  const s = status.toLowerCase();
  if (s === 'active') return <span className="badge-active"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Active</span>;
  if (s.includes('out of service')) return <span className="badge-oos"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> Out of Service</span>;
  return <span className="badge-inactive"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" /> Inactive</span>;
}

export function OpTypeBadge({ carrier }: { carrier: Carrier }) {
  const op = (carrier.carrier_operation || '').toUpperCase();
  if (op === 'A') return <span className="badge-interstate">Interstate</span>;
  if (op === 'B') return <span className="badge-intrastate">Intrastate HM</span>;
  if (op === 'C') return <span className="badge-intrastate">Intrastate</span>;
  if (carrier.op_carrier_flag) return <span className="badge-interstate">Interstate</span>;
  return null;
}

export function SafetyBadge({ rating }: { rating: string | null }) {
  if (!rating || !rating.trim()) return <span className="text-ink-400 text-xs">Not Rated</span>;
  const r = rating.toLowerCase();
  if (r.includes('satisfactory') && !r.includes('un') && !r.includes('cond')) return <span className="badge-satisfactory">Satisfactory</span>;
  if (r.includes('conditional')) return <span className="badge-conditional">Conditional</span>;
  if (r.includes('unsatisfactory')) return <span className="badge-unsatisfactory">Unsatisfactory</span>;
  return <span className="badge-inactive">{rating}</span>;
}

export function CrmBadge({ status }: { status: string | null }) {
  const s = status || 'New';
  const cls: Record<string,string> = {
    'New': 'crm-new', 'Contacted': 'crm-contacted',
    'In Negotiation': 'crm-negotiation', 'Subcontractor Added': 'crm-subcontractor',
    'Do Not Call': 'crm-dnc',
  };
  return <span className={cls[s] || 'badge-inactive'}>{s}</span>;
}

export function InsuranceBadge({ carrier }: { carrier: Carrier }) {
  const has = carrier.insurance_on_file || carrier.bipd_insurance_on_file || carrier.cargo_insurance_on_file;
  return has ? <span className="badge-satisfactory">Insured</span> : <span className="badge-inactive">No Insurance</span>;
}

export function ProposalStatusBadge({ status }: { status: string }) {
  const colors: Record<string,string> = {
    'Awarded': 'bg-green-900/50 text-green-400 border-green-800',
    'Submitted': 'bg-blue-900/50 text-blue-400 border-blue-800',
    'Not Awarded': 'bg-red-900/50 text-red-400 border-red-800',
    'Cancelled': 'bg-ink-700 text-ink-400 border-ink-600',
    'No Bid': 'bg-ink-700 text-ink-400 border-ink-600',
    'Waiting on Sub Quote': 'bg-orange-900/50 text-orange-400 border-orange-800',
    'Waiting on Teaming Partner': 'bg-orange-900/50 text-orange-400 border-orange-800',
    'Proposal In Progress': 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    'Internal Review': 'bg-purple-900/50 text-purple-400 border-purple-800',
  };
  const cls = colors[status] || 'bg-gold-900/40 text-gold-400 border-gold-800';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function CargoTags({ carrier, max = 5 }: { carrier: Carrier; max?: number }) {
  const active: string[] = [];
  for (const [field, label] of Object.entries(CARGO_TYPES)) {
    if ((carrier as unknown as Record<string,unknown>)[field] === true) active.push(label);
  }
  if (!active.length) return <span className="text-ink-500 text-xs">None</span>;
  const visible = active.slice(0, max);
  const rest = active.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map(l => <span key={l} className="pill">{l}</span>)}
      {rest > 0 && <span className="pill text-gold-400">+{rest}</span>}
    </div>
  );
}

export function DaysCountdown({ date, urgentDays = 7, warnDays = 14 }: { date: string | null; urgentDays?: number; warnDays?: number }) {
  if (!date) return <span className="text-ink-400 text-xs">No deadline</span>;
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  if (days < 0) return <span className="text-red-400 text-xs font-semibold">Expired</span>;
  if (days <= urgentDays) return <span className="text-red-400 text-xs font-semibold">{days}d left</span>;
  if (days <= warnDays) return <span className="text-amber-400 text-xs font-semibold">{days}d left</span>;
  return <span className="text-green-400 text-xs">{days}d left</span>;
}

export function formatCurrency(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v >= 1e9) return `$${(v/1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v/1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v/1e3).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

export function formatPhone(phone: string | null): string {
  if (!phone) return '—';
  const d = phone.replace(/\D/g,'');
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return phone;
}
