import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { ArrowPathIcon, PlusIcon, TrashIcon, PencilIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '../store/authStore';

interface AppUser { id: number; email: string; full_name?: string; role: string; is_active: boolean; created_at: string; last_login?: string; }
interface AggSettings { enabled_sources: string[]; naics_codes: string[]; sync_schedule: string; min_value?: number; max_value?: number; keywords?: string; }
interface SyncLog { id: number; sync_type: string; status: string; records_fetched?: number; records_upserted?: number; started_at: string; completed_at?: string; error?: string; }

const ROLES = ['admin', 'sales_rep', 'viewer'];
const SOURCES = [{ id: 'sam.gov', label: 'SAM.gov' }, { id: 'usaspending', label: 'USASpending.gov' }, { id: 'dla_dibbs', label: 'DLA DIBBS' }, { id: 'gsa_ebuy', label: 'GSA eBuy' }];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<'users' | 'aggregator' | 'sync'>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [aggSettings, setAggSettings] = useState<AggSettings>({ enabled_sources: ['sam.gov'], naics_codes: [], sync_schedule: '0 6,18 * * *' });
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // User modal
  const [userModal, setUserModal] = useState<Partial<AppUser & { password: string }> | null>(null);
  const [userSaving, setUserSaving] = useState(false);

  // NAICS input
  const [newNaics, setNewNaics] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      api.get('/auth/users'),
      api.get('/aggregator/settings'),
      api.get('/aggregator/sync-logs'),
    ]).then(([u, s, l]) => {
      setUsers(u.data || []);
      setAggSettings(s.data || aggSettings);
      setSyncLogs(l.data || []);
    }).catch(() => toast.error('Failed to load settings'))
    .finally(() => setLoading(false));
  }, []);

  const saveUser = async () => {
    if (!userModal?.email) { toast.error('Email required'); return; }
    if (!userModal?.role) { toast.error('Role required'); return; }
    setUserSaving(true);
    try {
      if (userModal.id) {
        const { data } = await api.put(`/auth/users/${userModal.id}`, { full_name: userModal.full_name, role: userModal.role });
        setUsers(prev => prev.map(u => u.id === userModal.id ? { ...u, ...data } : u));
        toast.success('User updated');
      } else {
        if (!userModal.password) { toast.error('Password required'); setUserSaving(false); return; }
        const { data } = await api.post('/auth/users', { email: userModal.email, password: userModal.password, full_name: userModal.full_name, role: userModal.role });
        setUsers(prev => [...prev, data]);
        toast.success('User created');
      }
      setUserModal(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save user');
    } finally { setUserSaving(false); }
  };

  const toggleUser = async (u: AppUser) => {
    try {
      await api.patch(`/auth/users/${u.id}/toggle`);
      setUsers(prev => prev.map(us => us.id === u.id ? { ...us, is_active: !us.is_active } : us));
      toast.success(u.is_active ? 'User deactivated' : 'User activated');
    } catch { toast.error('Failed'); }
  };

  const deleteUser = async (id: number) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try { await api.delete(`/auth/users/${id}`); setUsers(prev => prev.filter(u => u.id !== id)); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };

  const saveAggSettings = async () => {
    try {
      await api.put('/aggregator/settings', aggSettings);
      toast.success('Settings saved');
    } catch { toast.error('Failed to save'); }
  };

  const addNaics = () => {
    const code = newNaics.trim();
    if (!code) return;
    if (aggSettings.naics_codes.includes(code)) { toast('Already added'); return; }
    setAggSettings(s => ({ ...s, naics_codes: [...s.naics_codes, code] }));
    setNewNaics('');
  };

  const removeNaics = (code: string) => setAggSettings(s => ({ ...s, naics_codes: s.naics_codes.filter(c => c !== code) }));

  const triggerFmcsaSync = async () => {
    setSyncing(true);
    try {
      await api.post('/settings/trigger-fmcsa-sync');
      toast.success('FMCSA sync started');
      setTimeout(() => setSyncing(false), 3000);
    } catch { toast.error('Failed to start sync'); setSyncing(false); }
  };

  const triggerAggSync = async () => {
    setSyncing(true);
    try {
      await api.post('/aggregator/sync');
      toast.success('Aggregator sync started');
      setTimeout(() => setSyncing(false), 3000);
    } catch { toast.error('Failed to start sync'); setSyncing(false); }
  };

  const fmtDate = (s?: string) => { if (!s) return '—'; try { return format(parseISO(s), 'MMM d, yyyy h:mm a'); } catch { return s; } };

  if (!isAdmin) return (
    <div className="p-8 text-center">
      <p className="text-ink-400">Settings are only accessible to administrators.</p>
    </div>
  );

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">System administration & configuration</p>
      </div>

      <div className="border-b border-ink-700">
        <nav className="flex gap-4">
          {(['users', 'aggregator', 'sync'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-gold-500 text-gold-400' : 'border-transparent text-ink-400 hover:text-white'}`}>
              {t === 'aggregator' ? 'Aggregator Config' : t === 'sync' ? 'Sync History' : 'User Management'}
            </button>
          ))}
        </nav>
      </div>

      {/* User Management */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-400">{users.length} users</p>
            <button onClick={() => setUserModal({ email: '', full_name: '', role: 'sales_rep', password: '' })} className="btn btn-gold flex items-center gap-2">
              <PlusIcon className="w-4 h-4" /> Add User
            </button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-800 border-b border-ink-700">
                <tr>
                  <th className="th text-left">User</th>
                  <th className="th">Role</th>
                  <th className="th">Status</th>
                  <th className="th">Last Login</th>
                  <th className="th">Created</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={`tr-hover ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="td">
                      <div className="font-medium text-white">{u.full_name || u.email}</div>
                      {u.full_name && <div className="text-xs text-ink-400">{u.email}</div>}
                    </td>
                    <td className="td text-center">
                      <span className={`badge text-xs ${u.role === 'admin' ? 'bg-gold-900/50 text-gold-400 border-gold-800' : u.role === 'sales_rep' ? 'bg-blue-900/50 text-blue-400 border-blue-800' : 'bg-ink-700 text-ink-300 border-ink-600'}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="td text-center">
                      <span className={`badge text-xs ${u.is_active ? 'bg-green-900/50 text-green-400 border-green-800' : 'bg-ink-700 text-ink-400 border-ink-600'}`}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="td text-center text-xs text-ink-400">{fmtDate(u.last_login)}</td>
                    <td className="td text-center text-xs text-ink-400">{fmtDate(u.created_at)}</td>
                    <td className="td">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setUserModal(u)} className="btn btn-ghost py-0.5 px-1.5 text-blue-400"><PencilIcon className="w-3.5 h-3.5" /></button>
                        <button onClick={() => toggleUser(u)} className={`btn btn-ghost py-0.5 px-1.5 text-xs ${u.is_active ? 'text-amber-400' : 'text-green-400'}`}>
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                        {u.id !== user?.id && <button onClick={() => deleteUser(u.id)} className="btn btn-ghost py-0.5 px-1.5 text-red-400"><TrashIcon className="w-3.5 h-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Aggregator Settings */}
      {tab === 'aggregator' && (
        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Data Sources</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {SOURCES.map(src => (
                <label key={src.id} className="flex items-center gap-3 p-3 bg-ink-800/50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    checked={aggSettings.enabled_sources?.includes(src.id)}
                    onChange={e => setAggSettings(s => ({
                      ...s,
                      enabled_sources: e.target.checked ? [...(s.enabled_sources || []), src.id] : (s.enabled_sources || []).filter(x => x !== src.id)
                    }))}
                  />
                  <span className="text-sm text-white font-medium">{src.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">NAICS Codes to Monitor</h3>
            <p className="text-xs text-ink-400">Solicitations matching these NAICS codes will be pulled. Common freight/logistics codes: 484110, 484121, 484122, 484220, 488510, 488991</p>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="e.g. 484110" value={newNaics} onChange={e => setNewNaics(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNaics()} maxLength={10} />
              <button onClick={addNaics} className="btn btn-outline flex items-center gap-1"><PlusIcon className="w-4 h-4" />Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(aggSettings.naics_codes || []).map(code => (
                <span key={code} className="flex items-center gap-1.5 bg-ink-700 border border-ink-600 text-ink-200 text-xs px-2.5 py-1 rounded-full">
                  {code}
                  <button onClick={() => removeNaics(code)} className="text-ink-400 hover:text-red-400"><XMarkIcon className="w-3 h-3" /></button>
                </span>
              ))}
              {(!aggSettings.naics_codes || aggSettings.naics_codes.length === 0) && <span className="text-ink-500 text-sm">No NAICS codes configured</span>}
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Value Filter (Optional)</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="field">
                <label className="label">Min Contract Value ($)</label>
                <input type="number" className="input" value={aggSettings.min_value || ''} onChange={e => setAggSettings(s => ({ ...s, min_value: e.target.value ? Number(e.target.value) : undefined }))} placeholder="e.g. 50000" />
              </div>
              <div className="field">
                <label className="label">Max Contract Value ($)</label>
                <input type="number" className="input" value={aggSettings.max_value || ''} onChange={e => setAggSettings(s => ({ ...s, max_value: e.target.value ? Number(e.target.value) : undefined }))} placeholder="Leave blank for unlimited" />
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Keyword Filter (Optional)</h3>
            <div className="field">
              <label className="label">Keywords (comma separated)</label>
              <input className="input" value={aggSettings.keywords || ''} onChange={e => setAggSettings(s => ({ ...s, keywords: e.target.value }))} placeholder="freight, logistics, transportation, trucking" />
            </div>
          </div>

          <button onClick={saveAggSettings} className="btn btn-gold px-8">Save Aggregator Settings</button>
        </div>
      )}

      {/* Sync History */}
      {tab === 'sync' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <button onClick={triggerFmcsaSync} disabled={syncing} className="btn btn-outline flex items-center gap-2">
              <ArrowPathIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync FMCSA Data
            </button>
            <button onClick={triggerAggSync} disabled={syncing} className="btn btn-outline flex items-center gap-2">
              <ArrowPathIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync Solicitations
            </button>
          </div>
          <p className="text-xs text-ink-400">FMCSA syncs nightly at 2AM EST. Solicitations sync at 6AM and 6PM EST.</p>

          {syncLogs.length === 0 ? (
            <div className="card p-12 text-center text-ink-400 text-sm">No sync history yet.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink-800 border-b border-ink-700">
                  <tr>
                    <th className="th text-left">Started</th>
                    <th className="th">Type</th>
                    <th className="th">Status</th>
                    <th className="th">Fetched</th>
                    <th className="th">Upserted</th>
                    <th className="th">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.slice(0, 50).map(log => (
                    <tr key={log.id} className="tr-hover">
                      <td className="td text-xs text-ink-300">{fmtDate(log.started_at)}</td>
                      <td className="td text-center text-xs">{log.sync_type || 'fmcsa'}</td>
                      <td className="td text-center">
                        <span className={`badge text-xs ${log.status === 'completed' ? 'bg-green-900/50 text-green-400 border-green-800' : log.status === 'failed' ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-amber-900/30 text-amber-400 border-amber-800'}`}>{log.status}</span>
                      </td>
                      <td className="td text-center text-ink-300">{log.records_fetched?.toLocaleString() || '—'}</td>
                      <td className="td text-center text-ink-300">{log.records_upserted?.toLocaleString() || '—'}</td>
                      <td className="td text-center text-xs text-ink-400">{fmtDate(log.completed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* User Modal */}
      {userModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">{userModal.id ? 'Edit User' : 'Create User'}</h2>
            <div className="field">
              <label className="label">Full Name</label>
              <input className="input" value={userModal.full_name || ''} onChange={e => setUserModal(m => ({ ...m!, full_name: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label">Email *</label>
              <input type="email" className="input" value={userModal.email || ''} onChange={e => setUserModal(m => ({ ...m!, email: e.target.value }))} disabled={!!userModal.id} />
            </div>
            {!userModal.id && (
              <div className="field">
                <label className="label">Password *</label>
                <input type="password" className="input" value={(userModal as any).password || ''} onChange={e => setUserModal(m => ({ ...m!, password: e.target.value } as any))} placeholder="Min 8 characters" />
              </div>
            )}
            <div className="field">
              <label className="label">Role *</label>
              <select className="select" value={userModal.role || 'sales_rep'} onChange={e => setUserModal(m => ({ ...m!, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r === 'sales_rep' ? 'Sales Rep' : r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
              <p className="text-xs text-ink-500 mt-1">Admin: full access · Sales Rep: no delete/export · Viewer: read-only</p>
            </div>
            <div className="flex gap-3">
              <button onClick={saveUser} disabled={userSaving} className="btn btn-gold flex-1">Save</button>
              <button onClick={() => setUserModal(null)} className="btn btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
