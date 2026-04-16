import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Enter your email and password'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), password });
      setAuth(data.user, data.token);
      toast.success(`Welcome back, ${data.user.full_name || data.user.email}!`);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Login failed';
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gold-900/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gold-900/5 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-500 rounded-2xl text-3xl mb-4 gold-glow text-ink-950 font-black shadow-2xl">♣</div>
          <h1 className="text-xl font-bold text-white">Black Clover Logistics</h1>
          <p className="text-ink-400 text-sm mt-1">Business Operating System</p>
        </div>

        <div className="card p-8 shadow-2xl border-ink-600">
          <p className="text-white font-semibold mb-1">Sign in</p>
          <p className="text-ink-400 text-xs mb-6">Restricted access — authorized users only</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="field">
              <label className="label">Email Address</label>
              <input type="email" className="input" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required disabled={loading} />
            </div>
            <div className="field">
              <label className="label">Password</label>
              <div className="relative">
                <input type={show?'text':'password'} className="input pr-10" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required disabled={loading} />
                <button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-200" tabIndex={-1}>
                  {show ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-gold w-full py-2.5" disabled={loading}>
              {loading ? <><span className="w-4 h-4 border-2 border-ink-950 border-t-transparent rounded-full animate-spin" />Signing in...</> : 'Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-ink-500 text-xs mt-5">Contact your administrator to request access.</p>
      </div>
    </div>
  );
}
