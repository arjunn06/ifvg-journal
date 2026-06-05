import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, TrendingDown, Target, DollarSign, Calendar, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { LoadingCard, LoadingTable } from '@/components/ui/loading-spinner';


interface TradingAccount {
  id: string;
  name: string;
  account_type: string;
  broker: string;
  initial_balance: number;
  current_balance: number;
  current_equity: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  equity_goal?: number;
}

interface Trade {
  id: string;
  symbol: string;
  trade_type: string;
  entry_price: number;
  exit_price?: number;
  quantity: number;
  status: string;
  pnl?: number;
  entry_date: string;
  exit_date?: string;
  commission?: number;
  swap?: number;
}

interface AccountStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  currentEquity: number;
  equityProgress: number;
}

const AccountPerformance = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      fetchAccountData();
    }
  }, [user, id]);

  const fetchAccountData = async () => {
    if (!user || !id) return;

    try {
      // Fetch account details
      const { data: accountData, error: accountError } = await supabase
        .from('trading_accounts')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (accountError) throw accountError;
      setAccount(accountData);

      // Fetch account trades
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('trading_account_id', id)
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });

      if (tradesError) throw tradesError;
      setTrades(tradesData || []);

      // Fetch financial transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('trading_account_id', id)
        .eq('user_id', user.id);

      if (transactionsError) throw transactionsError;

      // Calculate statistics
      calculateStats(accountData, tradesData || [], transactionsData || []);
    } catch (error) {
      console.error('Error fetching account data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch account performance data",
        variant: "destructive"
      });
      navigate('/accounts');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (account: TradingAccount, trades: Trade[], transactions: any[] = []) => {
    const closedTrades = trades.filter(trade => trade.status === 'closed' && trade.pnl !== null);
    
    const totalTrades = closedTrades.length;
    const winningTrades = closedTrades.filter(trade => trade.pnl! > 0).length;
    const losingTrades = closedTrades.filter(trade => trade.pnl! < 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    const totalPnL = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const totalCommission = closedTrades.reduce((sum, trade) => sum + (trade.commission || 0), 0);
    const totalSwap = closedTrades.reduce((sum, trade) => sum + (trade.swap || 0), 0);
    
    const wins = closedTrades.filter(trade => trade.pnl! > 0);
    const losses = closedTrades.filter(trade => trade.pnl! < 0);
    
    const averageWin = wins.length > 0 ? wins.reduce((sum, trade) => sum + trade.pnl!, 0) / wins.length : 0;
    const averageLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, trade) => sum + trade.pnl!, 0) / losses.length) : 0;
    
    const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl!, 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl!, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    
    // Calculate net transactions affecting equity: +deposit/+payout, -withdrawal; exclude fees/commission/other
    const totalTransactions = transactions.reduce((sum, tx) => {
      if (tx.transaction_type === 'deposit' || tx.transaction_type === 'payout') return sum + tx.amount;
      if (tx.transaction_type === 'withdrawal') return sum - tx.amount;
      return sum;
    }, 0);
    
    // Current equity includes initial balance, PnL from trades, and net transactions
    // But PnL calculations exclude transactions (only trade results)
    const currentEquity = account.initial_balance + totalPnL + totalTransactions;
    const equityProgress = account.equity_goal ? (currentEquity / account.equity_goal) * 100 : 0;

    setStats({
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalPnL,
      averageWin,
      averageLoss,
      profitFactor,
      currentEquity,
      equityProgress
    });
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center gap-4">
            <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
            <div className="flex-1 space-y-2">
              <div className="h-8 bg-muted rounded w-64 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-48 animate-pulse"></div>
            </div>
          </div>
          
          {/* Key Metrics Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingCard key={i} className="h-32" />
            ))}
          </div>
          
          {/* Performance Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LoadingCard className="h-64" />
            <LoadingCard className="h-64" />
          </div>
          
          {/* Recent Trades Skeleton */}
          <LoadingCard className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  if (!account || !stats) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Account not found</h2>
          <Button onClick={() => navigate('/accounts')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Accounts
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/accounts')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Accounts
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              {account.name}
              <Badge variant={account.is_active ? 'default' : 'secondary'}>
                {account.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </h1>
            <p className="text-muted-foreground">
              {account.account_type} • {account.broker} • {account.currency}
            </p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Current Equity</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.currentEquity, account.currency)}</p>
                  <p className="text-xs text-muted-foreground">Started with {formatCurrency(account.initial_balance, account.currency)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total P&L</p>
                  <p className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatCurrency(stats.totalPnL, account.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">From {stats.totalTrades} trades</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                  <p className={`text-2xl font-bold ${stats.winRate >= 50 ? 'text-profit' : 'text-loss'}`}>
                    {formatPercentage(stats.winRate)}
                  </p>
                  <p className="text-xs text-muted-foreground">{stats.winningTrades} wins, {stats.losingTrades} losses</p>
                </div>
                <Target className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Profit Factor</p>
                  <p className={`text-2xl font-bold ${stats.profitFactor >= 1 ? 'text-profit' : 'text-loss'}`}>
                    {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Gross profit / Gross loss</p>
                </div>
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Equity Goal Progress */}
        {account.equity_goal && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Equity Goal Progress
              </CardTitle>
              <CardDescription>
                Track your progress towards your equity target
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Current: {formatCurrency(stats.currentEquity, account.currency)}</span>
                  <span>Goal: {formatCurrency(account.equity_goal, account.currency)}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      stats.equityProgress >= 100 ? 'bg-profit' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(stats.equityProgress, 100)}%` }}
                  />
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  {formatPercentage(stats.equityProgress)} complete
                  {stats.equityProgress >= 100 && (
                    <span className="text-profit font-medium"> - Goal Achieved! 🎉</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Trading Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Trades</span>
                <span className="font-medium">{stats.totalTrades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Winning Trades</span>
                <span className="font-medium text-profit">{stats.winningTrades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Losing Trades</span>
                <span className="font-medium text-loss">{stats.losingTrades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Average Win</span>
                <span className="font-medium text-profit">
                  {formatCurrency(stats.averageWin, account.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Average Loss</span>
                <span className="font-medium text-loss">
                  {formatCurrency(stats.averageLoss, account.currency)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Type</span>
                <span className="font-medium">{account.account_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Broker</span>
                <span className="font-medium">{account.broker}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency</span>
                <span className="font-medium">{account.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Initial Balance</span>
                <span className="font-medium">
                  {formatCurrency(account.initial_balance, account.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">
                  {new Date(account.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Trades */}
        {trades.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recent Trades
              </CardTitle>
              <CardDescription>
                Latest trading activity for this account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {trades.slice(0, 10).map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant={trade.trade_type === 'buy' ? 'default' : 'secondary'}>
                        {trade.trade_type === 'buy' ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {trade.trade_type.toUpperCase()}
                      </Badge>
                      <div>
                        <p className="font-medium">{trade.symbol}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(trade.entry_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={trade.status === 'open' ? 'outline' : 'secondary'}
                      >
                        {trade.status}
                      </Badge>
                      {trade.pnl !== null && (
                        <p className={`text-sm font-medium ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatCurrency(trade.pnl, account.currency)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {trades.length > 10 && (
                <div className="mt-4 text-center">
                  <Button variant="outline" onClick={() => navigate('/trades')}>
                    View All Trades
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AccountPerformance;