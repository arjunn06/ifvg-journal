import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, ArrowUpCircle, ArrowDownCircle, Eye, Edit, Trash2, MoreHorizontal, FileText, Upload } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description?: string;
  transaction_date: string;
  trading_accounts?: {
    name: string;
    currency: string;
  };
  invoice_url?: string;
}

interface TransactionCardProps {
  transaction: Transaction;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transactionId: string) => void;
  onViewInvoice?: (invoiceUrl: string) => void;
}

const transactionTypes = {
  deposit: { label: 'Deposit', icon: ArrowUpCircle, variant: 'default' as const },
  withdrawal: { label: 'Withdrawal', icon: ArrowDownCircle, variant: 'secondary' as const },
  payout: { label: 'Payout', icon: ArrowUpCircle, variant: 'default' as const },
  evaluation_fee: { label: 'Evaluation Fee', icon: DollarSign, variant: 'outline' as const },
  commission: { label: 'Commission', icon: DollarSign, variant: 'outline' as const },
  other: { label: 'Other', icon: DollarSign, variant: 'outline' as const },
};

export function TransactionCard({ transaction, onEdit, onDelete, onViewInvoice }: TransactionCardProps) {
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  const typeInfo = transactionTypes[transaction.transaction_type as keyof typeof transactionTypes] || transactionTypes.other;
  const IconComponent = typeInfo.icon;
  
  const isPositive = ['deposit', 'payout'].includes(transaction.transaction_type);
  const isNegative = ['withdrawal'].includes(transaction.transaction_type);
  const isNeutral = ['evaluation_fee', 'commission', 'other'].includes(transaction.transaction_type);

  return (
    <Card 
      className="interactive-card group relative animate-fade-in hover:shadow-xl transition-all duration-300 cursor-pointer"
      onClick={() => onEdit?.(transaction)}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${
              isPositive ? 'bg-profit/10 text-profit' : 
              isNegative ? 'bg-loss/10 text-loss' : 
              'bg-muted text-muted-foreground'
            }`}>
              <IconComponent className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold">{typeInfo.label}</h3>
              {transaction.trading_accounts && (
                <p className="text-sm text-muted-foreground">{transaction.trading_accounts.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 transition-all duration-300 p-1 h-auto hover:bg-accent hover:scale-110"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="dropdown-content animate-scale-in">
                {onEdit && (
                  <DropdownMenuItem onClick={(e) => handleActionClick(e, () => onEdit(transaction))}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Transaction
                  </DropdownMenuItem>
                )}
                {transaction.invoice_url && onViewInvoice && (
                  <DropdownMenuItem onClick={(e) => handleActionClick(e, () => onViewInvoice(transaction.invoice_url!))}>
                    <FileText className="h-4 w-4 mr-2" />
                    View Invoice
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={(e) => handleActionClick(e, () => onDelete(transaction.id))}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Transaction
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Amount</p>
            <p className={`font-medium text-lg transition-colors duration-300 ${
              isPositive ? 'text-profit group-hover:animate-bounce-gentle' : 
              isNegative ? 'text-loss group-hover:animate-bounce-gentle' : 
              'text-foreground'
            }`}>
              {isPositive ? '+' : isNegative ? '-' : ''}
              {formatCurrency(transaction.amount, transaction.trading_accounts?.currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Date</p>
            <p className="font-medium">{formatDate(transaction.transaction_date)}</p>
          </div>
        </div>

        {transaction.description && (
          <div className="mb-3">
            <p className="text-sm text-muted-foreground">Description</p>
            <p className="text-sm">{transaction.description}</p>
          </div>
        )}

        {transaction.invoice_url && (
          <div className="mb-3">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleActionClick(e, () => onViewInvoice?.(transaction.invoice_url!))}
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              View Invoice
            </Button>
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          {onEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleActionClick(e, () => onEdit(transaction))}
              className="flex-1 hover:scale-105 transition-transform duration-200"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          {transaction.invoice_url && onViewInvoice && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleActionClick(e, () => onViewInvoice(transaction.invoice_url!))}
              className="hover:scale-105 transition-transform duration-200"
            >
              <FileText className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => handleActionClick(e, () => onDelete(transaction.id))}
              className="hover:scale-105 transition-transform duration-200 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}