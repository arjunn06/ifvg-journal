
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewTrade from "./pages/NewTrade";
import Trades from "./pages/Trades";
import TradeDetail from "./pages/TradeDetail";
import TradingAccounts from "./pages/TradingAccounts";
import AccountPerformance from "./pages/AccountPerformance";
import Strategies from "./pages/Strategies";
import StrategyAnalytics from "./pages/StrategyAnalytics";
import Notes from "./pages/Notes";
import Calendar from "./pages/Calendar";
import Confluence from "./pages/Confluence";
import Transactions from "./pages/Transactions";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import Upgrade from "./pages/Upgrade";
import Terms from "./pages/Terms";
import Refund from "./pages/Refund";

import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import WeeklyReport from "./pages/WeeklyReport";
import MonthlyReport from "./pages/MonthlyReport";
import Comparison from "./pages/Comparison";
import NotFound from "./pages/NotFound";
import { AdminLogin } from "./pages/admin/AdminLogin";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { InvitePage } from "./pages/InvitePage";
import { AdminRoute } from "./components/AdminRoute";
import { AnalyticsTracker } from "@/components/analytics/AnalyticsTracker";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="trade-zero-theme">
      <TooltipProvider>
        <AuthProvider>
          <SubscriptionProvider>
        <Toaster />
        <Sonner />
        <AnalyticsTracker />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/trades" element={<ProtectedRoute><Trades /></ProtectedRoute>} />
            <Route path="/trades/:id" element={<ProtectedRoute><TradeDetail /></ProtectedRoute>} />
            <Route path="/trades/new" element={<ProtectedRoute><NewTrade /></ProtectedRoute>} />
            <Route path="/trades/edit/:id" element={<ProtectedRoute><NewTrade /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
            <Route path="/accounts" element={<ProtectedRoute><TradingAccounts /></ProtectedRoute>} />
            <Route path="/account-performance/:id" element={<ProtectedRoute><AccountPerformance /></ProtectedRoute>} />
            <Route path="/strategies" element={<ProtectedRoute><Strategies /></ProtectedRoute>} />
            <Route path="/strategies/:id/analytics" element={<ProtectedRoute><StrategyAnalytics /></ProtectedRoute>} />
            <Route path="/upgrade" element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
            <Route path="/confluence" element={<ProtectedRoute><Confluence /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><WeeklyReport /></ProtectedRoute>} />
            <Route path="/weekly-report" element={<ProtectedRoute><WeeklyReport /></ProtectedRoute>} />
            <Route path="/monthly-report" element={<ProtectedRoute><MonthlyReport /></ProtectedRoute>} />
            <Route path="/comparison" element={<ProtectedRoute><Comparison /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
            <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/payment-cancel" element={<PaymentCancel />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/refund" element={<Refund />} />
            <Route path="/invite/:token" element={<InvitePage />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
          </SubscriptionProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
