import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, Target, TrendingDown, AlertTriangle, Check } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PropFirmProgressProps {
  account: {
    id: string;
    name: string;
    currency: string;
    initial_balance: number;
    profit_target?: number;
    max_loss_limit?: number;
    daily_loss_limit?: number;
    minimum_trading_days?: number;
    current_drawdown: number;
    max_drawdown_reached: boolean;
    breach_reason?: string;
    breach_date?: string;
    trading_days_completed: number;
    start_date?: string;
    target_completion_date?: string;
    trailing_drawdown_enabled?: boolean;
  };
  currentEquity: number;
  className?: string;
}

export const PropFirmProgress = ({ account, currentEquity, className }: PropFirmProgressProps) => {
  const [actualTradingDays, setActualTradingDays] = useState(0);

  useEffect(() => {
    const calculateTradingDays = async () => {
      try {
        const { data: trades } = await supabase
          .from('trades')
          .select('entry_date')
          .eq('trading_account_id', account.id);

        if (trades) {
          // Count unique dates when trades were made
          const uniqueDates = new Set(
            trades.map(trade => format(new Date(trade.entry_date), 'yyyy-MM-dd'))
          );
          setActualTradingDays(uniqueDates.size);
        }
      } catch (error) {
        console.error('Error calculating trading days:', error);
        setActualTradingDays(account.trading_days_completed || 0);
      }
    };

    calculateTradingDays();
  }, [account.id, account.trading_days_completed]);

  const currentPnl = currentEquity - account.initial_balance;
  const profitGoal = account.profit_target ? Math.max(account.profit_target - account.initial_balance, 0) : 0;
  const profitProgress = profitGoal > 0 ? Math.min(Math.max((currentPnl / profitGoal) * 100, 0), 100) : 0;
  const remainingProfit = profitGoal > 0 ? Math.max(profitGoal - currentPnl, 0) : 0;
  
  // Calculate drawdown based on trailing drawdown setting
  let drawdownUsed: number;
  if (account.trailing_drawdown_enabled) {
    // For trailing drawdown, calculate from highest equity point
    // For now, we'll use the account's current_drawdown value which should be maintained by the system
    drawdownUsed = account.current_drawdown ?? 0;
  } else {
    // For static drawdown, calculate from initial balance
    drawdownUsed = Math.max(0, account.initial_balance - currentEquity);
  }
  
  const remainingDrawdown = account.max_loss_limit ? Math.max(0, account.max_loss_limit - drawdownUsed) : 0;
  const drawdownProgress = account.max_loss_limit ? Math.min(Math.max((drawdownUsed / account.max_loss_limit) * 100, 0), 100) : 0;
  
  // Debug logging
  console.log('Drawdown Debug:', {
    currentEquity,
    initialBalance: account.initial_balance,
    currentDrawdown: account.current_drawdown,
    drawdownUsed,
    maxLossLimit: account.max_loss_limit,
    drawdownProgress
  });
  const daysProgress = account.minimum_trading_days ? Math.min((actualTradingDays / account.minimum_trading_days) * 100, 100) : 0;
  
  const daysRemaining = account.target_completion_date 
    ? Math.max(0, differenceInDays(new Date(account.target_completion_date), new Date()))
    : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: account.currency
    }).format(amount);
  };

  if (account.max_drawdown_reached) {
    return (
      <Card className={`border-destructive ${className}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Account Breached
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Badge variant="destructive" className="w-full justify-center">
            {account.breach_reason || 'Max Drawdown Exceeded'}
          </Badge>
          {account.breach_date && (
            <p className="text-xs text-muted-foreground text-center">
              Breached on {format(new Date(account.breach_date), 'MMM dd, yyyy')}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4" />
          {account.name} - Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Profit Target Progress */}
        {account.profit_target && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Profit Target</span>
              <span>{formatCurrency(currentPnl)} / {formatCurrency(profitGoal)}</span>
            </div>
            <Progress value={profitProgress} className="h-3" />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {profitProgress.toFixed(1)}% complete
              </p>
              {profitProgress >= 100 ? (
                <div className="flex items-center gap-1 text-success">
                  <Check className="h-3 w-3" />
                  <span className="text-xs font-medium">Completed</span>
                </div>
              ) : remainingProfit > 0 ? (
                <p className="text-xs text-primary font-medium">
                  {formatCurrency(remainingProfit)} more
                </p>
              ) : null}
            </div>
          </div>
        )}

        {/* Drawdown Progress */}
        {account.max_loss_limit && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Max Loss Limit {account.trailing_drawdown_enabled ? '(Trailing)' : ''}</span>
              <span className="text-destructive">
                {formatCurrency(drawdownUsed)} / {formatCurrency(account.max_loss_limit)}
              </span>
            </div>
            <Progress 
              value={drawdownProgress} 
              className={`h-3 ${
                drawdownProgress > 80 ? '[&>div]:bg-destructive' : 
                drawdownProgress > 60 ? '[&>div]:bg-yellow-500' : 
                '[&>div]:bg-green-500'
              }`}
             />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {drawdownProgress.toFixed(1)}% of max drawdown used
              </p>
              {drawdownProgress < 100 && remainingDrawdown > 0 && (
                <p className="text-xs text-muted-foreground font-medium">
                  {formatCurrency(remainingDrawdown)} left
                </p>
              )}
            </div>
          </div>
        )}

        {/* Trading Days Progress */}
        {account.minimum_trading_days && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Trading Days
              </span>
              <span>{actualTradingDays} / {account.minimum_trading_days}</span>
            </div>
            <Progress value={daysProgress} className="h-3" />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Challenge complete'}
              </p>
              {daysProgress >= 100 && (
                <div className="flex items-center gap-1 text-success">
                  <Check className="h-3 w-3" />
                  <span className="text-xs font-medium">Completed</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className="pt-2 border-t">
          {profitProgress >= 100 && daysProgress >= 100 ? (
            <Badge variant="default" className="w-full justify-center bg-success text-success-foreground">
              Challenge Passed!
            </Badge>
          ) : drawdownProgress > 90 ? (
            <Badge variant="destructive" className="w-full justify-center">
              High Risk
            </Badge>
          ) : drawdownProgress > 70 ? (
            <Badge variant="secondary" className="w-full justify-center text-warning">
              Caution
            </Badge>
          ) : (
            <Badge variant="outline" className="w-full justify-center">
              In Progress
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};