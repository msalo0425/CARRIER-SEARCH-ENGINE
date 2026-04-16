import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';

const Dashboard = lazy(() => import('./pages/DashboardPage'));
const CarriersSearch = lazy(() => import('./pages/carriers/SearchPage'));
const CarrierProfile = lazy(() => import('./pages/carriers/CarrierProfilePage'));
const Pipeline = lazy(() => import('./pages/PipelinePage'));
const CRM = lazy(() => import('./pages/CrmPage'));
const Opportunities = lazy(() => import('./pages/govcon/OpportunitiesPage'));
const SourcesSought = lazy(() => import('./pages/govcon/SourcesSoughtPage'));
const Proposals = lazy(() => import('./pages/govcon/ProposalsPage'));
const ProposalDetail = lazy(() => import('./pages/govcon/ProposalDetailPage'));
const Agencies = lazy(() => import('./pages/govcon/AgenciesPage'));
const Certifications = lazy(() => import('./pages/govcon/CertificationsPage'));
const Documents = lazy(() => import('./pages/govcon/DocumentsPage'));
const Calendar = lazy(() => import('./pages/govcon/CalendarPage'));
const Aggregator = lazy(() => import('./pages/govcon/AggregatorPage'));
const Settings = lazy(() => import('./pages/SettingsPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          {children}
        </Suspense>
      </Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1c1c1c', color: '#fff', border: '1px solid #3a3a3a' },
        success: { iconTheme: { primary: '#D4AF37', secondary: '#0d0d0d' } },
      }} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/carriers" element={<AppLayout><CarriersSearch /></AppLayout>} />
        <Route path="/carriers/:dotNumber" element={<AppLayout><CarrierProfile /></AppLayout>} />
        <Route path="/pipeline" element={<AppLayout><Pipeline /></AppLayout>} />
        <Route path="/crm" element={<AppLayout><CRM /></AppLayout>} />
        <Route path="/opportunities" element={<AppLayout><Opportunities /></AppLayout>} />
        <Route path="/sources-sought" element={<AppLayout><SourcesSought /></AppLayout>} />
        <Route path="/proposals" element={<AppLayout><Proposals /></AppLayout>} />
        <Route path="/proposals/:id" element={<AppLayout><ProposalDetail /></AppLayout>} />
        <Route path="/agencies" element={<AppLayout><Agencies /></AppLayout>} />
        <Route path="/certifications" element={<AppLayout><Certifications /></AppLayout>} />
        <Route path="/documents" element={<AppLayout><Documents /></AppLayout>} />
        <Route path="/calendar" element={<AppLayout><Calendar /></AppLayout>} />
        <Route path="/aggregator" element={<AppLayout><Aggregator /></AppLayout>} />
        <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
