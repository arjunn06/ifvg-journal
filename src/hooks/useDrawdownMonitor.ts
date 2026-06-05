import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DrawdownMonitorOptions {
  accountId: string;
  isPropFirm: boolean;
  maxLossLimit?: number;
  currentEquity: number;
  initialBalance: number;
}

export const useDrawdownMonitor = ({
  accountId,
  isPropFirm,
  maxLossLimit,
  currentEquity,
  initialBalance
}: DrawdownMonitorOptions) => {
  const { toast } = useToast();

  useEffect(() => {
    if (!isPropFirm || !maxLossLimit) return;

    const checkDrawdown = async () => {
      const currentDrawdown = initialBalance - currentEquity;
      
      if (currentDrawdown >= maxLossLimit) {
        // Account breached - deactivate it
        try {
          const { error } = await supabase
            .from('trading_accounts')
            .update({
              is_active: false,
              max_drawdown_reached: true,
              breach_reason: 'Max drawdown exceeded',
              breach_date: new Date().toISOString(),
              current_drawdown: currentDrawdown
            })
            .eq('id', accountId);

          if (error) throw error;

          toast({
            title: "Account Breached",
            description: "Maximum drawdown limit exceeded. Account has been deactivated.",
            variant: "destructive"
          });
        } catch (error) {
          console.error('Error updating breached account:', error);
        }
      } else {
        // Update current drawdown
        try {
          const { error } = await supabase
            .from('trading_accounts')
            .update({
              current_drawdown: Math.max(0, currentDrawdown)
            })
            .eq('id', accountId);

          if (error) throw error;
        } catch (error) {
          console.error('Error updating drawdown:', error);
        }
      }
    };

    checkDrawdown();
  }, [accountId, isPropFirm, maxLossLimit, currentEquity, initialBalance, toast]);
};