import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Upload, FileText, X, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description?: string;
  transaction_date: string;
  trading_account_id?: string;
  invoice_url?: string;
  trading_accounts?: {
    name: string;
    currency: string;
  };
}

interface Account {
  id: string;
  name: string;
  currency: string;
}

interface TransactionDetailDialogProps {
  transaction: Transaction | null;
  accounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const transactionTypes = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'payout', label: 'Payout' },
  { value: 'evaluation_fee', label: 'Evaluation Fee' },
  { value: 'commission', label: 'Commission' },
  { value: 'other', label: 'Other' },
];

export function TransactionDetailDialog({ 
  transaction, 
  accounts, 
  open, 
  onOpenChange, 
  onUpdate 
}: TransactionDetailDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    transaction_type: '',
    amount: '',
    description: '',
    transaction_date: '',
    trading_account_id: '',
  });
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [currentInvoiceUrl, setCurrentInvoiceUrl] = useState<string>('');

  useEffect(() => {
    if (transaction) {
      setFormData({
        transaction_type: transaction.transaction_type,
        amount: transaction.amount.toString(),
        description: transaction.description || '',
        transaction_date: new Date(transaction.transaction_date).toISOString().split('T')[0],
        trading_account_id: transaction.trading_account_id || 'none',
      });
      setCurrentInvoiceUrl(transaction.invoice_url || '');
    }
  }, [transaction]);

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
      const fileName = `${user.id}/${transaction?.id || 'new'}-${Date.now()}.${fileExt}`;

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

  const deleteInvoice = async (invoiceUrl: string) => {
    try {
      const fileName = invoiceUrl.split('/').pop();
      if (fileName) {
        const { error } = await supabase.storage
          .from('trade-screenshots')
          .remove([fileName]);
        
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !transaction) return;

    if (!formData.transaction_type || !formData.amount) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      let invoiceUrl = currentInvoiceUrl;

      // Upload new invoice if provided
      if (invoiceFile) {
        const uploadedUrl = await uploadInvoice();
        if (uploadedUrl) {
          // Delete old invoice if exists
          if (currentInvoiceUrl) {
            await deleteInvoice(currentInvoiceUrl);
          }
          invoiceUrl = uploadedUrl;
        }
      }

      const { error } = await supabase
        .from('financial_transactions')
        .update({
          transaction_type: formData.transaction_type,
          amount: parseFloat(formData.amount),
          description: formData.description || null,
          transaction_date: formData.transaction_date,
          trading_account_id: formData.trading_account_id === 'none' ? null : formData.trading_account_id,
          invoice_url: invoiceUrl || null,
        })
        .eq('id', transaction.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Transaction updated successfully',
      });

      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to update transaction',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!currentInvoiceUrl || !transaction) return;

    try {
      await deleteInvoice(currentInvoiceUrl);
      
      const { error } = await supabase
        .from('financial_transactions')
        .update({ invoice_url: null })
        .eq('id', transaction.id);

      if (error) throw error;

      setCurrentInvoiceUrl('');
      toast({
        title: 'Success',
        description: 'Invoice deleted successfully',
      });
      
      onUpdate();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete invoice',
        variant: 'destructive',
      });
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="transaction_type">Transaction Type *</Label>
              <Select 
                value={formData.transaction_type} 
                onValueChange={(value) => setFormData({ ...formData, transaction_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="dropdown-content">
                  {transactionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="transaction_date">Date *</Label>
              <Input
                id="transaction_date"
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="trading_account_id">Trading Account</Label>
              <Select 
                value={formData.trading_account_id} 
                onValueChange={(value) => setFormData({ ...formData, trading_account_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent className="dropdown-content">
                  <SelectItem value="none">No specific account</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          <Separator />

          <div>
            <Label className="text-base font-medium">Invoice/Receipt</Label>
            <div className="mt-2 space-y-4">
              {currentInvoiceUrl && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">Current invoice</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(currentInvoiceUrl, '_blank')}
                        >
                          View
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleDeleteInvoice}
                          className="hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div>
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
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading || uploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || uploading || !formData.transaction_type || !formData.amount}
            >
              {loading || uploading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}