import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PropFirmChartProps {
  account: {
    id: string;
    name: string;
    currency: string;
    initial_balance: number;
    profit_target?: number;
    max_loss_limit?: number;
    current_drawdown: number;
    start_date?: string;
  };
  currentEquity: number;
  className?: string;
}

interface TradeDataPoint {
  date: string;
  equity: number;
  displayDate: string;
}

export const PropFirmChart = ({ account, currentEquity, className }: PropFirmChartProps) => {
  const [chartData, setChartData] = useState<TradeDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTradeData = async () => {
      try {
        const { data: trades } = await supabase
          .from('trades')
          .select('entry_date, pnl')
          .eq('trading_account_id', account.id)
          .order('entry_date', { ascending: true });

        if (!trades || trades.length === 0) {
          // No trades yet, show just starting point
          const startDate = account.start_date ? new Date(account.start_date) : new Date();
          setChartData([{
            date: startDate.toISOString(),
            equity: account.initial_balance,
            displayDate: format(startDate, 'MMM dd')
          }]);
          setLoading(false);
          return;
        }

        // Calculate equity progression based on trade dates
        let runningEquity = account.initial_balance;
        const dataPoints: TradeDataPoint[] = [];
        
        // Add starting point
        const startDate = account.start_date ? new Date(account.start_date) : new Date(trades[0].entry_date);
        dataPoints.push({
          date: startDate.toISOString(),
          equity: account.initial_balance,
          displayDate: format(startDate, 'MMM dd')
        });

        // Add equity progression for each trade
        trades.forEach((trade) => {
          runningEquity += trade.pnl || 0;
          dataPoints.push({
            date: trade.entry_date,
            equity: runningEquity,
            displayDate: format(new Date(trade.entry_date), 'MMM dd')
          });
        });

        setChartData(dataPoints);
      } catch (error) {
        console.error('Error fetching trade data:', error);
        // Fallback to basic data
        const startDate = account.start_date ? new Date(account.start_date) : new Date();
        setChartData([{
          date: startDate.toISOString(),
          equity: account.initial_balance,
          displayDate: format(startDate, 'MMM dd')
        }]);
      } finally {
        setLoading(false);
      }
    };

    fetchTradeData();
  }, [account.id, account.initial_balance, account.start_date]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: account.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate chart boundaries
  const currentPnl = currentEquity - account.initial_balance;
  const maxLossLevel = account.max_loss_limit ? account.initial_balance - account.max_loss_limit : null;
  
  const allValues = [
    account.initial_balance,
    currentEquity,
    account.profit_target,
    maxLossLevel
  ].filter(Boolean) as number[];

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-primary">
            Equity: {formatCurrency(payload[0].value)}
          </p>
          {payload[0].value !== account.initial_balance && (
            <p className={`text-xs ${payload[0].value >= account.initial_balance ? 'text-success' : 'text-destructive'}`}>
              P&L: {payload[0].value >= account.initial_balance ? '+' : ''}{formatCurrency(payload[0].value - account.initial_balance)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };
  const minY = Math.min(...allValues) * 0.95;
  const maxY = Math.max(...allValues) * 1.05;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Performance Chart
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 w-full flex items-center justify-center">
            <div className="text-muted-foreground">Loading chart data...</div>
          </div>
        ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="displayDate" 
                axisLine={false}
                tickLine={false}
                className="text-xs"
              />
              <YAxis 
                domain={[minY, maxY]}
                tickFormatter={formatCurrency}
                axisLine={false}
                tickLine={false}
                className="text-xs"
                width={80}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              {/* Max Loss Line */}
              {maxLossLevel && (
                <ReferenceLine 
                  y={maxLossLevel} 
                  stroke="hsl(var(--destructive))" 
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}
              
              {/* Profit Target Line */}
              {account.profit_target && (
                <ReferenceLine 
                  y={account.profit_target} 
                  stroke="hsl(var(--success))" 
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}
              
              {/* Starting Balance Line */}
              <ReferenceLine 
                y={account.initial_balance} 
                stroke="hsl(var(--muted-foreground))" 
                strokeDasharray="2 2"
                strokeWidth={1}
              />
              
              {/* Current Equity Line */}
              <Line 
                type="monotone" 
                dataKey="equity" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        )}
        
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-primary"></div>
            <span>Current Equity</span>
          </div>
          {account.profit_target && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-success"></div>
              <span>Target: {formatCurrency(account.profit_target)}</span>
            </div>
          )}
          {maxLossLevel && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-destructive"></div>
              <span>Max Loss: {formatCurrency(maxLossLevel)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-muted-foreground"></div>
            <span>Start: {formatCurrency(account.initial_balance)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-primary"></div>
            <span>Current: {formatCurrency(currentEquity)} ({currentPnl >= 0 ? '+' : ''}{formatCurrency(currentPnl)})</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};