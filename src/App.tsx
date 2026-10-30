import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { SubscriptionProvider } from '@/hooks/useSubscription';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AnalyticsTracker } from '@/components/analytics/AnalyticsTracker';
import { AdminRoute } from './components/AdminRoute';
import { JournalProvider, isDemoMode } from '@/journal/JournalProvider';
import { Shell } from '@/journal/ui/Shell';

const Landing = lazy(() => import('@/journal/pages/Landing'));
const Auth = lazy(() => import('@/journal/pages/AuthPage'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ResetPassword = lazy(() => import('@/journal/pages/ResetPassword'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Overview = lazy(() => import('@/journal/pages/Overview'));
const Journal = lazy(() => import('@/journal/pages/Journal'));
const TradeView = lazy(() => import('@/journal/pages/TradeView'));
const TradeForm = lazy(() => import('@/journal/pages/TradeForm'));
const CalendarPage = lazy(() => import('@/journal/pages/Calendar'));
const Reports = lazy(() => import('@/journal/pages/Reports'));
const Accounts = lazy(() => import('@/journal/pages/Accounts'));
const Playbook = lazy(() => import('@/journal/pages/Playbook'));
const Upgrade = lazy(() => import('./pages/Upgrade'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentCancel = lazy(() => import('./pages/PaymentCancel'));
const Terms = lazy(() => import('./pages/Terms'));
const Refund = lazy(() => import('./pages/Refund'));
const NotFound = lazy(() => import('./pages/NotFound'));
const InvitePage = lazy(() => import('./pages/InvitePage').then((m) => ({ default: m.InvitePage })));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin').then((m) => ({ default: m.AdminLogin })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

const Splash = () => <div className="j-app" style={{ display: 'grid', placeItems: 'center' }}><span className="j-meta">Loading…</span></div>;

/** Everything behind sign-in lives inside the shell. Sample-data mode skips the sign-in. */
function RequireAuth() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (!isDemoMode()) {
    if (loading) return <Splash />;
    if (!user) return <Navigate to="/auth" replace state={{ from: pathname }} />;
  }
  return <JournalProvider><Shell /></JournalProvider>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="ifvg-journal-theme">
      <TooltipProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <Toaster />
            <Sonner />
            <AnalyticsTracker />
            <BrowserRouter>
              <Suspense fallback={<Splash />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route element={<RequireAuth />}>
                    <Route path="/dashboard" element={<Overview />} />
                    <Route path="/trades" element={<Journal />} />
                    <Route path="/trades/new" element={<TradeForm />} />
                    <Route path="/trades/edit/:id" element={<TradeForm />} />
                    <Route path="/trades/:id" element={<TradeView />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/weekly-report" element={<Navigate to="/reports?tab=periods" replace />} />
                    <Route path="/monthly-report" element={<Navigate to="/reports?tab=periods" replace />} />
                    <Route path="/comparison" element={<Navigate to="/reports" replace />} />
                    <Route path="/playbook" element={<Playbook />} />
                    <Route path="/strategies" element={<Navigate to="/playbook?tab=strategies" replace />} />
                    <Route path="/strategies/:id/analytics" element={<Navigate to="/playbook?tab=strategies" replace />} />
                    <Route path="/confluence" element={<Navigate to="/playbook?tab=checklist" replace />} />
                    <Route path="/notes" element={<Navigate to="/playbook?tab=notes" replace />} />
                    <Route path="/accounts" element={<Accounts />} />
                    <Route path="/accounts/:id" element={<Accounts />} />
                    <Route path="/account-performance/:id" element={<Navigate to="/accounts" replace />} />
                    <Route path="/transactions" element={<Navigate to="/accounts?tab=funding" replace />} />
                    <Route path="/upgrade" element={<Upgrade />} />
                  </Route>
                  <Route path="/payment-success" element={<PaymentSuccess />} />
                  <Route path="/payment-cancel" element={<PaymentCancel />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/refund" element={<Refund />} />
                  <Route path="/invite/:token" element={<InvitePage />} />
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </SubscriptionProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
