import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, Receipt, DollarSign, CreditCard, Award, Building2, TrendingUp, TrendingDown, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface FinancialTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
  accountName?: string;
  currency?: string;
  onTransactionAdded?: () => void;
}

export const FinancialTransactionDialog = ({
  open,
  onOpenChange,
  accountId,
  accountName,
  currency = 'USD',
  onTransactionAdded
}: FinancialTransactionDialogProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tradingAccounts, setTradingAccounts] = useState<Array<{ id: string; name: string; currency: string }>>([]);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    transaction_type: '',
    amount: '',
    description: '',
    transaction_date: new Date(),
    trading_account_id: accountId || 'none',
  });

  const transactionTypes = [
    { value: 'deposit', label: 'Deposit', icon: DollarSign },
    { value: 'withdrawal', label: 'Withdrawal', icon: DollarSign },
    { value: 'evaluation_fee', label: 'Evaluation Fee', icon: Award },
    { value: 'payout', label: 'Payout', icon: DollarSign },
    { value: 'commission', label: 'Commission', icon: DollarSign },
    { value: 'other', label: 'Other', icon: DollarSign },
  ];

  const fetchTradingAccounts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('id, name, currency')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTradingAccounts(data || []);
    } catch (error) {
      console.error('Error fetching trading accounts:', error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchTradingAccounts();
      setFormData({
        transaction_type: '',
        amount: '',
        description: '',
        transaction_date: new Date(),
        trading_account_id: accountId || 'none',
      });
      setInvoiceFile(null);
    }
  }, [open, accountId, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: 'Please select a PDF or image file',
          variant: 'destructive',
        });
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select a file smaller than 5MB',
          variant: 'destructive',
        });
        return;
      }
      
      setInvoiceFile(file);
    }
  };

  const uploadInvoice = async (): Promise<string | null> => {
    if (!invoiceFile || !user) return null;

    setUploading(true);
    try {
      const fileExt = invoiceFile.name.split('.').pop();
      const fileName = `${user.id}/transaction-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('trade-screenshots')
        .upload(fileName, invoiceFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('trade-screenshots')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading invoice:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload invoice. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Basic validation: amount must be a positive number
    const amount = parseFloat(formData.amount);
    if (!isFinite(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount greater than 0.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Upload invoice if provided
      let invoiceUrl = null;
      if (invoiceFile) {
        invoiceUrl = await uploadInvoice();
      }

      const { error } = await supabase
        .from('financial_transactions')
        .insert([
          {
            user_id: user.id,
            trading_account_id:
              formData.trading_account_id === 'none' ? null : formData.trading_account_id,
            transaction_type: formData.transaction_type,
            amount,
            description: formData.description || null,
            transaction_date: formData.transaction_date.toISOString(),
            invoice_url: invoiceUrl,
          },
        ]);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${transactionTypes.find((t) => t.value === formData.transaction_type)?.label} recorded successfully`,
      });

      onTransactionAdded?.();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error recording financial transaction:', error);
      toast({
        title: "Error",
        description: `Failed to record transaction${error?.message ? `: ${error.message}` : ''}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      transaction_type: '',
      amount: '',
      description: '',
      transaction_date: new Date(),
      trading_account_id: accountId || 'none',
    });
    setInvoiceFile(null);
  };

  const selectedType = transactionTypes.find(t => t.value === formData.transaction_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedType ? (
              <selectedType.icon className="h-5 w-5" />
            ) : (
              <Receipt className="h-5 w-5" />
            )}
            Financial Transaction
          </DialogTitle>
          <DialogDescription>
            {accountName ? `Record financial expenses for ${accountName}` : 'Record a financial transaction'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="transaction_type">Transaction Type</Label>
              <Select 
                value={formData.transaction_type} 
                onValueChange={(value) => setFormData({ ...formData, transaction_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select transaction type" />
                </SelectTrigger>
                <SelectContent className="dropdown-content">
                  {transactionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="amount">Amount ({currency})</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Transaction Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.transaction_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.transaction_date ? (
                      format(formData.transaction_date, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.transaction_date}
                    onSelect={(date) => date && setFormData({ ...formData, transaction_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {!accountId && (
              <div>
                <Label htmlFor="trading_account">Trading Account (Optional)</Label>
                <Select
                  value={formData.trading_account_id}
                  onValueChange={(value) => setFormData({ ...formData, trading_account_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent className="dropdown-content">
                    <SelectItem value="none">No Account</SelectItem>
                    {tradingAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Add a note about this transaction..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <Separator />

          <div>
            <Label className="text-base font-medium">Invoice/Receipt (Optional)</Label>
            <div className="mt-2">
              <Label htmlFor="invoice" className="cursor-pointer">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {invoiceFile ? invoiceFile.name : 'Click to upload invoice/receipt'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, JPG, PNG up to 5MB
                  </p>
                </div>
              </Label>
              <Input
                id="invoice"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
              {invoiceFile && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setInvoiceFile(null)}
                  className="mt-2"
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove file
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading || uploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || uploading || !formData.transaction_type || !formData.amount}
              className="flex-1"
            >
              {loading || uploading ? 'Recording...' : 'Record Transaction'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};