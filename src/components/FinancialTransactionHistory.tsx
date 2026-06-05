import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Receipt, DollarSign, CreditCard, Award } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface FinancialTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

interface FinancialTransactionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
  currency: string;
  onTransactionDeleted: () => void;
}

export const FinancialTransactionHistory = ({
  open,
  onOpenChange,
  accountId,
  accountName,
  currency,
  onTransactionDeleted
}: FinancialTransactionHistoryProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  const transactionTypes = {
    challenge_fee: { label: 'Challenge Fee', icon: CreditCard, color: 'bg-orange-100 text-orange-800' },
    evaluation_fee: { label: 'Evaluation Fee', icon: Award, color: 'bg-blue-100 text-blue-800' },
    funded_account_fee: { label: 'Funded Account Fee', icon: Receipt, color: 'bg-green-100 text-green-800' },
    deposit: { label: 'Deposit', icon: DollarSign, color: 'bg-green-100 text-green-800' },
    withdrawal: { label: 'Withdrawal', icon: DollarSign, color: 'bg-red-100 text-red-800' }
  };

  useEffect(() => {
    if (open) {
      fetchTransactions();
    }
  }, [open, accountId]);

  const fetchTransactions = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('trading_account_id', accountId)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching financial transactions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch transaction history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (transaction: FinancialTransaction) => {
    try {
      const { error } = await supabase
        .from('financial_transactions')
        .delete()
        .eq('id', transaction.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Transaction deleted successfully"
      });

      fetchTransactions();
      onTransactionDeleted();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast({
        title: "Error",
        description: "Failed to delete transaction",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Financial Transaction History
          </DialogTitle>
          <DialogDescription>
            Financial expenses for {accountName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {totalSpent > 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalSpent)}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No financial transactions</h3>
              <p className="text-muted-foreground">Start recording your trading-related expenses</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {transactions.map((transaction) => {
                  const type = transactionTypes[transaction.transaction_type as keyof typeof transactionTypes];
                  const Icon = type?.icon || Receipt;

                  return (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatCurrency(transaction.amount)}</span>
                            <Badge variant="outline" className={type?.color}>
                              {type?.label || transaction.transaction_type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(transaction.transaction_date), 'MMM dd, yyyy')}
                          </p>
                          {transaction.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {transaction.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(transaction)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};