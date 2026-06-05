import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PropFirmProgress } from '@/components/PropFirmProgress';
import { PropFirmChart } from '@/components/PropFirmChart';

interface PropFirmDashboardProps {
  accounts: any[];
  user: any;
  formatCurrency: (amount: number, currency?: string) => string;
}

const PropFirmDashboard = ({ accounts, user, formatCurrency }: PropFirmDashboardProps) => {
  const [accountEquities, setAccountEquities] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchAccountEquities = async () => {
      if (!user || accounts.length === 0) return;

      try {
        const [tradesResult, transactionsResult] = await Promise.all([
          supabase
            .from('trades')
            .select('pnl, trading_account_id')
            .eq('user_id', user.id),
          supabase
            .from('financial_transactions')
            .select('trading_account_id, amount, transaction_type')
            .eq('user_id', user.id)
        ]);

        const equities: Record<string, number> = {};
        accounts.forEach(account => {
          const accountTrades = (tradesResult.data || []).filter(trade => trade.trading_account_id === account.id);
          const accountPnl = accountTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
          
          const accountTransactions = (transactionsResult.data || []).filter(tx => tx.trading_account_id === account.id);
          const totalTransactions = accountTransactions.reduce((sum, tx) => {
            // Only include transactions that affect account equity
            // Positive: deposit, payout
            // Negative: withdrawal
            // Excluded: evaluation_fee, commission, other (for reference only)
            if (['deposit', 'payout'].includes(tx.transaction_type)) {
              return sum + tx.amount;
            } else if (tx.transaction_type === 'withdrawal') {
              return sum - tx.amount;
            }
            return sum; // evaluation_fee, commission, other don't affect equity
          }, 0);
          
          // Debug logging for prop firm account balance calculation
          if (account.name.includes('FundingPips')) {
            console.log(`PropFirm Debug ${account.name}:`, {
              initialBalance: account.initial_balance,
              accountPnl,
              totalTransactions,
              accountTransactions,
              calculatedEquity: account.initial_balance + accountPnl + totalTransactions
            });
          }
          
          equities[account.id] = account.initial_balance + accountPnl + totalTransactions;
        });
        setAccountEquities(equities);
      } catch (error) {
        logger.apiError('Dashboard - fetching prop firm equities', error);
      }
    };

    fetchAccountEquities();
  }, [accounts, user]);

  const propFirmAccounts = accounts.filter(acc => 
    (acc.is_prop_firm || acc.account_type === 'prop firm') && acc.is_active
  );

  if (propFirmAccounts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Prop Firm Challenges
        </CardTitle>
        <CardDescription>
          Track your progress across all prop firm challenges
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6">
          {propFirmAccounts.map((account) => (
            <PropFirmProgress
              key={account.id}
              account={account}
              currentEquity={accountEquities[account.id] || account.initial_balance}
            />
          ))}
        </div>
        
        {/* Chart for each prop firm account */}
        <div className="grid gap-6 mt-6">
          {propFirmAccounts.map((account) => (
            <PropFirmChart
              key={`chart-${account.id}`}
              account={account}
              currentEquity={accountEquities[account.id] || account.initial_balance}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export { PropFirmDashboard };