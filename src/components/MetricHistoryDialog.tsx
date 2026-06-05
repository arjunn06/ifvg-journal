import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays, subMonths, parseISO } from 'date-fns';

interface MetricHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metricType: 'winRate' | 'profitFactor' | 'maxDrawdown' | 'avgReturn' | 'expectancy' | null;
  selectedAccountIds: string[];
  timeFilter: string;
}

interface MetricDataPoint {
  date: string;
  value: number;
  trades: number;
}

export function MetricHistoryDialog({
  open,
  onOpenChange,
  metricType,
  selectedAccountIds,
  timeFilter
}: MetricHistoryDialogProps) {
  const { user } = useAuth();
  const [data, setData] = useState<MetricDataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const metricLabels = {
    winRate: 'Win Rate (%)',
    profitFactor: 'Profit Factor',
    maxDrawdown: 'Max Drawdown (%)',
    avgReturn: 'Average Return per Trade',
    expectancy: 'Expectancy per Trade'
  };

  const metricColors = {
    winRate: '#10b981',
    profitFactor: '#3b82f6',
    maxDrawdown: '#ef4444',
    avgReturn: '#8b5cf6',
    expectancy: '#f59e0b'
  };

  useEffect(() => {
    if (open && metricType && user) {
      fetchMetricHistory();
    }
  }, [open, metricType, user, selectedAccountIds, timeFilter]);

  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();
    let interval = 'day';
    
    switch (timeFilter) {
      case '7d':
        startDate = subDays(now, 7);
        interval = 'day';
        break;
      case '30d':
        startDate = subDays(now, 30);
        interval = 'day';
        break;
      case '90d':
        startDate = subDays(now, 90);
        interval = 'week';
        break;
      case '6m':
        startDate = subMonths(now, 6);
        interval = 'week';
        break;
      case '1y':
        startDate = subMonths(now, 12);
        interval = 'month';
        break;
      default:
        startDate = subMonths(now, 12);
        interval = 'month';
    }
    
    return { startDate, interval };
  };

  const fetchMetricHistory = async () => {
    if (!user || !metricType) return;
    
    setLoading(true);
    try {
      // First, fetch accounts to understand the filtering
      const { data: userAccounts, error: accountsError } = await supabase
        .from('trading_accounts')
        .select('id, is_active')
        .eq('user_id', user.id);

      if (accountsError) throw accountsError;

      // Fetch all trades for the user
      let query = supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'closed')
        .order('exit_date', { ascending: true });

      const { data: allTrades, error } = await query;
      if (error) throw error;

      // Filter trades by selected accounts
      let trades = allTrades || [];
      if (selectedAccountIds.includes('all-active')) {
        // Filter to only active accounts when "all-active" is selected
        const activeAccountIds = (userAccounts || [])
          .filter(acc => acc.is_active)
          .map(acc => acc.id);
        trades = trades.filter(trade => activeAccountIds.includes(trade.trading_account_id));
      } else if (!selectedAccountIds.includes('all')) {
        // Filter to specific selected accounts
        trades = trades.filter(trade => selectedAccountIds.includes(trade.trading_account_id));
      }

      // Filter by time if not "all"
      const { startDate, interval } = getDateRange();
      if (timeFilter !== 'all') {
        trades = trades.filter(trade => 
          new Date(trade.exit_date || trade.entry_date) >= startDate
        );
      }

      if (trades.length === 0) {
        setData([]);
        return;
      }

      // Group trades by time intervals and calculate metric for each period
      const groupedData = groupTradesByInterval(trades, interval);
      const metricData = calculateMetricHistory(groupedData, metricType);
      
      setData(metricData);
    } catch (error) {
      console.error('Error fetching metric history:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupTradesByInterval = (trades: any[], interval: string) => {
    const groups: Record<string, any[]> = {};
    
    trades.forEach(trade => {
      const tradeDate = new Date(trade.exit_date || trade.entry_date);
      let key: string;
      
      switch (interval) {
        case 'day':
          key = format(tradeDate, 'yyyy-MM-dd');
          break;
        case 'week':
          const weekStart = new Date(tradeDate);
          weekStart.setDate(tradeDate.getDate() - tradeDate.getDay());
          key = format(weekStart, 'yyyy-MM-dd');
          break;
        case 'month':
          key = format(tradeDate, 'yyyy-MM');
          break;
        default:
          key = format(tradeDate, 'yyyy-MM-dd');
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(trade);
    });
    
    return groups;
  };

  const calculateMetricHistory = (groupedTrades: Record<string, any[]>, metric: string): MetricDataPoint[] => {
    let cumulativeTrades: any[] = [];
    
    return Object.entries(groupedTrades)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, trades]) => {
        cumulativeTrades = [...cumulativeTrades, ...trades];
        
        let value = 0;
        const totalTrades = cumulativeTrades.length;
        
        switch (metric) {
          case 'winRate':
            const winningTrades = cumulativeTrades.filter(t => (t.pnl || 0) > 0);
            value = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
            break;
            
          case 'profitFactor':
            const totalWins = cumulativeTrades
              .filter(t => (t.pnl || 0) > 0)
              .reduce((sum, t) => sum + (t.pnl || 0), 0);
            const totalLosses = Math.abs(cumulativeTrades
              .filter(t => (t.pnl || 0) < 0)
              .reduce((sum, t) => sum + (t.pnl || 0), 0));
            value = totalLosses > 0 ? totalWins / totalLosses : 0;
            break;
            
          case 'maxDrawdown':
            // Calculate running max drawdown
            let peak = 0;
            let maxDD = 0;
            let runningPnL = 0;
            
            cumulativeTrades.forEach(trade => {
              runningPnL += (trade.pnl || 0);
              if (runningPnL > peak) peak = runningPnL;
              const currentDD = peak > 0 ? ((peak - runningPnL) / peak) * 100 : 0;
              maxDD = Math.max(maxDD, currentDD);
            });
            value = maxDD;
            break;
            
          case 'avgReturn':
            const totalPnL = cumulativeTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
            value = totalTrades > 0 ? totalPnL / totalTrades : 0;
            break;
            
          case 'expectancy':
            const wins = cumulativeTrades.filter(t => (t.pnl || 0) > 0);
            const losses = cumulativeTrades.filter(t => (t.pnl || 0) < 0);
            const winRate = totalTrades > 0 ? wins.length / totalTrades : 0;
            const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length : 0;
            const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length : 0;
            value = (winRate * avgWin) + ((1 - winRate) * avgLoss);
            break;
        }
        
        return {
          date: formatDateForDisplay(date),
          value: Math.round(value * 100) / 100, // Round to 2 decimal places
          trades: totalTrades
        };
      });
  };

  const formatDateForDisplay = (dateStr: string) => {
    if (dateStr.length === 7) { // YYYY-MM format
      return format(parseISO(dateStr + '-01'), 'MMM yyyy');
    } else { // YYYY-MM-DD format
      return format(parseISO(dateStr), 'MMM dd');
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-primary">
            {metricType === 'winRate' ? `${data.value.toFixed(1)}%` :
             metricType === 'profitFactor' ? data.value.toFixed(2) :
             metricType === 'maxDrawdown' ? `${data.value.toFixed(1)}%` :
             metricType === 'expectancy' ? `$${data.value.toFixed(2)}` :
             `$${data.value.toFixed(2)}`}
          </p>
          <p className="text-muted-foreground text-sm">
            {data.trades} total trades
          </p>
        </div>
      );
    }
    return null;
  };

  if (!metricType) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {metricLabels[metricType]} History
          </DialogTitle>
          <DialogDescription>
            Historical progression of {metricLabels[metricType].toLowerCase()} over time
          </DialogDescription>
        </DialogHeader>
        
        <div className="h-96 w-full">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading metric history...</div>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">No data available for the selected period</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-muted-foreground"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  className="text-muted-foreground"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    if (metricType === 'winRate' || metricType === 'maxDrawdown') {
                      return `${value}%`;
                    } else if (metricType === 'avgReturn' || metricType === 'expectancy') {
                      return `$${value}`;
                    }
                    return value.toString();
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={metricColors[metricType]}
                  strokeWidth={2}
                  dot={{ fill: metricColors[metricType], strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: metricColors[metricType] }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}