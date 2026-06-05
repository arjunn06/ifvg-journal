import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/DashboardLayout';
import { MetricCard } from '@/components/MetricCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Cell } from 'recharts';
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, Activity, DollarSign, Target, Calendar, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, isWithinInterval } from 'date-fns';

interface ComparisonData {
  compareAcross: 'time' | 'accounts' | 'strategies';
  fromDate?: Date;
  toDate?: Date;
  fromAccount?: string;
  toAccount?: string;
  fromStrategy?: string;
  toStrategy?: string;
  granularity?: 'daily' | 'monthly' | 'yearly';
}

interface ComparisonMetrics {
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  bestTrade: number;
  worstTrade: number;
  // Advanced metrics
  sharpeRatio: number;
  recoveryFactor: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  expectancy: number;
  winningDays: number;
  losingDays: number;
  breakEvenDays: number;
  avgTimeInTrade: number;
  totalCommissions: number;
  returnOnMaxDrawdown: number;
  calmarRatio: number;
  riskAdjustedReturn: number;
}

const Comparison = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [primaryMetrics, setPrimaryMetrics] = useState<ComparisonMetrics | null>(null);
  const [secondaryMetrics, setSecondaryMetrics] = useState<ComparisonMetrics | null>(null);
  const [primaryData, setPrimaryData] = useState<any[]>([]);
  const [secondaryData, setSecondaryData] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const data = location.state?.comparisonData as ComparisonData;
    if (!data) {
      navigate('/dashboard');
      return;
    }
    setComparisonData(data);
    fetchComparisonData(data);
  }, [location.state, navigate]);

  const fetchComparisonData = async (data: ComparisonData) => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch all trades and accounts
      const [tradesResult, accountsResult] = await Promise.all([
        supabase
          .from('trades')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'closed')
          .order('exit_date', { ascending: true }),
        supabase
          .from('trading_accounts')
          .select('*')
          .eq('user_id', user.id)
      ]);

      const allTrades = tradesResult.data || [];
      const allAccounts = accountsResult.data || [];

      if (data.compareAcross === 'time' && data.fromDate && data.toDate) {
        await handleTimeComparison(allTrades, data.fromDate, data.toDate, data.granularity || 'monthly');
      } else if (data.compareAcross === 'accounts' && data.fromAccount && data.toAccount) {
        await handleAccountComparison(allTrades, allAccounts, data.fromAccount, data.toAccount);
      }

    } catch (error) {
      console.error('Error fetching comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeComparison = async (allTrades: any[], fromDate: Date, toDate: Date, granularity: 'daily' | 'monthly' | 'yearly') => {
    // Filter trades within the date range
    const tradesInRange = allTrades.filter(trade => {
      const tradeDate = new Date(trade.exit_date || trade.entry_date);
      return isWithinInterval(tradeDate, { start: fromDate, end: toDate });
    });

    // Group trades by granularity and split into periods for comparison
    const groupedTrades = groupTradesByGranularity(tradesInRange, granularity);
    const periods = Object.keys(groupedTrades).sort();
    
    // Split periods in half for comparison
    const midIndex = Math.ceil(periods.length / 2);
    const firstPeriods = periods.slice(0, midIndex);
    const secondPeriods = periods.slice(midIndex);
    
    const firstPeriodTrades = firstPeriods.flatMap(period => groupedTrades[period] || []);
    const secondPeriodTrades = secondPeriods.flatMap(period => groupedTrades[period] || []);

    setPrimaryMetrics(calculateMetrics(firstPeriodTrades));
    setSecondaryMetrics(calculateMetrics(secondPeriodTrades));
    setPrimaryData(firstPeriodTrades);
    setSecondaryData(secondPeriodTrades);

    // Create chart data based on granularity
    const combinedData = createTimeComparisonChart(groupedTrades, firstPeriods, secondPeriods, granularity);
    setChartData(combinedData);
  };

  const handleAccountComparison = async (allTrades: any[], allAccounts: any[], fromAccountId: string, toAccountId: string) => {
    const fromAccountTrades = allTrades.filter(trade => trade.trading_account_id === fromAccountId);
    const toAccountTrades = allTrades.filter(trade => trade.trading_account_id === toAccountId);

    setPrimaryMetrics(calculateMetrics(fromAccountTrades));
    setSecondaryMetrics(calculateMetrics(toAccountTrades));
    setPrimaryData(fromAccountTrades);
    setSecondaryData(toAccountTrades);

    // Create chart data showing monthly performance for both accounts
    const combinedData = createAccountComparisonChart(fromAccountTrades, toAccountTrades);
    setChartData(combinedData);
  };

  const calculateMetrics = (trades: any[]): ComparisonMetrics => {
    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = trades.filter(t => (t.pnl || 0) < 0);
    const breakEvenTrades = trades.filter(t => (t.pnl || 0) === 0);
    
    const totalPnl = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length : 0;
    
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;
    
    const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.pnl || 0)) : 0;
    const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.pnl || 0)) : 0;
    
    const totalCommissions = trades.reduce((sum, trade) => sum + (trade.commission || 0), 0);
    
    // Calculate max drawdown and recovery factor
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnl = 0;
    
    trades.forEach(trade => {
      runningPnl += (trade.pnl || 0);
      if (runningPnl > peak) peak = runningPnl;
      const drawdown = peak - runningPnl;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });
    
    const recoveryFactor = maxDrawdown > 0 ? totalPnl / maxDrawdown : 0;
    const returnOnMaxDrawdown = maxDrawdown > 0 ? (totalPnl / maxDrawdown) * 100 : 0;
    
    // Calculate consecutive wins/losses
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    
    trades.forEach(trade => {
      if ((trade.pnl || 0) > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak);
      } else if ((trade.pnl || 0) < 0) {
        currentLossStreak++;
        currentWinStreak = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak);
      } else {
        currentWinStreak = 0;
        currentLossStreak = 0;
      }
    });
    
    const consecutiveWins = currentWinStreak;
    const consecutiveLosses = currentLossStreak;
    
    // Calculate expectancy
    const expectancy = (winRate / 100) * avgWin + ((100 - winRate) / 100) * avgLoss;
    
    // Calculate daily performance metrics
    const dailyPnl: Record<string, number> = {};
    trades.forEach(trade => {
      const date = format(new Date(trade.exit_date || trade.entry_date), 'yyyy-MM-dd');
      dailyPnl[date] = (dailyPnl[date] || 0) + (trade.pnl || 0);
    });
    
    const winningDays = Object.values(dailyPnl).filter(pnl => pnl > 0).length;
    const losingDays = Object.values(dailyPnl).filter(pnl => pnl < 0).length;
    const breakEvenDays = Object.values(dailyPnl).filter(pnl => pnl === 0).length;
    
    // Calculate average time in trade (hours)
    const tradesWithDuration = trades.filter(t => t.entry_date && t.exit_date);
    const avgTimeInTrade = tradesWithDuration.length > 0 
      ? tradesWithDuration.reduce((sum, trade) => {
          const duration = new Date(trade.exit_date).getTime() - new Date(trade.entry_date).getTime();
          return sum + (duration / (1000 * 60 * 60)); // Convert to hours
        }, 0) / tradesWithDuration.length
      : 0;
    
    // Calculate Sharpe ratio (simplified - assuming risk-free rate of 0)
    const dailyReturns = Object.values(dailyPnl);
    const avgDailyReturn = dailyReturns.length > 0 ? dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length : 0;
    const dailyReturnStdDev = dailyReturns.length > 1 
      ? Math.sqrt(dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgDailyReturn, 2), 0) / (dailyReturns.length - 1))
      : 0;
    const sharpeRatio = dailyReturnStdDev > 0 ? (avgDailyReturn / dailyReturnStdDev) * Math.sqrt(252) : 0; // Annualized
    
    // Calculate Calmar ratio (annual return / max drawdown)
    const annualReturn = totalPnl; // Simplified - would need time period adjustment
    const calmarRatio = maxDrawdown > 0 ? annualReturn / maxDrawdown : 0;
    
    // Risk-adjusted return
    const riskAdjustedReturn = dailyReturnStdDev > 0 ? totalPnl / dailyReturnStdDev : 0;

    return {
      totalPnl,
      winRate,
      totalTrades: trades.length,
      avgWin,
      avgLoss,
      profitFactor,
      maxDrawdown,
      bestTrade,
      worstTrade,
      sharpeRatio,
      recoveryFactor,
      consecutiveWins,
      consecutiveLosses,
      maxConsecutiveWins,
      maxConsecutiveLosses,
      expectancy,
      winningDays,
      losingDays,
      breakEvenDays,
      avgTimeInTrade,
      totalCommissions,
      returnOnMaxDrawdown,
      calmarRatio,
      riskAdjustedReturn
    };
  };

  const groupTradesByGranularity = (trades: any[], granularity: 'daily' | 'monthly' | 'yearly') => {
    const grouped: Record<string, any[]> = {};
    
    trades.forEach(trade => {
      const tradeDate = new Date(trade.exit_date || trade.entry_date);
      let key: string;
      
      switch (granularity) {
        case 'daily':
          key = format(tradeDate, 'yyyy-MM-dd');
          break;
        case 'monthly':
          key = format(tradeDate, 'yyyy-MM');
          break;
        case 'yearly':
          key = format(tradeDate, 'yyyy');
          break;
      }
      
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(trade);
    });
    
    return grouped;
  };

  const createTimeComparisonChart = (groupedTrades: Record<string, any[]>, firstPeriods: string[], secondPeriods: string[], granularity: 'daily' | 'monthly' | 'yearly') => {
    const chartData = [];
    
    // Calculate cumulative data for first periods
    let runningPnl1 = 0;
    firstPeriods.forEach((period, index) => {
      const periodTrades = groupedTrades[period] || [];
      const periodPnl = periodTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      runningPnl1 += periodPnl;
      
      chartData.push({
        period: formatPeriodLabel(period, granularity, index),
        firstPeriod: runningPnl1,
        secondPeriod: null,
        date: period
      });
    });

    // Calculate cumulative data for second periods
    let runningPnl2 = 0;
    secondPeriods.forEach((period, index) => {
      const periodTrades = groupedTrades[period] || [];
      const periodPnl = periodTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      runningPnl2 += periodPnl;
      
      const existingEntry = chartData.find(d => d.period === formatPeriodLabel(period, granularity, index));
      if (existingEntry) {
        existingEntry.secondPeriod = runningPnl2;
      } else {
        chartData.push({
          period: formatPeriodLabel(period, granularity, index),
          firstPeriod: null,
          secondPeriod: runningPnl2,
          date: period
        });
      }
    });

    return chartData;
  };

  const formatPeriodLabel = (period: string, granularity: 'daily' | 'monthly' | 'yearly', index: number) => {
    switch (granularity) {
      case 'daily':
        return format(new Date(period), 'MMM dd');
      case 'monthly':
        return format(new Date(period + '-01'), 'MMM yyyy');
      case 'yearly':
        return period;
      default:
        return `Period ${index + 1}`;
    }
  };

  const createAccountComparisonChart = (account1Trades: any[], account2Trades: any[]) => {
    const monthlyData: Record<string, { account1: number; account2: number }> = {};
    
    // Process account 1 trades
    account1Trades.forEach(trade => {
      const month = format(new Date(trade.exit_date || trade.entry_date), 'MMM yyyy');
      if (!monthlyData[month]) monthlyData[month] = { account1: 0, account2: 0 };
      monthlyData[month].account1 += (trade.pnl || 0);
    });

    // Process account 2 trades
    account2Trades.forEach(trade => {
      const month = format(new Date(trade.exit_date || trade.entry_date), 'MMM yyyy');
      if (!monthlyData[month]) monthlyData[month] = { account1: 0, account2: 0 };
      monthlyData[month].account2 += (trade.pnl || 0);
    });

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      account1: data.account1,
      account2: data.account2
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getComparisonTitle = () => {
    if (!comparisonData) return 'Comparison';
    
    if (comparisonData.compareAcross === 'time') {
      return `Date Range Comparison: ${comparisonData.fromDate ? format(comparisonData.fromDate, 'MMM dd, yyyy') : ''} - ${comparisonData.toDate ? format(comparisonData.toDate, 'MMM dd, yyyy') : ''}`;
    } else if (comparisonData.compareAcross === 'accounts') {
      return 'Account Performance Comparison';
    }
    return 'Strategy Comparison';
  };

  const getComparisonLabels = () => {
    if (!comparisonData) return { primary: 'Primary', secondary: 'Secondary' };
    
    if (comparisonData.compareAcross === 'time') {
      const granularity = comparisonData.granularity || 'monthly';
      return { 
        primary: `First ${granularity === 'daily' ? 'Period' : granularity === 'monthly' ? 'Months' : 'Years'}`, 
        secondary: `Second ${granularity === 'daily' ? 'Period' : granularity === 'monthly' ? 'Months' : 'Years'}` 
      };
    } else if (comparisonData.compareAcross === 'accounts') {
      return { primary: 'Account 1', secondary: 'Account 2' };
    }
    return { primary: 'Strategy 1', secondary: 'Strategy 2' };
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading comparison data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const labels = getComparisonLabels();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/dashboard')}
              className="mb-4 hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">{getComparisonTitle()}</h1>
            <p className="text-muted-foreground">
              Compare performance metrics across different periods or accounts
            </p>
          </div>
        </div>

        {/* Comparison Overview */}
        {primaryMetrics && secondaryMetrics && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {labels.primary}
                </CardTitle>
                <CardDescription>
                  {primaryData.length} trades • {comparisonData?.compareAcross === 'time' ? 'First period' : 'Primary comparison'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total P&L</p>
                    <p className={`text-2xl font-bold ${primaryMetrics.totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {formatCurrency(primaryMetrics.totalPnl)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                    <p className="text-2xl font-bold">{primaryMetrics.winRate.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Profit Factor:</span>
                    <span className="font-medium">{primaryMetrics.profitFactor.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Avg Win:</span>
                    <span className="font-medium text-profit">{formatCurrency(primaryMetrics.avgWin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Avg Loss:</span>
                    <span className="font-medium text-loss">{formatCurrency(primaryMetrics.avgLoss)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  {labels.secondary}
                </CardTitle>
                <CardDescription>
                  {secondaryData.length} trades • {comparisonData?.compareAcross === 'time' ? 'Second period' : 'Secondary comparison'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total P&L</p>
                    <p className={`text-2xl font-bold ${secondaryMetrics.totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {formatCurrency(secondaryMetrics.totalPnl)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                    <p className="text-2xl font-bold">{secondaryMetrics.winRate.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Profit Factor:</span>
                    <span className="font-medium">{secondaryMetrics.profitFactor.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Avg Win:</span>
                    <span className="font-medium text-profit">{formatCurrency(secondaryMetrics.avgWin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Avg Loss:</span>
                    <span className="font-medium text-loss">{formatCurrency(secondaryMetrics.avgLoss)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Performance Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Performance Comparison Chart</CardTitle>
              <CardDescription>
                {comparisonData?.compareAcross === 'time' 
                  ? `Cumulative P&L over ${comparisonData.granularity || 'monthly'} periods` 
                  : 'Monthly performance comparison'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                {comparisonData?.compareAcross === 'time' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), '']}
                      labelFormatter={(label) => `Period: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="firstPeriod" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name={labels.primary}
                      connectNulls={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="secondPeriod" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      name={labels.secondary}
                      connectNulls={false}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                    <Bar dataKey="account1" fill="#8884d8" name={labels.primary} />
                    <Bar dataKey="account2" fill="#82ca9d" name={labels.secondary} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Advanced Analytics Cards */}
        {primaryMetrics && secondaryMetrics && (
          <>
            {/* Risk Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-loss" />
                  Risk Analysis
                </CardTitle>
                <CardDescription>Comprehensive risk metrics and drawdown analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="font-medium text-muted-foreground">{labels.primary}</h4>
                    <div className="grid gap-3">
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Max Drawdown</span>
                        <span className="font-medium text-loss">{formatCurrency(primaryMetrics.maxDrawdown)}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Recovery Factor</span>
                        <span className="font-medium">{primaryMetrics.recoveryFactor.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Sharpe Ratio</span>
                        <span className="font-medium">{primaryMetrics.sharpeRatio.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Calmar Ratio</span>
                        <span className="font-medium">{primaryMetrics.calmarRatio.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Return on Max DD</span>
                        <span className="font-medium">{primaryMetrics.returnOnMaxDrawdown.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium text-muted-foreground">{labels.secondary}</h4>
                    <div className="grid gap-3">
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Max Drawdown</span>
                        <span className="font-medium text-loss">{formatCurrency(secondaryMetrics.maxDrawdown)}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Recovery Factor</span>
                        <span className="font-medium">{secondaryMetrics.recoveryFactor.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Sharpe Ratio</span>
                        <span className="font-medium">{secondaryMetrics.sharpeRatio.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Calmar Ratio</span>
                        <span className="font-medium">{secondaryMetrics.calmarRatio.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Return on Max DD</span>
                        <span className="font-medium">{secondaryMetrics.returnOnMaxDrawdown.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trading Behavior Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Trading Behavior Analysis
                </CardTitle>
                <CardDescription>Consistency, streaks, and behavioral insights</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="font-medium text-muted-foreground">{labels.primary}</h4>
                    <div className="grid gap-3">
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Current Win Streak</span>
                        <Badge variant={primaryMetrics.consecutiveWins > 0 ? "default" : "secondary"}>
                          {primaryMetrics.consecutiveWins}
                        </Badge>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Current Loss Streak</span>
                        <Badge variant={primaryMetrics.consecutiveLosses > 0 ? "destructive" : "secondary"}>
                          {primaryMetrics.consecutiveLosses}
                        </Badge>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Max Win Streak</span>
                        <span className="font-medium text-profit">{primaryMetrics.maxConsecutiveWins}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Max Loss Streak</span>
                        <span className="font-medium text-loss">{primaryMetrics.maxConsecutiveLosses}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Expectancy</span>
                        <span className={`font-medium ${primaryMetrics.expectancy >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatCurrency(primaryMetrics.expectancy)}
                        </span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Avg Trade Duration</span>
                        <span className="font-medium">{primaryMetrics.avgTimeInTrade.toFixed(1)}h</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium text-muted-foreground">{labels.secondary}</h4>
                    <div className="grid gap-3">
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Current Win Streak</span>
                        <Badge variant={secondaryMetrics.consecutiveWins > 0 ? "default" : "secondary"}>
                          {secondaryMetrics.consecutiveWins}
                        </Badge>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Current Loss Streak</span>
                        <Badge variant={secondaryMetrics.consecutiveLosses > 0 ? "destructive" : "secondary"}>
                          {secondaryMetrics.consecutiveLosses}
                        </Badge>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Max Win Streak</span>
                        <span className="font-medium text-profit">{secondaryMetrics.maxConsecutiveWins}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Max Loss Streak</span>
                        <span className="font-medium text-loss">{secondaryMetrics.maxConsecutiveLosses}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Expectancy</span>
                        <span className={`font-medium ${secondaryMetrics.expectancy >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatCurrency(secondaryMetrics.expectancy)}
                        </span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Avg Trade Duration</span>
                        <span className="font-medium">{secondaryMetrics.avgTimeInTrade.toFixed(1)}h</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Daily Performance Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Daily Performance Breakdown
                </CardTitle>
                <CardDescription>Day-by-day performance consistency analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="font-medium text-muted-foreground">{labels.primary}</h4>
                    <div className="grid gap-3">
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Winning Days</span>
                        <div className="text-right">
                          <span className="font-medium text-profit">{primaryMetrics.winningDays}</span>
                          <div className="text-xs text-muted-foreground">
                            {((primaryMetrics.winningDays / (primaryMetrics.winningDays + primaryMetrics.losingDays + primaryMetrics.breakEvenDays)) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Losing Days</span>
                        <div className="text-right">
                          <span className="font-medium text-loss">{primaryMetrics.losingDays}</span>
                          <div className="text-xs text-muted-foreground">
                            {((primaryMetrics.losingDays / (primaryMetrics.winningDays + primaryMetrics.losingDays + primaryMetrics.breakEvenDays)) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Break-even Days</span>
                        <span className="font-medium">{primaryMetrics.breakEvenDays}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Total Commissions</span>
                        <span className="font-medium text-loss">{formatCurrency(primaryMetrics.totalCommissions)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium text-muted-foreground">{labels.secondary}</h4>
                    <div className="grid gap-3">
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Winning Days</span>
                        <div className="text-right">
                          <span className="font-medium text-profit">{secondaryMetrics.winningDays}</span>
                          <div className="text-xs text-muted-foreground">
                            {((secondaryMetrics.winningDays / (secondaryMetrics.winningDays + secondaryMetrics.losingDays + secondaryMetrics.breakEvenDays)) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Losing Days</span>
                        <div className="text-right">
                          <span className="font-medium text-loss">{secondaryMetrics.losingDays}</span>
                          <div className="text-xs text-muted-foreground">
                            {((secondaryMetrics.losingDays / (secondaryMetrics.winningDays + secondaryMetrics.losingDays + secondaryMetrics.breakEvenDays)) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Break-even Days</span>
                        <span className="font-medium">{secondaryMetrics.breakEvenDays}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm">Total Commissions</span>
                        <span className="font-medium text-loss">{formatCurrency(secondaryMetrics.totalCommissions)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Performance Summary
                </CardTitle>
                <CardDescription>Key insights and recommendations based on the comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="font-medium">Key Insights</h4>
                    <div className="space-y-3">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          {primaryMetrics.totalPnl > secondaryMetrics.totalPnl ? (
                            <TrendingUp className="h-4 w-4 text-profit" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-loss" />
                          )}
                          <span className="font-medium">Total P&L</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {primaryMetrics.totalPnl > secondaryMetrics.totalPnl 
                            ? `${labels.primary} outperformed by ${formatCurrency(primaryMetrics.totalPnl - secondaryMetrics.totalPnl)}`
                            : `${labels.secondary} outperformed by ${formatCurrency(secondaryMetrics.totalPnl - primaryMetrics.totalPnl)}`
                          }
                        </p>
                      </div>
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          {primaryMetrics.winRate > secondaryMetrics.winRate ? (
                            <TrendingUp className="h-4 w-4 text-profit" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-loss" />
                          )}
                          <span className="font-medium">Consistency</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {primaryMetrics.winRate > secondaryMetrics.winRate 
                            ? `${labels.primary} had higher win rate (+${(primaryMetrics.winRate - secondaryMetrics.winRate).toFixed(1)}%)`
                            : `${labels.secondary} had higher win rate (+${(secondaryMetrics.winRate - primaryMetrics.winRate).toFixed(1)}%)`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium">Risk Assessment</h4>
                    <div className="space-y-3">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          {primaryMetrics.maxDrawdown < secondaryMetrics.maxDrawdown ? (
                            <TrendingUp className="h-4 w-4 text-profit" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-loss" />
                          )}
                          <span className="font-medium">Risk Control</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {primaryMetrics.maxDrawdown < secondaryMetrics.maxDrawdown 
                            ? `${labels.primary} had better risk control`
                            : `${labels.secondary} had better risk control`
                          }
                        </p>
                      </div>
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          {primaryMetrics.sharpeRatio > secondaryMetrics.sharpeRatio ? (
                            <TrendingUp className="h-4 w-4 text-profit" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-loss" />
                          )}
                          <span className="font-medium">Risk-Adjusted Return</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {primaryMetrics.sharpeRatio > secondaryMetrics.sharpeRatio 
                            ? `${labels.primary} had better risk-adjusted returns`
                            : `${labels.secondary} had better risk-adjusted returns`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Comparison;