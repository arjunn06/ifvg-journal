
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import { userPreferences } from '@/utils/secureStorage';
import { CurrencyFormatter, DateFormatter, TradeCalculations } from '@/utils/commonUtils';
import { TrendingUp, TrendingDown, DollarSign, Target, Calendar, Plus, Activity, BarChart3, Star, PieChart, Clock, Shield, Trophy, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart as RechartsPieChart, Cell, BarChart, Bar } from 'recharts';
import { MetricCard } from '@/components/MetricCard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { SmartSuggestions } from '@/components/SmartSuggestions';
import { QuickTradeWidget } from '@/components/QuickTradeWidget';
import { AccountFilter } from '@/components/AccountFilter';
import { PropFirmDashboard } from '@/components/PropFirmDashboard';
import PerformanceScore from '@/components/PerformanceScore';
import { MetricHistoryDialog } from '@/components/MetricHistoryDialog';
import { ComparisonDialog } from '@/components/ComparisonDialog';
import { useAccountEquities } from '@/hooks/useAccountEquities';

interface AccountGoalsSectionProps {
  accounts: any[];
  user: any;
  formatCurrency: (amount: number, currency?: string) => string;
}

const AccountGoalsSection = ({ accounts, user, formatCurrency }: AccountGoalsSectionProps) => {
  const [accountEquities, setAccountEquities] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchAccountEquities = async () => {
      if (!user || accounts.length === 0) return;

      try {
        const { data: allTradesData } = await supabase
          .from('trades')
          .select('pnl, trading_account_id')
          .eq('user_id', user.id);

        const equities: Record<string, number> = {};
        accounts.forEach(account => {
          const accountTrades = (allTradesData || []).filter(trade => trade.trading_account_id === account.id);
          const accountPnl = accountTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
          equities[account.id] = account.initial_balance + accountPnl;
        });
        setAccountEquities(equities);
      } catch (error) {
        logger.apiError('Dashboard - fetching account equities', error);
      }
    };

    fetchAccountEquities();
  }, [accounts, user]);

  const accountsWithGoals = accounts.filter(acc => {
    if (!acc.is_active) return false; // Only show active accounts
    if (!acc.equity_goal || acc.equity_goal <= 0) return false;
    const equity = accountEquities[acc.id] || acc.initial_balance;
    const profit = equity - acc.initial_balance;
    const profitGoal = acc.equity_goal - acc.initial_balance;
    const progress = profitGoal > 0 ? (profit / profitGoal) * 100 : 0;
    return progress < 100; // Only show goals not yet achieved
  });

  if (accountsWithGoals.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Target className="h-5 w-5 mr-2" />
          Profit Goals Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {accountsWithGoals.map((account) => {
          const equity = accountEquities[account.id] || account.initial_balance;
          const profit = equity - account.initial_balance;
          const profitGoal = account.equity_goal! - account.initial_balance;
          const progress = profitGoal > 0 ? (profit / profitGoal) * 100 : 0;
          const progressClamped = Math.min(Math.max(progress, 0), 100);
          const isGoalAchieved = progress >= 100;
          
          return (
            <div key={account.id} className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(profit, account.currency)} / {formatCurrency(profitGoal, account.currency)} profit
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${isGoalAchieved ? 'text-green-600' : ''}`}>
                    {progressClamped.toFixed(1)}%
                  </p>
                  {isGoalAchieved && (
                    <Badge variant="default" className="text-xs">
                      Goal Achieved! 🎉
                    </Badge>
                  )}
                </div>
              </div>
              <Progress 
                value={progressClamped} 
                className="h-2"
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

// Account Balances List Component
interface AccountBalancesListProps {
  accounts: any[];
  accountEquities: Record<string, number>;
  formatCurrency: (amount: number, currency?: string) => string;
}

const AccountBalancesList = ({ accounts, accountEquities, formatCurrency }: AccountBalancesListProps) => {
  const activeAccounts = accounts.filter(acc => acc.is_active);
  
  if (activeAccounts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <DollarSign className="h-5 w-5 mr-2" />
          Account Balances
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeAccounts.map((account) => {
          const currentEquity = accountEquities[account.id] || account.initial_balance;
          const change = currentEquity - account.initial_balance;
          const percentage = account.initial_balance > 0 ? (change / account.initial_balance) * 100 : 0;
          const isPositive = change >= 0;
          
          return (
            <div key={account.id} className="flex justify-between items-center py-2 border-b border-border/50 last:border-b-0">
              <div>
                <p className="font-medium">{account.name}</p>
                <p className="text-sm text-muted-foreground">{account.broker || 'Trading Account'}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(currentEquity, account.currency)}</p>
                <p className={`text-sm font-medium ${isPositive ? 'text-profit' : 'text-loss'}`}>
                  {isPositive ? '+' : ''}{formatCurrency(change, account.currency)} ({percentage.toFixed(1)}%)
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

interface TradingAccount {
  id: string;
  name: string;
  account_type: string;
  initial_balance: number;
  current_balance: number;
  current_equity: number;
  currency: string;
  equity_goal?: number;
  is_prop_firm?: boolean;
  is_active: boolean;
}

interface DashboardStats {
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  activeTrades: number;
  bestTrade: number;
  worstTrade: number;
  avgWin: number;
  avgLoss: number;
  currentBalance: number;
  initialBalance: number;
  mostTradedAsset: string;
  profitFactor: number;
  expectancy: number;
  sharpeRatio: number;
  maxDrawdown: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalPnl: 0,
    winRate: 0,
    totalTrades: 0,
    activeTrades: 0,
    bestTrade: 0,
    worstTrade: 0,
    avgWin: 0,
    avgLoss: 0,
    currentBalance: 0,
    initialBalance: 0,
    mostTradedAsset: '',
    profitFactor: 0,
    expectancy: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0
  });
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [equityData, setEquityData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(['all-active']);
  const [primaryAccountId, setPrimaryAccountId] = useState<string | null>(null);
  const [allTrades, setAllTrades] = useState<any[]>([]);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [assetPerformance, setAssetPerformance] = useState<any[]>([]);
  const [monthlyPerformance, setMonthlyPerformance] = useState<any[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<any>({});
  const [metricDialogOpen, setMetricDialogOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'winRate' | 'profitFactor' | 'maxDrawdown' | 'avgReturn' | 'expectancy' | null>(null);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);

  // Use the custom hook for consistent account equity calculations
  const { accountEquities, loading: equitiesLoading } = useAccountEquities(user, accounts);

  useEffect(() => {
    console.log('Dashboard useEffect triggered:', { user: !!user, selectedAccountIds, sortOrder, timeFilter });
    if (user) {
      fetchDashboardData();
    }
  }, [user, selectedAccountIds, sortOrder, timeFilter]); // Add timeFilter dependency

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Fetch trades, trading accounts, and transactions simultaneously
      const [tradesResult, accountsResult, transactionsResult] = await Promise.all([
        supabase
          .from('trades')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('trading_accounts')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('financial_transactions')
          .select('trading_account_id, amount, transaction_type')
          .eq('user_id', user.id)
      ]);

      if (tradesResult.error) throw tradesResult.error;
      if (accountsResult.error) throw accountsResult.error;
      if (transactionsResult.error) throw transactionsResult.error;

      const allTrades = tradesResult.data || [];
      const allAccounts = accountsResult.data || [];
      const allTransactions = transactionsResult.data || [];
      
      setAccounts(allAccounts);

      // Set primary account on first login if not already set
      if (allAccounts.length > 0 && selectedAccountIds.includes('all-active') && !primaryAccountId) {
        const savedPrimaryId = await userPreferences.getPrimaryAccount();
        if (savedPrimaryId && allAccounts.find(acc => acc.id === savedPrimaryId)) {
          setPrimaryAccountId(savedPrimaryId);
          setSelectedAccountIds([savedPrimaryId]);
        }
      }

      // Filter trades by selected accounts
      console.log('Filter Debug - Account filtering:', { 
        selectedAccountIds, 
        allTradesCount: allTrades.length,
        allAccountsCount: allAccounts.length
      });
      
      let filteredTrades;
      if (selectedAccountIds.includes('all-active') || selectedAccountIds.length === 0) {
        // Include trades from active accounts only when "All Active Accounts" is selected
        const activeAccountIds = allAccounts.filter(acc => acc.is_active).map(acc => acc.id);
        console.log('Filter Debug - Active account IDs:', activeAccountIds);
        filteredTrades = allTrades.filter(trade => activeAccountIds.includes(trade.trading_account_id));
      } else {
        filteredTrades = allTrades.filter(trade => selectedAccountIds.includes(trade.trading_account_id));
      }
      
      console.log('Filter Debug - After account filter:', { tradesCount: filteredTrades.length });

      // Apply time filter to the filtered trades
      console.log('Filter Debug - Before time filter:', { 
        timeFilter, 
        tradesCount: filteredTrades.length, 
        firstTradeDate: filteredTrades[0]?.entry_date 
      });
      
      if (timeFilter !== 'all') {
        const now = new Date();
        const filterDate = new Date();
        
        switch (timeFilter) {
          case '7d':
            filterDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            filterDate.setDate(now.getDate() - 30);
            break;
          case '90d':
            filterDate.setDate(now.getDate() - 90);
            break;
          case '6m':
            filterDate.setMonth(now.getMonth() - 6);
            break;
          case '1y':
            filterDate.setFullYear(now.getFullYear() - 1);
            break;
        }
        
        console.log('Filter Debug - Date range:', { filterDate, now });
        
        filteredTrades = filteredTrades.filter(trade => 
          new Date(trade.entry_date) >= filterDate
        );
        
        console.log('Filter Debug - After time filter:', { tradesCount: filteredTrades.length });
      }

      const trades = filteredTrades;

      // Filter accounts by selected accounts for balance calculations
      const accounts = selectedAccountIds.includes('all-active')
        ? allAccounts.filter(acc => acc.is_active) // Only active accounts when "all active" is selected
        : allAccounts.filter(account => selectedAccountIds.includes(account.id));

      // Calculate account totals from trades
      const totalInitialBalance = accounts.reduce((sum, account) => sum + (account.initial_balance || 0), 0);
      
      // Calculate total current equity from the hook's accountEquities
      const totalCurrentEquity = accounts.reduce((sum, account) => {
        return sum + (accountEquities[account.id] || account.initial_balance);
      }, 0);

      // Calculate statistics
      const closedTrades = trades.filter(t => t.status === 'closed');
      const activeTrades = trades.filter(t => t.status === 'open');
      const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
      const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);

      const totalPnl = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
      const bestTrade = closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.pnl || 0)) : 0;
      const worstTrade = closedTrades.length > 0 ? Math.min(...closedTrades.map(t => t.pnl || 0)) : 0;
      const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length : 0;
      const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length : 0;

      // Calculate most traded asset
      const symbolCounts = trades.reduce((acc, trade) => {
        acc[trade.symbol] = (acc[trade.symbol] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const mostTradedAsset = Object.keys(symbolCounts).length > 0 
        ? Object.entries(symbolCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0] 
        : '';

      // Calculate advanced metrics
      const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
      const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;
      const expectancy = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;

      // Calculate consecutive wins/losses
      let maxConsecutiveWins = 0;
      let maxConsecutiveLosses = 0;
      let currentWinStreak = 0;
      let currentLossStreak = 0;

      closedTrades.forEach(trade => {
        if ((trade.pnl || 0) > 0) {
          currentWinStreak++;
          currentLossStreak = 0;
          maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak);
        } else {
          currentLossStreak++;
          currentWinStreak = 0;
          maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak);
        }
      });

      // Calculate max drawdown
      let peak = totalInitialBalance;
      let maxDrawdown = 0;
      let drawdownBalance = totalInitialBalance;
      
      closedTrades.forEach(trade => {
        drawdownBalance += (trade.pnl || 0);
        if (drawdownBalance > peak) {
          peak = drawdownBalance;
        }
        const currentDrawdown = (peak - drawdownBalance) / peak * 100;
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
      });

      // Calculate asset performance
      const assetStats = Object.keys(symbolCounts).map(symbol => {
        const symbolTrades = closedTrades.filter(t => t.symbol === symbol);
        const symbolPnl = symbolTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const symbolWins = symbolTrades.filter(t => (t.pnl || 0) > 0).length;
        const symbolWinRate = symbolTrades.length > 0 ? (symbolWins / symbolTrades.length) * 100 : 0;
        
        return {
          symbol,
          trades: symbolTrades.length,
          pnl: symbolPnl,
          winRate: symbolWinRate,
          avgPnl: symbolTrades.length > 0 ? symbolPnl / symbolTrades.length : 0
        };
      }).sort((a, b) => b.pnl - a.pnl).slice(0, 8);

      // Calculate monthly performance
      const monthlyStats: Record<string, { pnl: number; trades: number }> = {};
      closedTrades.forEach(trade => {
        const month = new Date(trade.exit_date || trade.entry_date).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short' 
        });
        if (!monthlyStats[month]) {
          monthlyStats[month] = { pnl: 0, trades: 0 };
        }
        monthlyStats[month].pnl += trade.pnl || 0;
        monthlyStats[month].trades += 1;
      });

      const monthlyData = Object.entries(monthlyStats)
        .map(([month, data]) => ({ month, ...data }))
        .slice(-12); // Last 12 months

      setStats({
        totalPnl,
        winRate,
        totalTrades: trades.length,
        activeTrades: activeTrades.length,
        bestTrade,
        worstTrade,
        avgWin,
        avgLoss,
        currentBalance: totalCurrentEquity,
        initialBalance: totalInitialBalance,
        mostTradedAsset,
        profitFactor,
        expectancy,
        sharpeRatio: 0, // Would need more complex calculation
        maxDrawdown,
        consecutiveWins: maxConsecutiveWins,
        consecutiveLosses: maxConsecutiveLosses
      });

      setAssetPerformance(assetStats);
      setMonthlyPerformance(monthlyData);

      // Sort trades based on current sort order
      const sortedTrades = [...trades].sort((a, b) => {
        const dateA = new Date(a.entry_date).getTime();
        const dateB = new Date(b.entry_date).getTime();
        return sortOrder === 'latest' ? dateB - dateA : dateA - dateB;
      });

      setRecentTrades(sortedTrades.slice(0, 5));
      setAllTrades(trades);

      // Generate equity curve data showing progression to current balance
      const equitySortedTrades = closedTrades.sort((a, b) => new Date(a.exit_date || a.entry_date).getTime() - new Date(b.exit_date || b.entry_date).getTime());
      let equityBalance = totalInitialBalance || 0;
      const equityCurve = [{ date: 'Start', balance: equityBalance }];
      
      equitySortedTrades.forEach((trade) => {
        equityBalance += (trade.pnl || 0);
        equityCurve.push({
          date: new Date(trade.exit_date || trade.entry_date).toLocaleDateString(),
          balance: equityBalance
        });
      });

      // Add current balance as the final point if different from calculated
      if (equitySortedTrades.length > 0 && Math.abs(equityBalance - totalCurrentEquity) > 0.01) {
        equityCurve.push({
          date: 'Current',
          balance: totalCurrentEquity
        });
      } else if (sortedTrades.length === 0) {
        // If no trades, just show progression from initial to current
        equityCurve.push({
          date: 'Current',
          balance: totalCurrentEquity
        });
      }
      
      setEquityData(equityCurve);
    } catch (error) {
      logger.apiError('Dashboard - fetching dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePrimaryAccount = async (accountId: string) => {
    const newPrimaryId = primaryAccountId === accountId ? null : accountId;
    setPrimaryAccountId(newPrimaryId);
    if (newPrimaryId) {
      await userPreferences.setPrimaryAccount(newPrimaryId);
      setSelectedAccountIds([newPrimaryId]);
    } else {
      // Clear primary account preference - this could be improved with a dedicated method
      await userPreferences.setPrimaryAccount('');
    }
  };

  // Use optimized currency formatter from utilities
  const formatCurrency = (amount: number, currency: string = 'USD') => 
    CurrencyFormatter.format(amount, currency);

  const formatPercentage = (value: number) => 
    CurrencyFormatter.formatPercentage(value);

  const handleMetricClick = (metricType: 'winRate' | 'profitFactor' | 'maxDrawdown' | 'avgReturn' | 'expectancy') => {
    setSelectedMetric(metricType);
    setMetricDialogOpen(true);
  };

  const handleViewComparison = (comparisonData: any) => {
    navigate('/comparison', { state: { comparisonData } });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <div className="h-8 bg-muted rounded w-64 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-80 animate-pulse"></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
              <div className="h-10 bg-muted rounded w-40 animate-pulse"></div>
              <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
            </div>
          </div>
          
          {/* Analytics Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg animate-pulse"></div>
            ))}
          </div>
          
          {/* Charts Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-muted rounded-lg animate-pulse"></div>
            <div className="h-96 bg-muted rounded-lg animate-pulse"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Account Filter */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-in">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Trading Dashboard
            </h1>
            <p className="text-muted-foreground">Monitor your trading performance and analytics</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Time Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Period:</span>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent className="dropdown-content">
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 3 Months</SelectItem>
                  <SelectItem value="6m">Last 6 Months</SelectItem>
                  <SelectItem value="1y">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Account Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Account:</span>
              <AccountFilter
                values={selectedAccountIds}
                onValuesChange={setSelectedAccountIds}
                className="min-w-[180px]"
                multiSelect={true}
                placeholder="All Active Accounts"
              />
            </div>
            <Button onClick={() => setComparisonDialogOpen(true)} variant="outline" className="hover-scale">
              <BarChart3 className="h-4 w-4 mr-2" />
              Compare
            </Button>
            <Button onClick={() => navigate('/trades/new')} className="hover-scale">
              <Plus className="h-4 w-4 mr-2" />
              New Trade
            </Button>
          </div>
        </div>

        {/* ANALYTICS SECTION - TOP PRIORITY */}
        <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {/* Primary KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="Total P&L"
              value={formatCurrency(stats.totalPnl)}
              change={{
                value: stats.totalPnl,
                percentage: stats.initialBalance > 0 ? `${((stats.totalPnl / stats.initialBalance) * 100).toFixed(1)}%` : "0.0%",
                isPositive: stats.totalPnl >= 0
              }}
              icon={<TrendingUp className="h-5 w-5" />}
              className="stagger-fade"
            />
            <MetricCard
              title="Win Rate"
              value={`${stats.winRate.toFixed(1)}%`}
              change={{
                value: stats.winRate,
                percentage: `${stats.totalTrades} trades`,
                isPositive: stats.winRate >= 50
              }}
              icon={<Target className="h-5 w-5" />}
              className="stagger-fade cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleMetricClick('winRate')}
            />
            <MetricCard
              title="Total Trades"
              value={stats.totalTrades.toString()}
              change={{
                value: stats.totalTrades,
                percentage: `${stats.activeTrades} active`,
                isPositive: true
              }}
              icon={<Activity className="h-5 w-5" />}
              className="stagger-fade"
            />
          </div>
          
          {/* Account Balances List - Pass calculated accountEquities */}
          <AccountBalancesList 
            accounts={accounts} 
            accountEquities={accountEquities} 
            formatCurrency={formatCurrency} 
          />

          {/* Advanced Analytics Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Profit Factor"
              value={stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '0.00'}
              change={{
                value: stats.profitFactor,
                percentage: stats.profitFactor >= 1.5 ? "Excellent" : stats.profitFactor >= 1 ? "Good" : "Needs Work",
                isPositive: stats.profitFactor >= 1
              }}
              icon={<BarChart3 className="h-5 w-5" />}
              className="stagger-fade cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleMetricClick('profitFactor')}
            />
            <MetricCard
              title="Max Drawdown"
              value={formatCurrency(Math.abs(stats.maxDrawdown))}
              change={{
                value: stats.maxDrawdown,
                percentage: stats.initialBalance > 0 ? `${((Math.abs(stats.maxDrawdown) / stats.initialBalance) * 100).toFixed(1)}%` : "0.0%",
                isPositive: stats.maxDrawdown <= -100 // Consider small drawdowns as positive
              }}
              icon={<TrendingDown className="h-5 w-5" />}
              className="stagger-fade cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleMetricClick('maxDrawdown')}
            />
            <MetricCard
              title="Best Trade"
              value={formatCurrency(stats.bestTrade)}
              change={{
                value: stats.bestTrade,
                percentage: "Single trade",
                isPositive: stats.bestTrade > 0
              }}
              icon={<Trophy className="h-5 w-5" />}
              className="stagger-fade"
            />
            <MetricCard
              title="Expectancy"
              value={formatCurrency(stats.expectancy)}
              change={{
                value: stats.expectancy,
                percentage: "Per trade",
                isPositive: stats.expectancy > 0
              }}
              icon={<Calculator className="h-5 w-5" />}
              className="stagger-fade cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleMetricClick('expectancy')}
            />
          </div>
        </div>

        {/* WIDGETS SECTION - LOWER PRIORITY */}
        <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {/* Prop Firm Challenges Progress */}
          <PropFirmDashboard accounts={accounts} user={user} formatCurrency={formatCurrency} />
          
          {/* Account Goals Progress */}
          <AccountGoalsSection accounts={accounts} user={user} formatCurrency={formatCurrency} />
          
          {/* Performance Score Triangle */}
          <PerformanceScore
            winRate={stats.winRate}
            profitFactor={stats.profitFactor}
            riskRewardRatio={stats.avgLoss !== 0 ? Math.abs(stats.avgWin / stats.avgLoss) : 0}
            className="lg:col-span-1"
          />
          
          {/* Charts and Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Equity Curve */}
          <Card className="metric-card">
            <CardHeader className="pb-2 sm:pb-4 p-3 sm:p-6">
              <CardTitle className="text-lg font-semibold">Equity Metrics</CardTitle>
              <CardDescription>Account balance progression over time</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {equityData.length > 1 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={equityData}>
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Balance']}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="balance" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fill="url(#equityGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No data available yet</p>
                  <p className="text-sm">Complete some trades to see your equity curve</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Trades */}
          <Card className="metric-card">
            <CardHeader className="pb-2 sm:pb-4 p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">Recent Trades</CardTitle>
                  <CardDescription>Your latest trading activity</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => setSortOrder(sortOrder === 'latest' ? 'oldest' : 'latest')}
                >
                  {sortOrder === 'latest' ? 'Latest' : 'Oldest'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {recentTrades.length === 0 ? (
                <div className="text-center py-8">
                  <div className="bg-muted/50 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-3">No trades yet</p>
                  <Button 
                    onClick={() => navigate('/trades/new')} 
                    size="sm"
                    variant="outline"
                  >
                    Add Your First Trade
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTrades.map((trade) => (
                    <div 
                      key={trade.id} 
                      className="flex items-center justify-between p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors cursor-pointer"
                      onClick={() => navigate(`/trades/${trade.id}`)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${trade.trade_type === 'long' ? 'bg-profit' : 'bg-primary'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{trade.symbol}</p>
                            <Badge 
                              variant={trade.trade_type === 'long' ? 'default' : 'secondary'}
                              className="text-xs px-2 py-0"
                            >
                              {trade.trade_type.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(trade.entry_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={trade.status === 'open' ? 'outline' : 'secondary'}
                          className="text-xs"
                        >
                          {trade.status}
                        </Badge>
                        {trade.status === 'closed' && trade.pnl && (
                          <p className={`text-xs font-medium mt-1 ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {formatCurrency(trade.pnl)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Advanced Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk Metrics */}
          <Card className="metric-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-lg font-semibold">
                <Shield className="h-5 w-5 mr-2" />
                Risk & Performance Metrics
              </CardTitle>
              <CardDescription>Advanced trading performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground mb-1">Profit Factor</div>
                    <div className={`text-xl font-bold ${stats.profitFactor >= 1.5 ? 'text-profit' : stats.profitFactor >= 1 ? 'text-warning' : 'text-loss'}`}>
                      {stats.profitFactor.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground mb-1">Expectancy</div>
                    <div className={`text-xl font-bold ${stats.expectancy >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {formatCurrency(stats.expectancy)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground mb-1">Max Drawdown</div>
                    <div className="text-xl font-bold text-loss">
                      {stats.maxDrawdown.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground mb-1">Best Streak</div>
                    <div className="text-xl font-bold text-profit">
                      {stats.consecutiveWins} wins
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground mb-1">Worst Streak</div>
                    <div className="text-xl font-bold text-loss">
                      {stats.consecutiveLosses} losses
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground mb-1">Risk/Reward</div>
                    <div className="text-xl font-bold">
                      {stats.avgLoss !== 0 ? (Math.abs(stats.avgWin / stats.avgLoss)).toFixed(2) : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Asset Performance Breakdown */}
          <Card className="metric-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-lg font-semibold">
                <PieChart className="h-5 w-5 mr-2" />
                Top Assets Performance
              </CardTitle>
              <CardDescription>Your best and worst performing symbols</CardDescription>
            </CardHeader>
            <CardContent>
              {assetPerformance.length > 0 ? (
                <div className="space-y-3">
                  {assetPerformance.slice(0, 6).map((asset, index) => (
                    <div key={asset.symbol} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-profit' : index === 1 ? 'bg-primary' : 'bg-muted'}`} />
                        <div>
                          <p className="font-medium text-sm">{asset.symbol}</p>
                          <p className="text-xs text-muted-foreground">{asset.trades} trades</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold text-sm ${asset.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatCurrency(asset.pnl)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {asset.winRate.toFixed(0)}% WR
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No asset data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Performance Chart */}
        {monthlyPerformance.length > 0 && (
          <Card className="metric-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-lg font-semibold">
                <Calendar className="h-5 w-5 mr-2" />
                Monthly Performance Trend
              </CardTitle>
              <CardDescription>Track your trading consistency over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="month" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'pnl' ? formatCurrency(value) : value,
                      name === 'pnl' ? 'P&L' : 'Trades'
                    ]}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="pnl" 
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

          {/* Additional Widgets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <QuickTradeWidget />
            <SmartSuggestions trades={allTrades} />
          </div>
        </div>
      </div>

      {/* Metric History Dialog */}
      <MetricHistoryDialog
        open={metricDialogOpen}
        onOpenChange={setMetricDialogOpen}
        metricType={selectedMetric}
        selectedAccountIds={selectedAccountIds}
        timeFilter={timeFilter}
      />

      {/* Comparison Dialog */}
      <ComparisonDialog
        open={comparisonDialogOpen}
        onOpenChange={setComparisonDialogOpen}
        accounts={accounts}
        onViewComparison={handleViewComparison}
      />
    </DashboardLayout>
  );
};

export default Dashboard;
