import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import toast from 'react-hot-toast';
import {
  HomeIcon, TruckIcon, PhoneIcon,
  DocumentTextIcon, BuildingOfficeIcon, ShieldCheckIcon,
  CalendarIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon,
  Bars3Icon, XMarkIcon, ChevronDownIcon, GlobeAltIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

interface Props { children: React.ReactNode; }

const govconLinks = [
  { to: '/opportunities', label: 'Opportunities' },
  { to: '/sources-sought', label: 'Sources Sought' },
  { to: '/proposals', label: 'Proposals' },
  { to: '/aggregator', label: 'Solicitation Aggregator' },
  { to: '/agencies', label: 'Agency Relationships' },
  { to: '/certifications', label: 'Certifications' },
  { to: '/documents', label: 'Document Library' },
  { to: '/calendar', label: 'Calendar' },
];

export default function Layout({ children }: Props) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [govExpanded, setGovExpanded] = useState(true);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    clearAuth();
    navigate('/login');
    toast.success('Signed out');
  };

  const Sidebar = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E55A20] flex-shrink-0">
        <img src="/logo.png" className="w-14 h-14 flex-shrink-0 rounded-full" alt="BCL" />
        <div>
          <div className="text-sm font-bold text-white leading-tight">Black Clover</div>
          <div className="text-xs text-white/90 leading-tight font-medium">Logistics</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-hide">
        <NavLink to="/" end className={({isActive})=>`nav-item ${isActive?'active':''}`} onClick={()=>setSidebarOpen(false)}>
          <HomeIcon className="w-4 h-4 flex-shrink-0" /><span>Dashboard</span>
        </NavLink>

        <div className="pt-2 pb-1 px-3">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Carriers</span>
        </div>
        <NavLink to="/carriers" className={({isActive})=>`nav-item ${isActive?'active':''}`} onClick={()=>setSidebarOpen(false)}>
          <MagnifyingGlassIcon className="w-4 h-4 flex-shrink-0" /><span>Carrier Search</span>
        </NavLink>
        <NavLink to="/pipeline" className={({isActive})=>`nav-item ${isActive?'active':''}`} onClick={()=>setSidebarOpen(false)}>
          <TruckIcon className="w-4 h-4 flex-shrink-0" /><span>Pipeline</span>
        </NavLink>
        <NavLink to="/crm" className={({isActive})=>`nav-item ${isActive?'active':''}`} onClick={()=>setSidebarOpen(false)}>
          <PhoneIcon className="w-4 h-4 flex-shrink-0" /><span>Cold Call CRM</span>
        </NavLink>

        <div className="pt-2 pb-1 px-3">
          <button
            className="flex items-center justify-between w-full text-[10px] font-bold text-white/50 uppercase tracking-widest hover:text-gold-400 transition-colors"
            onClick={() => setGovExpanded(!govExpanded)}
          >
            <span>Gov Contracting</span>
            <ChevronDownIcon className={`w-3 h-3 transition-transform ${govExpanded?'rotate-180':''}`} />
          </button>
        </div>
        {govExpanded && govconLinks.map(({to, label}) => (
          <NavLink key={to} to={to} className={({isActive})=>`nav-item ${isActive?'active':''}`} onClick={()=>setSidebarOpen(false)}>
            <GlobeAltIcon className="w-4 h-4 flex-shrink-0" /><span className="text-xs">{label}</span>
          </NavLink>
        ))}

        {user?.role === 'admin' && (
          <>
            <div className="pt-2 pb-1 px-3">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Admin</span>
            </div>
            <NavLink to="/settings" className={({isActive})=>`nav-item ${isActive?'active':''}`} onClick={()=>setSidebarOpen(false)}>
              <Cog6ToothIcon className="w-4 h-4 flex-shrink-0" /><span>Settings</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-2 py-3 border-t border-[#E55A20] flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 mb-1 rounded-lg bg-[#E55A20]/50">
          <div className="w-7 h-7 rounded-full bg-[#E55A20] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">{user?.full_name || user?.email}</div>
            <div className="text-[10px] text-white/60 capitalize">{user?.role?.replace('_',' ')}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="nav-item w-full text-red-300 hover:text-red-200 hover:bg-red-900/20">
          <ArrowRightOnRectangleIcon className="w-4 h-4 flex-shrink-0" /><span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-ink-950 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 xl:w-60 bg-[#F96B2F] border-r border-[#E55A20] flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/80" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-[#F96B2F] border-r border-[#E55A20] shadow-2xl">
            <div className="absolute top-3 right-3 z-10">
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg bg-[#E55A20] text-white/80 hover:text-white">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#F96B2F] border-b border-[#E55A20] flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-[#E55A20]">
            <Bars3Icon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.png" className="w-8 h-8 rounded-full" alt="BCL" />
            <span className="text-white font-bold text-sm">Black Clover</span>
          </div>
          <div className="w-9" />
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
