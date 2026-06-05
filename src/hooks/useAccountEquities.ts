import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export const useAccountEquities = (user: any, accounts: any[]) => {
  const [accountEquities, setAccountEquities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAccountEquities = async () => {
      if (!user || accounts.length === 0) {
        setAccountEquities({});
        return;
      }

      setLoading(true);
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

        if (tradesResult.error) throw tradesResult.error;
        if (transactionsResult.error) throw transactionsResult.error;

        const allTrades = tradesResult.data || [];
        const allTransactions = transactionsResult.data || [];

        const equities: Record<string, number> = {};
        
        accounts.forEach(account => {
          const accountTrades = allTrades.filter(trade => trade.trading_account_id === account.id);
          const accountPnl = accountTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
          
          const accountTransactions = allTransactions.filter(tx => tx.trading_account_id === account.id);
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
          
          equities[account.id] = account.initial_balance + accountPnl + totalTransactions;
        });
        
        setAccountEquities(equities);
      } catch (error) {
        logger.apiError('useAccountEquities - fetching equities', error);
        setAccountEquities({});
      } finally {
        setLoading(false);
      }
    };

    fetchAccountEquities();
  }, [user, accounts]);

  return { accountEquities, loading };
};