import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { LoadingCard } from '@/components/ui/loading-spinner';
import PerformanceScore from '@/components/PerformanceScore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowLeft, TrendingUp, TrendingDown, Target, DollarSign, Calendar, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface Strategy {
  id: string;
  name: string;
  description: string;
  rules: string;
  entry_criteria: string;
  exit_criteria: string;
  partial_criteria: string;
  be_criteria: string;
  risk_per_trade: number;
  max_daily_risk: number;
  min_risk_reward: number;
  max_risk_reward: number;
  timeframe: string;
  market_conditions: string;
  is_active: boolean;
  created_at: string;
}

interface Trade {
  id: string;
  symbol: string;
  trade_type: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl: number;
  status: string;
  entry_date: string;
  exit_date: string;
  risk_reward_ratio: number;
}

const StrategyAnalytics = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      fetchStrategyData();
    }
  }, [user, id]);

  const fetchStrategyData = async () => {
    if (!user || !id) return;

    try {
      setLoading(true);

      // Fetch strategy details
      const { data: strategyData, error: strategyError } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (strategyError) throw strategyError;
      setStrategy(strategyData);

      // Fetch trades for this strategy
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('strategy_id', id)
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });

      if (tradesError) throw tradesError;
      setTrades(tradesData || []);

    } catch (error) {
      console.error('Error fetching strategy data:', error);
      toast({
        title: "Error",
        description: "Failed to load strategy analytics",
        variant: "destructive"
      });
      navigate('/strategies');
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = () => {
    const closedTrades = trades.filter(trade => trade.status === 'closed' && trade.pnl !== null);
    
    if (closedTrades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        avgRiskReward: 0,
        bestTrade: 0,
        worstTrade: 0
      };
    }

    const winningTrades = closedTrades.filter(trade => trade.pnl > 0);
    const losingTrades = closedTrades.filter(trade => trade.pnl < 0);
    
    const totalPnL = closedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const totalWins = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0));
    
    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;
    const avgRiskReward = closedTrades
      .filter(trade => trade.risk_reward_ratio)
      .reduce((sum, trade) => sum + trade.risk_reward_ratio, 0) / 
      closedTrades.filter(trade => trade.risk_reward_ratio).length || 0;

    return {
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / closedTrades.length) * 100,
      totalPnL,
      avgWin,
      avgLoss,
      profitFactor,
      avgRiskReward,
      bestTrade: Math.max(...closedTrades.map(trade => trade.pnl)),
      worstTrade: Math.min(...closedTrades.map(trade => trade.pnl))
    };
  };

  const prepareChartData = () => {
    const closedTrades = trades
      .filter(trade => trade.status === 'closed' && trade.exit_date)
      .sort((a, b) => new Date(a.exit_date).getTime() - new Date(b.exit_date).getTime());

    let cumulativePnL = 0;
    return closedTrades.map(trade => {
      cumulativePnL += trade.pnl;
      return {
        date: format(new Date(trade.exit_date), 'MMM dd'),
        pnl: cumulativePnL,
        tradePnL: trade.pnl
      };
    });
  };

  const preparePieData = () => {
    const metrics = calculateMetrics();
    return [
      { name: 'Winning Trades', value: metrics.winningTrades, color: '#22c55e' },
      { name: 'Losing Trades', value: metrics.losingTrades, color: '#ef4444' }
    ];
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <LoadingCard className="h-20" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingCard key={i} className="h-32" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!strategy) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h3 className="text-lg font-medium mb-2">Strategy not found</h3>
          <p className="text-muted-foreground mb-4">The strategy you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={() => navigate('/strategies')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Strategies
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const metrics = calculateMetrics();
  const chartData = prepareChartData();
  const pieData = preparePieData();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/strategies')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{strategy.name}</h1>
              <p className="text-muted-foreground">Strategy Analytics & Performance</p>
            </div>
          </div>
          <Badge variant={strategy.is_active ? 'default' : 'secondary'}>
            {strategy.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Performance Score */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <PerformanceScore
            winRate={metrics.winRate}
            profitFactor={metrics.profitFactor}
            riskRewardRatio={metrics.avgRiskReward}
          />

          {/* Key Metrics */}
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Trades</p>
                    <p className="text-2xl font-bold">{metrics.totalTrades}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-success" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total P&L</p>
                    <p className={`text-2xl font-bold ${metrics.totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                      ${metrics.totalPnL.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <div>
                    <p className="text-sm text-muted-foreground">Best Trade</p>
                    <p className="text-2xl font-bold text-success">${metrics.bestTrade.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm text-muted-foreground">Worst Trade</p>
                    <p className="text-2xl font-bold text-destructive">${metrics.worstTrade.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cumulative P&L Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cumulative P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        `$${value}`,
                        name === 'pnl' ? 'Cumulative P&L' : name
                      ]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="pnl" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Win/Loss Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Win/Loss Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Strategy Details */}
        <Card>
          <CardHeader>
            <CardTitle>Strategy Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{strategy.description || 'No description provided'}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Timeframe</h4>
                <p className="text-sm text-muted-foreground">{strategy.timeframe || 'Not specified'}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Risk Per Trade</h4>
                <p className="text-sm text-muted-foreground">{strategy.risk_per_trade ? `${strategy.risk_per_trade}%` : 'Not specified'}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Risk:Reward Range</h4>
                <p className="text-sm text-muted-foreground">
                  {strategy.min_risk_reward && strategy.max_risk_reward 
                    ? `1:${strategy.min_risk_reward} - 1:${strategy.max_risk_reward}`
                    : 'Not specified'
                  }
                </p>
              </div>
            </div>

            {strategy.entry_criteria && (
              <div>
                <h4 className="font-medium mb-2">Entry Criteria</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{strategy.entry_criteria}</p>
              </div>
            )}

            {strategy.exit_criteria && (
              <div>
                <h4 className="font-medium mb-2">Exit Criteria</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{strategy.exit_criteria}</p>
              </div>
            )}

            {strategy.rules && (
              <div>
                <h4 className="font-medium mb-2">Trading Rules</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{strategy.rules}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StrategyAnalytics;