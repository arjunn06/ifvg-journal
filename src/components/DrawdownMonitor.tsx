import { useDrawdownMonitor } from '@/hooks/useDrawdownMonitor';

interface DrawdownMonitorProps {
  account: {
    id: string;
    account_type: string;
    max_loss_limit?: number;
    initial_balance: number;
  };
  currentEquity: number;
}

export const DrawdownMonitor = ({ account, currentEquity }: DrawdownMonitorProps) => {
  useDrawdownMonitor({
    accountId: account.id,
    isPropFirm: account.account_type === 'prop firm',
    maxLossLimit: account.max_loss_limit,
    currentEquity,
    initialBalance: account.initial_balance
  });

  return null; // This component only handles side effects
};