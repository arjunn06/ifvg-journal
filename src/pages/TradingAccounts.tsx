import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, Edit, Trash2, DollarSign, History, BarChart3, Upload, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { LoadingTable, LoadingCard } from '@/components/ui/loading-spinner';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumFeature } from '@/components/PremiumFeature';
import { CsvImportSection } from '@/components/CsvImportSection';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useUndoToast } from '@/components/UndoToast';
import { PropFirmProgress } from '@/components/PropFirmProgress';
import { DrawdownMonitor } from '@/components/DrawdownMonitor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

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
  is_prop_firm: boolean;
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
  evaluation_certificate_url?: string;
}

const TradingAccounts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { showUndoToast } = useUndoToast();
  const { isPremium } = useSubscription();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<TradingAccount | null>(null);
  const [accountEquities, setAccountEquities] = useState<Record<string, number>>({});
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    account_type: '',
    broker: '',
    initial_balance: '',
    currency: 'USD',
    equity_goal: '',
    profit_target: '',
    max_loss_limit: '',
    daily_loss_limit: '',
    minimum_trading_days: '',
    start_date: new Date(),
    trailing_drawdown_enabled: false
  });

  // Premium limits for basic users
  const BASIC_ACCOUNT_LIMIT = 1;

  useEffect(() => {
    if (user) {
      fetchAccounts();
    }
  }, [user]);

  // Listen for account refresh messages from child components
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'refresh-accounts') {
        fetchAccounts();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchAccounts = async () => {
    if (!user) return;

    try {
      const [accountsResult, tradesResult, transactionsResult] = await Promise.all([
        supabase
          .from('trading_accounts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('trades')
          .select('trading_account_id, pnl')
          .eq('user_id', user.id)
          .not('pnl', 'is', null),
        supabase
          .from('financial_transactions')
          .select('trading_account_id, amount, transaction_type')
          .eq('user_id', user.id)
      ]);

      if (accountsResult.error) throw accountsResult.error;
      if (tradesResult.error) throw tradesResult.error;
      if (transactionsResult.error) throw transactionsResult.error;

      const accounts = accountsResult.data || [];
      const trades = tradesResult.data || [];
      const transactions = transactionsResult.data || [];

      // Calculate equity for each account including transactions
      const equities: Record<string, number> = {};
      accounts.forEach(account => {
        const accountTrades = trades.filter(trade => trade.trading_account_id === account.id);
        const totalPnl = accountTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        
        const accountTransactions = transactions.filter(tx => tx.trading_account_id === account.id);
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
        
        // Debug logging for account balance calculation
        if (account.name.includes('FundingPips')) {
          console.log(`Debug ${account.name}:`, {
            initialBalance: account.initial_balance,
            totalPnl,
            totalTransactions,
            accountTransactions,
            calculatedEquity: account.initial_balance + totalPnl + totalTransactions
          });
        }
        
        // Equity = initial balance + PnL + net transactions (deposits - withdrawals)
        equities[account.id] = account.initial_balance + totalPnl + totalTransactions;
      });

      setAccounts(accounts);
      setAccountEquities(equities);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch trading accounts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const accountData = {
        name: formData.name,
        account_type: formData.account_type,
        broker: formData.broker,
        initial_balance: parseFloat(formData.initial_balance),
        current_balance: parseFloat(formData.initial_balance),
        current_equity: parseFloat(formData.initial_balance),
        currency: formData.currency,
        equity_goal: formData.equity_goal ? parseFloat(formData.equity_goal) : null,
        is_prop_firm: formData.account_type === 'prop firm',
        profit_target: formData.account_type === 'prop firm' && formData.profit_target ? parseFloat(formData.profit_target) : null,
        max_loss_limit: formData.account_type === 'prop firm' && formData.max_loss_limit ? parseFloat(formData.max_loss_limit) : null,
        daily_loss_limit: formData.account_type === 'prop firm' && formData.daily_loss_limit ? parseFloat(formData.daily_loss_limit) : null,
        minimum_trading_days: formData.account_type === 'prop firm' && formData.minimum_trading_days ? parseInt(formData.minimum_trading_days) : null,
        trailing_drawdown_enabled: formData.account_type === 'prop firm' ? formData.trailing_drawdown_enabled : false,
        start_date: formData.account_type === 'prop firm' ? formData.start_date.toISOString() : null,
        target_completion_date: formData.account_type === 'prop firm' && formData.minimum_trading_days 
          ? addDays(formData.start_date, parseInt(formData.minimum_trading_days)).toISOString() 
          : null,
        user_id: user.id
      };

      let accountId = editingAccount?.id;

      if (editingAccount) {
        const updateData = {
          ...accountData,
          is_active: editingAccount.is_active
        };
        const { error } = await supabase
          .from('trading_accounts')
          .update(updateData)
          .eq('id', editingAccount.id);

        if (error) throw error;
        toast({ title: "Success", description: "Account updated successfully" });
      } else {
        // Create the account first
        const { data: newAccount, error } = await supabase
          .from('trading_accounts')
          .insert([accountData])
          .select()
          .single();

        if (error) throw error;
        accountId = newAccount.id;

        toast({ title: "Success", description: "Account created successfully" });
      }

      // Handle certificate upload if file is selected
      if (certificateFile && accountId) {
        await handleCertificateUpload(accountId);
      }

      setDialogOpen(false);
      setEditingAccount(null);
      resetForm();
      fetchAccounts();
    } catch (error) {
      console.error('Error saving account:', error);
      toast({
        title: "Error",
        description: "Failed to save account",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (account: TradingAccount) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      account_type: account.account_type,
      broker: account.broker || '',
      initial_balance: account.initial_balance.toString(),
      currency: account.currency,
      equity_goal: account.equity_goal?.toString() || '',
      profit_target: account.profit_target?.toString() || '',
      max_loss_limit: account.max_loss_limit?.toString() || '',
      daily_loss_limit: account.daily_loss_limit?.toString() || '',
      minimum_trading_days: account.minimum_trading_days?.toString() || '',
      start_date: account.start_date ? new Date(account.start_date) : new Date(),
      trailing_drawdown_enabled: account.trailing_drawdown_enabled || false
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = (account: TradingAccount) => {
    setAccountToDelete(account);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!accountToDelete) return;

    const deletedAccount = { ...accountToDelete };
    
    try {
      const { error } = await supabase
        .from('trading_accounts')
        .delete()
        .eq('id', accountToDelete.id);

      if (error) throw error;
      
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
      fetchAccounts();

      // Show undo toast
      showUndoToast({
        message: `Account "${deletedAccount.name}" deleted`,
        onUndo: () => handleUndoDelete(deletedAccount)
      });
      
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: "Error",
        description: "Failed to delete account",
        variant: "destructive"
      });
    }
  };

  const handleUndoDelete = async (account: TradingAccount) => {
    if (!user) return;
    
    try {
      const { id, created_at, ...accountData } = account;
      const restoreData = {
        ...accountData,
        user_id: user.id
      };
      
      const { error } = await supabase
        .from('trading_accounts')
        .insert([restoreData]);

      if (error) throw error;
      
      toast({ 
        title: "Restored", 
        description: `Account "${account.name}" has been restored` 
      });
      fetchAccounts();
    } catch (error) {
      console.error('Error restoring account:', error);
      toast({
        title: "Error",
        description: "Failed to restore account",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      account_type: '',
      broker: '',
      initial_balance: '',
      currency: 'USD',
      equity_goal: '',
      profit_target: '',
      max_loss_limit: '',
      daily_loss_limit: '',
      minimum_trading_days: '',
      start_date: new Date(),
      trailing_drawdown_enabled: false
    });
    setCertificateFile(null);
  };

  const handleCertificateUpload = async (accountId: string) => {
    if (!certificateFile || !user) return;

    setUploadingCertificate(true);
    try {
      const fileExt = certificateFile.name.split('.').pop();
      const fileName = `${user.id}/${accountId}/certificate.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('trade-screenshots')
        .upload(fileName, certificateFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('trade-screenshots')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('trading_accounts')
        .update({ evaluation_certificate_url: urlData.publicUrl })
        .eq('id', accountId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Certificate uploaded successfully"
      });
    } catch (error) {
      console.error('Error uploading certificate:', error);
      toast({
        title: "Error",
        description: "Failed to upload certificate",
        variant: "destructive"
      });
    } finally {
      setUploadingCertificate(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-72 animate-pulse"></div>
            </div>
            <div className="h-10 bg-muted rounded w-40 animate-pulse"></div>
          </div>
          
          {/* Accounts Table Skeleton */}
          <Card>
            <CardHeader>
              <div className="h-6 bg-muted rounded w-40 animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <LoadingTable rows={5} cols={6} />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Check if basic user has exceeded account limit
  const hasExceededLimit = !isPremium && accounts.length >= BASIC_ACCOUNT_LIMIT;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Trading Accounts</h1>
            <p className="text-muted-foreground">Manage your trading accounts and track balances</p>
          </div>
          {hasExceededLimit ? (
            <PremiumFeature
              feature="Multiple Trading Accounts"
              description="Basic users can track 1 account. Upgrade to premium for unlimited accounts."
              showUpgrade={false}
              fallback={
                <Button disabled variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Upgrade for More Accounts
                </Button>
              }
            />
          ) : (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setEditingAccount(null); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Account
                </Button>
              </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAccount ? 'Edit' : 'Add'} Trading Account</DialogTitle>
              <DialogDescription>
                {editingAccount ? 'Update' : 'Create'} your trading account details
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[calc(90vh-8rem)] overflow-y-auto pr-2">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Account Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="account_type">Account Type</Label>
                  <Select value={formData.account_type} onValueChange={(value) => setFormData({ ...formData, account_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="demo">Demo</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="prop firm">Prop Firm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="broker">Broker</Label>
                  <Input
                    id="broker"
                    value={formData.broker}
                    onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="initial_balance">Initial Balance</Label>
                    <Input
                      id="initial_balance"
                      type="number"
                      step="0.01"
                      value={formData.initial_balance}
                      onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="JPY">JPY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                 <div>
                   <Label htmlFor="equity_goal">Profit Goal (Optional)</Label>
                   <Input
                     id="equity_goal"
                     type="number"
                     step="0.01"
                     placeholder="Target profit goal"
                     value={formData.equity_goal}
                     onChange={(e) => setFormData({ ...formData, equity_goal: e.target.value })}
                   />
                   <p className="text-xs text-muted-foreground mt-1">
                     Set a target profit goal to track your progress
                   </p>
                  </div>

                  {/* Prop Firm Configuration - only show when prop firm is selected */}
                  {formData.account_type === 'prop firm' && (
                    <div className="space-y-4 border border-border rounded-lg p-4">
                      <div className="flex items-center space-x-2">
                        <div className="h-4 w-4 rounded bg-purple-100 flex items-center justify-center">
                          <div className="h-2 w-2 rounded bg-purple-600"></div>
                        </div>
                        <Label className="font-medium text-purple-700">
                          Prop Firm Challenge Settings
                        </Label>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="profit_target">Profit Target</Label>
                            <Input
                              id="profit_target"
                              type="number"
                              step="0.01"
                              placeholder="Required profit"
                              value={formData.profit_target}
                              onChange={(e) => setFormData({ ...formData, profit_target: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="max_loss_limit">Max Loss Limit</Label>
                            <Input
                              id="max_loss_limit"
                              type="number"
                              step="0.01"
                              placeholder="Maximum allowed loss"
                              value={formData.max_loss_limit}
                              onChange={(e) => setFormData({ ...formData, max_loss_limit: e.target.value })}
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="daily_loss_limit">Daily Loss Limit</Label>
                            <Input
                              id="daily_loss_limit"
                              type="number"
                              step="0.01"
                              placeholder="Maximum daily loss"
                              value={formData.daily_loss_limit}
                              onChange={(e) => setFormData({ ...formData, daily_loss_limit: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="minimum_trading_days">Minimum Trading Days</Label>
                            <Input
                              id="minimum_trading_days"
                              type="number"
                              placeholder="Required trading days"
                              value={formData.minimum_trading_days}
                              onChange={(e) => setFormData({ ...formData, minimum_trading_days: e.target.value })}
                            />
                          </div>
                        </div>

                         <div>
                           <Label>Challenge Start Date</Label>
                           <Popover>
                             <PopoverTrigger asChild>
                               <Button
                                 variant="outline"
                                 className={cn(
                                   "w-full justify-start text-left font-normal",
                                   !formData.start_date && "text-muted-foreground"
                                 )}
                               >
                                 <CalendarIcon className="mr-2 h-4 w-4" />
                                 {formData.start_date ? (
                                   format(formData.start_date, "PPP")
                                 ) : (
                                   <span>Pick start date</span>
                                 )}
                               </Button>
                             </PopoverTrigger>
                             <PopoverContent className="w-auto p-0" align="start">
                               <Calendar
                                 mode="single"
                                 selected={formData.start_date}
                                 onSelect={(date) => date && setFormData({ ...formData, start_date: date })}
                                 initialFocus
                                 className={cn("p-3 pointer-events-auto")}
                               />
                             </PopoverContent>
                           </Popover>
                         </div>

                         <div className="flex items-center space-x-2">
                           <Checkbox
                             id="trailing_drawdown"
                             checked={formData.trailing_drawdown_enabled}
                             onCheckedChange={(checked) => 
                               setFormData({ ...formData, trailing_drawdown_enabled: !!checked })
                             }
                           />
                           <Label htmlFor="trailing_drawdown" className="text-sm">
                             Enable Trailing Drawdown Rule
                           </Label>
                         </div>
                         
                         <div>
                           <Label htmlFor="certificate">Evaluation Pass Certificate (Optional)</Label>
                           <Input
                             id="certificate"
                             type="file"
                             accept=".jpg,.jpeg,.png,.pdf"
                             onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                             className="cursor-pointer"
                           />
                           <p className="text-xs text-muted-foreground mt-1">
                             Upload your evaluation pass certificate (JPG, PNG, or PDF)
                           </p>
                           {editingAccount?.evaluation_certificate_url && (
                             <div className="mt-2">
                               <a 
                                 href={editingAccount.evaluation_certificate_url} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="text-sm text-primary hover:underline flex items-center gap-1"
                               >
                                 <Upload className="h-3 w-3" />
                                 View current certificate
                               </a>
                             </div>
                           )}
                         </div>
                      </div>
                    </div>
                  )}

                 {editingAccount && (
                   <div className="flex items-center justify-between p-4 border rounded-lg">
                     <div>
                       <Label htmlFor="is_active">Account Status</Label>
                       <p className="text-sm text-muted-foreground">
                         Inactive accounts are hidden from trade entry but statistics remain viewable
                       </p>
                     </div>
                     <div className="flex items-center space-x-2">
                       <span className="text-sm text-muted-foreground">Inactive</span>
                       <Switch
                         id="is_active"
                         checked={editingAccount.is_active}
                         onCheckedChange={(checked) => setEditingAccount({ ...editingAccount, is_active: checked })}
                       />
                       <span className="text-sm text-muted-foreground">Active</span>
                     </div>
                   </div>
                 )}
                 
                  
                   {/* CSV Import Section - only show for existing accounts */}
                   {editingAccount && (
                    <div className="pt-4 border-t space-y-4">
                      <div>
                        <h3 className="text-sm font-medium mb-3">CSV Import</h3>
                        <CsvImportSection 
                          accountId={editingAccount.id} 
                          compact={true}
                          onImportComplete={() => {
                            toast({
                              title: "Import complete",
                              description: "Trades have been imported to this account"
                            });
                          }}
                        />
                      </div>
                    </div>
                  )}
                  
                <div className="sticky bottom-0 bg-background pt-4 border-t mt-6">
                  <Button type="submit" className="w-full">
                    {editingAccount ? 'Update' : 'Create'} Account
                  </Button>
                </div>
              </form>
            </div>
            </DialogContent>
          </Dialog>
          )}
        </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No trading accounts yet</h3>
              <p className="text-muted-foreground mb-6">Choose how you'd like to add your first trading account</p>
              {hasExceededLimit ? (
                <PremiumFeature
                  feature="Multiple Trading Accounts"
                  description="Upgrade to premium to track unlimited trading accounts."
                />
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
                  <Button 
                    onClick={() => setDialogOpen(true)}
                    className="w-full sm:w-auto"
                    size="lg"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Manual Account
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {accounts.map((account) => {
            const currentEquity = accountEquities[account.id] || account.initial_balance;
            
            return (
              <div key={account.id} className="space-y-4">
                <Card className={!account.is_active ? 'opacity-60' : ''}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-medium">{account.name}</CardTitle>
                    <div className="flex items-center space-x-2">
                      {account.is_active && !account.max_drawdown_reached && <Badge variant="default">Active</Badge>}
                      {account.max_drawdown_reached && <Badge variant="destructive">Breached</Badge>}
                      {!isPremium && accounts.length >= BASIC_ACCOUNT_LIMIT && (
                        <Badge variant="outline" className="text-xs">
                          Limit Reached
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Badge variant={account.account_type === 'live' ? 'default' : 'secondary'}>
                        {account.account_type.toUpperCase()}
                      </Badge>
                      {account.broker && (
                        <Badge variant="outline">
                          {account.broker}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Initial Balance</span>
                        <span className="font-medium">{formatCurrency(account.initial_balance, account.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Current Equity</span>
                        <span className="font-medium">{formatCurrency(currentEquity, account.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">P&L</span>
                        <span className={`font-medium ${currentEquity - account.initial_balance >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatCurrency(currentEquity - account.initial_balance, account.currency)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 pt-2 border-t">
                      <Button 
                        variant="outline" 
                        onClick={() => navigate(`/account-performance/${account.id}`)}
                        size="sm"
                        className="w-full"
                      >
                        Account Performance
                      </Button>
                       <div className="grid grid-cols-2 gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEdit(account)} 
                          title="Edit Account"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteClick(account)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Drawdown Monitor Hook - only for prop firms */}
                {account.account_type === 'prop firm' && (
                  <DrawdownMonitor 
                    account={account}
                    currentEquity={currentEquity}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Trading Account"
        description={`Are you sure you want to delete "${accountToDelete?.name}"? This action will remove the account and all associated data.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        variant="destructive"
      />


      </div>
    </DashboardLayout>
  );
};

export default TradingAccounts;