import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DashboardLayout } from '@/components/DashboardLayout';
import { LoadingCard } from '@/components/ui/loading-spinner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, isWithinInterval, getWeek, getMonth, getYear, getDaysInMonth, getDay, addDays, differenceInDays } from 'date-fns';
import { TrendingUp, TrendingDown, Calendar as CalendarIcon, Target, DollarSign, BarChart3, ChevronLeft, ChevronRight, FileText, Clock } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AccountFilter } from '@/components/AccountFilter';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { TradeCard } from '@/components/TradeCard';
interface DayPnL {
  date: string;
  pnl: number;
  trades: number;
  winRate: number;
  bestTrade: number;
  worstTrade: number;
}
interface PeriodMetrics {
  totalPnl: number;
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  bestDay: number;
  worstDay: number;
  profitableDays: number;
  tradingDays: number;
}
interface WeeklySummary {
  weekNumber: number;
  year: number;
  startDate: Date;
  endDate: Date;
  totalPnl: number;
  totalTrades: number;
  isCurrentWeek: boolean;
}
export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedDateTrades, setSelectedDateTrades] = useState<any[]>([]);
  const [dayPnLData, setDayPnLData] = useState<DayPnL[]>([]);
  const [periodMetrics, setPeriodMetrics] = useState<PeriodMetrics | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(['all']);
  const [tradingAccounts, setTradingAccounts] = useState<{
    id: string;
    name: string;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) {
      fetchPnLData();
      fetchTradingAccounts();
    }
  }, [user]);
  useEffect(() => {
    if (user) {
      fetchPnLData();
    }
  }, [user, selectedAccountIds]);
  useEffect(() => {
    if (date && user) {
      fetchTradesForDate(date);
      calculatePeriodMetrics();
      calculateWeeklySummaries();
    }
  }, [date, user, selectedPeriod, dayPnLData, selectedAccountIds]);
  const fetchTradingAccounts = async () => {
    if (!user) return;
    try {
      const {
        data,
        error
      } = await supabase.from('trading_accounts').select('id, name').eq('user_id', user.id).order('name');
      if (error) throw error;
      setTradingAccounts(data || []);
    } catch (error) {
      console.error('Error fetching trading accounts:', error);
    }
  };
  const fetchPnLData = async () => {
    try {
      let query = supabase.from('trades').select('exit_date, entry_date, pnl, symbol, trade_type, trading_account_id').eq('user_id', user?.id).eq('status', 'closed').not('pnl', 'is', null);
      
      // Filter by selected accounts
      if (!selectedAccountIds.includes('all') && selectedAccountIds.length > 0) {
        query = query.in('trading_account_id', selectedAccountIds);
      }
      const {
        data: trades,
        error
      } = await query;
      if (error) throw error;
      const pnlByDate = trades.reduce((acc: Record<string, {
        pnl: number;
        trades: any[];
      }>, trade) => {
        if (trade.exit_date && trade.pnl !== null) {
          const dateKey = format(new Date(trade.exit_date), 'yyyy-MM-dd');
          if (!acc[dateKey]) {
            acc[dateKey] = {
              pnl: 0,
              trades: []
            };
          }
          acc[dateKey].pnl += Number(trade.pnl);
          acc[dateKey].trades.push(trade);
        }
        return acc;
      }, {});
      const dayPnLArray = Object.entries(pnlByDate).map(([date, data]) => {
        const winningTrades = data.trades.filter(t => Number(t.pnl) > 0);
        const losingTrades = data.trades.filter(t => Number(t.pnl) < 0);
        const winRate = data.trades.length > 0 ? winningTrades.length / data.trades.length * 100 : 0;
        const bestTrade = data.trades.length > 0 ? Math.max(...data.trades.map(t => Number(t.pnl))) : 0;
        const worstTrade = data.trades.length > 0 ? Math.min(...data.trades.map(t => Number(t.pnl))) : 0;
        return {
          date,
          pnl: data.pnl,
          trades: data.trades.length,
          winRate,
          bestTrade,
          worstTrade
        };
      });
      setDayPnLData(dayPnLArray);
    } catch (error) {
      console.error('Error fetching P&L data:', error);
    } finally {
      setLoading(false);
    }
  };
  const calculateWeeklySummaries = () => {
    if (!date || dayPnLData.length === 0) {
      setWeeklySummaries([]);
      return;
    }
    const currentMonth = getMonth(date);
    const currentYear = getYear(date);
    const weeksMap = new Map<string, WeeklySummary>();

    // Get all weeks that have data in the current month
    dayPnLData.forEach(dayData => {
      const dayDate = new Date(dayData.date);
      const dayMonth = getMonth(dayDate);
      const dayYear = getYear(dayDate);

      // Only include days from the current month/year
      if (dayMonth === currentMonth && dayYear === currentYear) {
        const weekStart = startOfWeek(dayDate, {
          weekStartsOn: 1
        });
        const weekEnd = endOfWeek(dayDate, {
          weekStartsOn: 1
        });
        const weekNumber = getWeek(dayDate, {
          weekStartsOn: 1
        });
        const weekKey = `${dayYear}-${weekNumber}`;
        if (!weeksMap.has(weekKey)) {
          weeksMap.set(weekKey, {
            weekNumber,
            year: dayYear,
            startDate: weekStart,
            endDate: weekEnd,
            totalPnl: 0,
            totalTrades: 0,
            isCurrentWeek: isWithinInterval(date, {
              start: weekStart,
              end: weekEnd
            })
          });
        }
        const weekSummary = weeksMap.get(weekKey)!;
        weekSummary.totalPnl += dayData.pnl;
        weekSummary.totalTrades += dayData.trades;
      }
    });
    const summaries = Array.from(weeksMap.values()).sort((a, b) => a.weekNumber - b.weekNumber);
    setWeeklySummaries(summaries);
  };
  const fetchTradesForDate = async (selectedDate: Date) => {
    try {
      let query = supabase.from('trades').select(`
          *,
          trading_accounts!inner(name, currency),
          strategies(name)
        `).eq('user_id', user?.id).gte('exit_date', startOfDay(selectedDate).toISOString()).lte('exit_date', endOfDay(selectedDate).toISOString()).eq('status', 'closed');
      
      // Filter by selected accounts
      if (!selectedAccountIds.includes('all') && selectedAccountIds.length > 0) {
        query = query.in('trading_account_id', selectedAccountIds);
      }
      const {
        data: trades,
        error
      } = await query;
      if (error) throw error;
      setSelectedDateTrades(trades || []);
    } catch (error) {
      console.error('Error fetching trades for date:', error);
    }
  };
  const calculatePeriodMetrics = () => {
    if (!date || dayPnLData.length === 0) return;
    let startDate: Date;
    let endDate: Date;
    if (selectedPeriod === 'week') {
      startDate = startOfWeek(date, {
        weekStartsOn: 1
      });
      endDate = endOfWeek(date, {
        weekStartsOn: 1
      });
    } else {
      startDate = startOfMonth(date);
      endDate = endOfMonth(date);
    }
    const periodData = dayPnLData.filter(day => {
      const dayDate = new Date(day.date);
      return isWithinInterval(dayDate, {
        start: startDate,
        end: endDate
      });
    });
    if (periodData.length === 0) {
      setPeriodMetrics(null);
      return;
    }
    const totalPnl = periodData.reduce((sum, day) => sum + day.pnl, 0);
    const totalTrades = periodData.reduce((sum, day) => sum + day.trades, 0);
    const profitableDays = periodData.filter(day => day.pnl > 0).length;
    const allPnLs = periodData.map(day => day.pnl);
    const bestDay = Math.max(...allPnLs);
    const worstDay = Math.min(...allPnLs);

    // Calculate win rate across all trades in period
    const allWins = periodData.reduce((sum, day) => sum + day.winRate / 100 * day.trades, 0);
    const winRate = totalTrades > 0 ? allWins / totalTrades * 100 : 0;
    const profitableDayPnLs = periodData.filter(day => day.pnl > 0).map(day => day.pnl);
    const losingDayPnLs = periodData.filter(day => day.pnl < 0).map(day => day.pnl);
    const avgWin = profitableDayPnLs.length > 0 ? profitableDayPnLs.reduce((sum, pnl) => sum + pnl, 0) / profitableDayPnLs.length : 0;
    const avgLoss = losingDayPnLs.length > 0 ? losingDayPnLs.reduce((sum, pnl) => sum + pnl, 0) / losingDayPnLs.length : 0;
    setPeriodMetrics({
      totalPnl,
      totalTrades,
      winRate,
      avgWin,
      avgLoss,
      bestDay,
      worstDay,
      profitableDays,
      tradingDays: periodData.length
    });
  };
  const getDayPnL = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return dayPnLData.find(data => data.date === dateKey);
  };
  const renderCalendar = () => {
    if (!date) return null;
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const startDate = startOfWeek(monthStart, {
      weekStartsOn: 1
    }); // Start week on Monday
    const endDate = endOfWeek(monthEnd, {
      weekStartsOn: 1
    });
    const days = [];
    let currentDate = startDate;
    while (currentDate <= endDate) {
      days.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }
    // Precompute week indices for Sundays with trades (only count weeks that have trades)
    const sundayWeekIndexMap = new Map<string, number>();
    let weekCounter = 1;
days.forEach((d) => {
  if (getDay(d) === 0) {
        const weekStart = startOfWeek(d, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(d, { weekStartsOn: 1 });
    const hasTradesInCurrentMonth = dayPnLData.some((trade) => {
      const tradeDate = new Date(trade.date);
      return (
        tradeDate >= weekStart &&
        tradeDate <= weekEnd &&
        getMonth(tradeDate) === getMonth(date) &&
        getYear(tradeDate) === getYear(date)
      );
    });
    if (hasTradesInCurrentMonth) {
      sundayWeekIndexMap.set(format(d, 'yyyy-MM-dd'), weekCounter++);
    }
  }
});

    const weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    return <div className="w-full">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold">
            {format(date, 'MMMM yyyy')}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Week Day Headers */}
        <div className="grid grid-cols-7 gap-px mb-2">
          {weekDays.map(day => <div key={day} className="text-center py-2 text-sm text-muted-foreground font-medium">
              {day}
            </div>)}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px bg-border">
          {days.map((day, index) => {
          const pnlData = getDayPnL(day);
          const isSelected = date && format(day, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
          const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          const isCurrentMonth = getMonth(day) === getMonth(date);
          const isSunday = getDay(day) === 0; // Sunday = 0

          // Calculate weekly summary for Sunday cells
          let weeklyData = null;
if (isSunday) {
  const weekStart = startOfWeek(day, {
    weekStartsOn: 1
  }); // Week starts on Monday
  const weekEnd = endOfWeek(day, {
    weekStartsOn: 1
  });
  const weekNumber = sundayWeekIndexMap.get(format(day, 'yyyy-MM-dd')) ?? 1;

  // Get all trades for this week (including trades from adjacent months)
  const weekTrades = dayPnLData.filter((trade) => {
    const tradeDate = new Date(trade.date);
    return tradeDate >= weekStart && tradeDate <= weekEnd;
  });

  if (weekTrades.length > 0) {
    const weekPnL = weekTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const weekTradeCount = weekTrades.reduce((sum, trade) => sum + trade.trades, 0);
    weeklyData = {
      weekNumber,
      pnl: weekPnL,
      trades: weekTradeCount,
    };
  }
}
          return <div key={index} onClick={() => setDate(day)} className={cn("min-h-[80px] bg-background cursor-pointer border transition-all hover:bg-muted/50 flex flex-col justify-between p-2 hover-scale animate-fade-in relative", isToday && "ring-2 ring-primary/50", isSelected && "ring-2 ring-primary", !isCurrentMonth && "opacity-40", isSunday && weeklyData && "lg:min-h-[100px]" // Extra height for weekly summary
          )}>
                {/* Day number */}
                <div className="flex justify-between items-start">
                  <div className="text-sm font-medium text-foreground">
                    {day.getDate()}
                  </div>
                </div>
                
                {/* Weekly Summary for Sundays */}
                {isSunday && weeklyData && <div className="absolute top-6 right-1 bg-card border border-border rounded-lg p-2 shadow-lg min-w-[80px] max-w-[90px] animate-fade-in">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Week {weeklyData.weekNumber}
                    </div>
                    <div className={cn("text-sm font-bold mb-1 leading-tight", weeklyData.pnl >= 0 ? "text-success" : "text-destructive")}>
                      {weeklyData.pnl >= 0 ? '+' : ''}${Math.abs(weeklyData.pnl) >= 1000 ? `${(weeklyData.pnl / 1000).toFixed(1)}k` : weeklyData.pnl.toFixed(0)}
                    </div>
                    <div className="text-xs text-muted-foreground leading-tight">
                      {weeklyData.trades} trade{weeklyData.trades !== 1 ? 's' : ''}
                    </div>
                  </div>}
                
                {/* Regular Daily Summary for other days */}
                {!isSunday && pnlData && isCurrentMonth && <div className="flex flex-col items-center mt-auto">
                    <div className={cn("text-sm font-bold", pnlData.pnl >= 0 ? "text-success" : "text-destructive")}>
                      {pnlData.pnl >= 0 ? '+' : ''}${Math.abs(pnlData.pnl) >= 1000 ? `${(pnlData.pnl / 1000).toFixed(1)}k` : pnlData.pnl.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {pnlData.trades} trades
                    </div>
                  </div>}
                
                {/* Daily Summary for Sunday if no weekly data */}
                {isSunday && !weeklyData && pnlData && isCurrentMonth && <div className="flex flex-col items-center mt-auto">
                    <div className={cn("text-sm font-bold", pnlData.pnl >= 0 ? "text-success" : "text-destructive")}>
                      {pnlData.pnl >= 0 ? '+' : ''}${Math.abs(pnlData.pnl) >= 1000 ? `${(pnlData.pnl / 1000).toFixed(1)}k` : pnlData.pnl.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {pnlData.trades} trades
                    </div>
                  </div>}
              </div>;
        })}
        </div>
      </div>;
  };
  const selectedDayData = date ? getDayPnL(date) : null;
  const totalPnL = selectedDateTrades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
  const winningTrades = selectedDateTrades.filter(trade => Number(trade.pnl) > 0).length;
  const losingTrades = selectedDateTrades.filter(trade => Number(trade.pnl) < 0).length;
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Check if today is Saturday or first day of month to show recap options
  const today = new Date();
  const isSaturday = getDay(today) === 6; // Saturday = 6
  const isFirstOfMonth = today.getDate() === 1;
  if (loading) {
    return <DashboardLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-8 bg-muted rounded w-40 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-64 animate-pulse"></div>
            </div>
            <div className="h-10 bg-muted rounded w-48 animate-pulse"></div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Calendar Skeleton */}
            <div className="lg:col-span-2">
              <LoadingCard className="h-96" />
            </div>
            
            {/* Day Details Skeleton */}
            <LoadingCard className="h-96" />
          </div>
          
          {/* Period Metrics Skeleton */}
          <LoadingCard className="h-64" />
        </div>
      </DashboardLayout>;
  }
  return <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">P&L Calendar</h1>
            <p className="text-muted-foreground">Track your daily trading performance</p>
            
            {/* Generate Report Button */}
            <div className="flex gap-2 mt-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Generate Report
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => navigate('/weekly-report')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Weekly Report
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/monthly-report')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Monthly Report
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/calendar')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Yearly Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {isSaturday && <Button variant="outline" size="sm" onClick={() => navigate('/weekly-report')} className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  View Weekly Recap
                </Button>}
              {isFirstOfMonth && <Button variant="outline" size="sm" onClick={() => navigate('/monthly-report')} className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  View Monthly Recap
                </Button>}
            </div>
          </div>
          <div className="min-w-[200px]">
            <AccountFilter 
              values={selectedAccountIds} 
              onValuesChange={setSelectedAccountIds} 
              className="min-w-[200px]"
              multiSelect={true}
              placeholder="All accounts" 
            />
          </div>
        </div>

        <div className="grid gap-6">
          {/* Enhanced Calendar */}
          <Card className="bg-background border-border">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarIcon className="h-5 w-5" />
                {date ? format(date, 'MMMM yyyy') : 'Trading Calendar'}
              </CardTitle>
              <CardDescription>
                Click on any date to view detailed trading metrics. Green indicates profit, red indicates loss.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {renderCalendar()}
            </CardContent>
          </Card>

          {/* Weekly Summaries */}
          
        </div>

        {/* Day Details Section - Only show when date is selected */}
        {date && selectedDayData && <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {format(date, 'EEEE, MMMM dd, yyyy')}
              </CardTitle>
              <CardDescription>
                Detailed metrics for the selected day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Total P&L</div>
                  <div className={`text-2xl font-bold ${selectedDayData.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {selectedDayData.pnl >= 0 ? '+' : ''}{formatCurrency(selectedDayData.pnl)}
                  </div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Total Trades</div>
                  <div className="text-2xl font-bold">{selectedDayData.trades}</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Win Rate</div>
                  <div className="text-2xl font-bold">{selectedDayData.winRate.toFixed(0)}%</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Best Trade</div>
                  <div className="text-2xl font-bold text-profit">
                    +{formatCurrency(selectedDayData.bestTrade)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>}

        {/* Period Metrics */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Period Performance
                </CardTitle>
                <CardDescription>
                  {selectedPeriod === 'week' ? 'Weekly' : 'Monthly'} trading metrics for the selected period
                </CardDescription>
              </div>
              <Select value={selectedPeriod} onValueChange={(value: 'week' | 'month') => setSelectedPeriod(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {periodMetrics ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">Total P&L</div>
                  </div>
                  <div className={`text-xl font-bold ${periodMetrics.totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatCurrency(periodMetrics.totalPnl)}
                  </div>
                </div>

                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">Win Rate</div>
                  </div>
                  <div className="text-xl font-bold">
                    {periodMetrics.winRate.toFixed(1)}%
                  </div>
                </div>

                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">Best Day</div>
                  </div>
                  <div className="text-xl font-bold text-profit">
                    {formatCurrency(periodMetrics.bestDay)}
                  </div>
                </div>

                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">Worst Day</div>
                  </div>
                  <div className="text-xl font-bold text-loss">
                    {formatCurrency(periodMetrics.worstDay)}
                  </div>
                </div>

                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Total Trades</div>
                  <div className="text-xl font-bold">{periodMetrics.totalTrades}</div>
                </div>

                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Trading Days</div>
                  <div className="text-xl font-bold">{periodMetrics.tradingDays}</div>
                </div>

                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Profitable Days</div>
                  <div className="text-xl font-bold text-profit">{periodMetrics.profitableDays} out of {periodMetrics.tradingDays}</div>
                </div>

                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Avg Win</div>
                  <div className="text-xl font-bold text-profit">
                    {formatCurrency(periodMetrics.avgWin)}
                  </div>
                </div>
              </div> : <div className="text-center py-8">
                <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No trading data for this {selectedPeriod}</p>
              </div>}
          </CardContent>
        </Card>

        {/* Trades for Selected Date */}
        {selectedDateTrades.length > 0 && <Card>
            <CardHeader>
              <CardTitle>Trades on {date ? format(date, 'MMMM dd, yyyy') : ''}</CardTitle>
              <CardDescription>
                Detailed breakdown of all trades executed on the selected day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedDateTrades.map(trade => (
                  <TradeCard key={trade.id} trade={trade} />
                ))}
              </div>
            </CardContent>
          </Card>}
      </div>
    </DashboardLayout>;
}