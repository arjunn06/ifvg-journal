import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MetricDisplay } from '@/components/ui/metric-display';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, Calendar, Download, Target, DollarSign, BarChart3, Award, GitCompare } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, startOfWeek, endOfWeek, subWeeks, isWithinInterval } from 'date-fns';

interface WeeklyStats {
  totalPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  profitFactor: number;
  expectancy: number;
  profitableDays: number;
  totalTradingDays: number;
  weekStart: Date;
  weekEnd: Date;
}

interface DailyPerformance {
  date: string;
  pnl: number;
  trades: number;
}

export default function WeeklyReport() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(0); // 0 = current week, 1 = last week, etc.
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [previousWeekStats, setPreviousWeekStats] = useState<WeeklyStats | null>(null);
  const [dailyData, setDailyData] = useState<DailyPerformance[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [compareMode, setCompareMode] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWeeklyReport();
    }
  }, [user, selectedWeek, selectedAccountId, compareMode]);

  const fetchWeeklyReport = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch trading accounts
      const { data: accountsData } = await supabase
        .from('trading_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      setAccounts(accountsData || []);

      // Calculate week range
      const now = new Date();
      const weekStart = startOfWeek(subWeeks(now, selectedWeek), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(subWeeks(now, selectedWeek), { weekStartsOn: 1 });

      // Fetch current week stats
      const currentStats = await fetchWeekStats(weekStart, weekEnd, accountsData);
      setWeeklyStats(currentStats);

      // Fetch previous week stats if compare mode is enabled
      if (compareMode) {
        const prevWeekStart = startOfWeek(subWeeks(now, selectedWeek + 1), { weekStartsOn: 1 });
        const prevWeekEnd = endOfWeek(subWeeks(now, selectedWeek + 1), { weekStartsOn: 1 });
        const prevStats = await fetchWeekStats(prevWeekStart, prevWeekEnd, accountsData);
        setPreviousWeekStats(prevStats);
      } else {
        setPreviousWeekStats(null);
      }

      // Generate daily performance data for current week
      const weekTrades = await fetchTradesForPeriod(weekStart, weekEnd, accountsData);

      // Generate daily performance data for current week
      const dailyMap: Record<string, { pnl: number; trades: number }> = {};
      
      // Initialize all days of the week with 0
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const dateKey = format(d, 'yyyy-MM-dd');
        dailyMap[dateKey] = { pnl: 0, trades: 0 };
      }

      // Aggregate trades by day
      weekTrades.forEach(trade => {
        const tradeDate = format(new Date(trade.entry_date), 'yyyy-MM-dd');
        if (dailyMap[tradeDate]) {
          dailyMap[tradeDate].pnl += trade.pnl || 0;
          dailyMap[tradeDate].trades += 1;
        }
      });

      const dailyPerformance = Object.entries(dailyMap).map(([date, data]) => ({
        date: format(new Date(date), 'EEE'),
        pnl: data.pnl,
        trades: data.trades
      }));

      setDailyData(dailyPerformance);

    } catch (error) {
      console.error('Error fetching weekly report:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTradesForPeriod = async (start: Date, end: Date, accountsData: any[]) => {
    let tradesQuery = supabase
      .from('trades')
      .select('*')
      .eq('user_id', user!.id)
      .gte('entry_date', start.toISOString())
      .lte('entry_date', end.toISOString())
      .eq('status', 'closed');

    if (selectedAccountId !== 'all') {
      tradesQuery = tradesQuery.eq('trading_account_id', selectedAccountId);
    } else if (accountsData && accountsData.length > 0) {
      const activeAccountIds = accountsData.map(acc => acc.id);
      tradesQuery = tradesQuery.in('trading_account_id', activeAccountIds);
    }

    const { data: trades } = await tradesQuery;
    return trades || [];
  };

  const fetchWeekStats = async (weekStart: Date, weekEnd: Date, accountsData: any[]): Promise<WeeklyStats> => {
    const trades = await fetchTradesForPeriod(weekStart, weekEnd, accountsData);

    const totalPnl = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = trades.filter(t => (t.pnl || 0) < 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));

    // Calculate profitable days
    const dailyPnLMap: Record<string, number> = {};
    trades.forEach(trade => {
      const dateKey = format(new Date(trade.entry_date), 'yyyy-MM-dd');
      dailyPnLMap[dateKey] = (dailyPnLMap[dateKey] || 0) + (trade.pnl || 0);
    });
    const profitableDays = Object.values(dailyPnLMap).filter(pnl => pnl > 0).length;
    const totalTradingDays = Object.keys(dailyPnLMap).length;

    return {
      totalPnl,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
      bestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.pnl || 0)) : 0,
      worstTrade: trades.length > 0 ? Math.min(...trades.map(t => t.pnl || 0)) : 0,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : 0,
      expectancy: trades.length > 0 ? totalPnl / trades.length : 0,
      profitableDays,
      totalTradingDays,
      weekStart,
      weekEnd
    };
  };

  const getWeekDisplayText = (weekOffset: number) => {
    if (weekOffset === 0) return 'This Week';
    if (weekOffset === 1) return 'Last Week';
    return `${weekOffset} Weeks Ago`;
  };

  const exportReport = () => {
    if (!weeklyStats) return;
    
    const reportData = {
      period: `${format(weeklyStats.weekStart, 'MMM dd')} - ${format(weeklyStats.weekEnd, 'MMM dd, yyyy')}`,
      totalPnL: weeklyStats.totalPnl,
      totalTrades: weeklyStats.totalTrades,
      winRate: weeklyStats.winRate.toFixed(1) + '%',
      profitFactor: weeklyStats.profitFactor.toFixed(2),
      expectancy: weeklyStats.expectancy.toFixed(2),
      bestTrade: weeklyStats.bestTrade,
      worstTrade: weeklyStats.worstTrade,
      dailyBreakdown: dailyData
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `weekly-report-${format(weeklyStats.weekStart, 'yyyy-MM-dd')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <LoadingSpinner size="lg" text="Generating weekly report..." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Weekly Trading Report</h1>
            <p className="text-muted-foreground">
              {weeklyStats && `${format(weeklyStats.weekStart, 'MMM dd')} - ${format(weeklyStats.weekEnd, 'MMM dd, yyyy')}`}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="compare-mode"
                checked={compareMode}
                onCheckedChange={setCompareMode}
              />
              <Label htmlFor="compare-mode" className="text-sm flex items-center gap-1">
                <GitCompare className="h-4 w-4" />
                Compare
              </Label>
            </div>

            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4].map((week) => (
                  <SelectItem key={week} value={week.toString()}>
                    {getWeekDisplayText(week)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={exportReport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {weeklyStats ? (
          <>
            {/* Key Metrics */}
            {compareMode && previousWeekStats ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <GitCompare className="h-5 w-5" />
                  Performance Comparison
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricDisplay
                    label="Total P&L"
                    value={weeklyStats.totalPnl}
                    format="currency"
                    icon={DollarSign}
                    trend={weeklyStats.totalPnl > 0 ? 'up' : weeklyStats.totalPnl < 0 ? 'down' : 'neutral'}
                    change={{
                      value: weeklyStats.totalPnl - previousWeekStats.totalPnl,
                      label: 'vs prev week'
                    }}
                  />
                  
                  <MetricDisplay
                    label="Win Rate"
                    value={weeklyStats.winRate}
                    format="percentage"
                    icon={Target}
                    change={{
                      value: weeklyStats.winRate - previousWeekStats.winRate,
                      label: 'vs prev week'
                    }}
                  />
                  
                  <MetricDisplay
                    label="Total Trades"
                    value={weeklyStats.totalTrades}
                    icon={BarChart3}
                    change={{
                      value: weeklyStats.totalTrades - previousWeekStats.totalTrades,
                      label: 'vs prev week'
                    }}
                  />
                  
                  <MetricDisplay
                    label="Profit Factor"
                    value={weeklyStats.profitFactor}
                    format="number"
                    icon={Award}
                    trend={weeklyStats.profitFactor > 1 ? 'up' : 'down'}
                    change={{
                      value: weeklyStats.profitFactor - previousWeekStats.profitFactor,
                      label: 'vs prev week'
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricDisplay
                  label="Total P&L"
                  value={weeklyStats.totalPnl}
                  format="currency"
                  icon={DollarSign}
                  trend={weeklyStats.totalPnl > 0 ? 'up' : weeklyStats.totalPnl < 0 ? 'down' : 'neutral'}
                />
                
                <MetricDisplay
                  label="Win Rate"
                  value={weeklyStats.winRate}
                  format="percentage"
                  icon={Target}
                  change={{
                    value: weeklyStats.winRate - 50, // Compare to 50% baseline
                    label: 'vs 50%'
                  }}
                />
                
                <MetricDisplay
                  label="Total Trades"
                  value={weeklyStats.totalTrades}
                  icon={BarChart3}
                />
                
                <MetricDisplay
                  label="Profit Factor"
                  value={weeklyStats.profitFactor}
                  format="number"
                  icon={Award}
                  trend={weeklyStats.profitFactor > 1 ? 'up' : 'down'}
                />
              </div>
            )}

            {/* Performance Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Trade Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Trade Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Winning Trades</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-success/10 text-success">
                        {weeklyStats.winningTrades}
                      </Badge>
                      <span className="text-sm font-medium">
                        ${weeklyStats.avgWin.toFixed(2)} avg
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Losing Trades</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                        {weeklyStats.losingTrades}
                      </Badge>
                      <span className="text-sm font-medium">
                        ${weeklyStats.avgLoss.toFixed(2)} avg
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">Best Trade</span>
                      <span className="text-sm font-medium text-success">
                        +${weeklyStats.bestTrade.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Worst Trade</span>
                      <span className="text-sm font-medium text-destructive">
                        ${weeklyStats.worstTrade.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Daily Performance Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Daily Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Bar 
                        dataKey="pnl" 
                        fill="#8884d8"
                        name="P&L"
                        className="opacity-80"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Additional Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>
                  Key performance indicators for the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   <div className="text-center">
                     <div className="text-2xl font-bold">
                       ${weeklyStats.expectancy.toFixed(2)}
                     </div>
                     <div className="text-sm text-muted-foreground">
                       Expected Value per Trade
                     </div>
                   </div>
                   
                   <div className="text-center">
                     <div className="text-2xl font-bold">
                       {weeklyStats.profitFactor.toFixed(2)}
                     </div>
                     <div className="text-sm text-muted-foreground">
                       Profit Factor
                     </div>
                   </div>
                   
                   <div className="text-center">
                     <div className="text-2xl font-bold">
                       {weeklyStats.winRate.toFixed(1)}%
                     </div>
                     <div className="text-sm text-muted-foreground">
                       Win Rate
                     </div>
                   </div>

                   <div className="text-center">
                     <div className="text-2xl font-bold text-success">
                       {weeklyStats.profitableDays} out of {weeklyStats.totalTradingDays}
                     </div>
                     <div className="text-sm text-muted-foreground">
                       Profitable Days
                     </div>
                   </div>
                 </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
              <p className="text-muted-foreground text-center max-w-md">
                No trades found for the selected week. Try selecting a different time period or account.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}