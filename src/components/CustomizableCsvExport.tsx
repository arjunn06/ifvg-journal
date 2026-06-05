import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, FileSpreadsheet, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface CustomizableCsvExportProps {
  accountId?: string;
  accountName?: string;
}

interface TradingAccount {
  id: string;
  name: string;
  is_active: boolean;
}

interface TimeRange {
  label: string;
  value: string;
  days?: number;
}

interface FieldOption {
  key: string;
  label: string;
  required?: boolean;
}

const AVAILABLE_FIELDS: FieldOption[] = [
  { key: 'symbol', label: 'Symbol', required: true },
  { key: 'trade_type', label: 'Trade Type', required: true },
  { key: 'entry_price', label: 'Entry Price', required: true },
  { key: 'exit_price', label: 'Exit Price' },
  { key: 'quantity', label: 'Quantity', required: true },
  { key: 'entry_date', label: 'Entry Date', required: true },
  { key: 'exit_date', label: 'Exit Date' },
  { key: 'stop_loss', label: 'Stop Loss' },
  { key: 'take_profit', label: 'Take Profit' },
  { key: 'pnl', label: 'PnL' },
  { key: 'status', label: 'Status' },
  { key: 'commission', label: 'Commission' },
  { key: 'swap', label: 'Swap' },
  { key: 'risk_amount', label: 'Risk Amount' },
  { key: 'risk_reward_ratio', label: 'Risk Reward Ratio' },
  { key: 'notes', label: 'Notes' },
  { key: 'emotions', label: 'Emotions' },
  { key: 'order_type', label: 'Order Type' },
  { key: 'order_id', label: 'Order ID' },
  { key: 'position_id', label: 'Position ID' },
  { key: 'confluence_score', label: 'Confluence Score' },
  { key: 'created_at', label: 'Created At' },
  { key: 'updated_at', label: 'Updated At' }
];

const TIME_RANGES: TimeRange[] = [
  { label: 'Last 7 days', value: '7days', days: 7 },
  { label: 'Last 30 days', value: '30days', days: 30 },
  { label: 'Last 90 days', value: '90days', days: 90 },
  { label: 'All time', value: 'all' }
];

export function CustomizableCsvExport({ accountId, accountName }: CustomizableCsvExportProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    AVAILABLE_FIELDS.filter(field => field.required).map(field => field.key)
  );
  const [tradingAccounts, setTradingAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<string>('all');

  useEffect(() => {
    if (user) {
      fetchTradingAccounts();
    }
  }, [user]);

  useEffect(() => {
    // If single account prop is provided, pre-select it
    if (accountId && tradingAccounts.length > 0) {
      setSelectedAccounts([accountId]);
    }
  }, [accountId, tradingAccounts]);

  const fetchTradingAccounts = async () => {
    if (!user) return;
    
    try {
      const { data: accounts, error } = await supabase
        .from('trading_accounts')
        .select('id, name, is_active')
        .eq('user_id', user.id)
        .order('is_active', { ascending: false })
        .order('name');

      if (error) throw error;
      setTradingAccounts(accounts || []);
    } catch (error) {
      console.error('Error fetching trading accounts:', error);
    }
  };

  const handleAccountToggle = (accountId: string, checked: boolean) => {
    if (checked) {
      setSelectedAccounts(prev => [...prev, accountId]);
    } else {
      setSelectedAccounts(prev => prev.filter(id => id !== accountId));
    }
  };

  const selectAllAccounts = () => {
    setSelectedAccounts(tradingAccounts.map(acc => acc.id));
  };

  const selectActiveAccounts = () => {
    setSelectedAccounts(tradingAccounts.filter(acc => acc.is_active).map(acc => acc.id));
  };

  const handleFieldToggle = (fieldKey: string, checked: boolean) => {
    if (checked) {
      setSelectedFields(prev => [...prev, fieldKey]);
    } else {
      const field = AVAILABLE_FIELDS.find(f => f.key === fieldKey);
      if (!field?.required) {
        setSelectedFields(prev => prev.filter(key => key !== fieldKey));
      }
    }
  };

  const selectAllFields = () => {
    setSelectedFields(AVAILABLE_FIELDS.map(field => field.key));
  };

  const selectRequiredOnly = () => {
    setSelectedFields(AVAILABLE_FIELDS.filter(field => field.required).map(field => field.key));
  };

  const formatFieldValue = (trade: any, fieldKey: string): string => {
    const value = trade[fieldKey];
    
    switch (fieldKey) {
      case 'entry_date':
      case 'exit_date':
      case 'created_at':
      case 'updated_at':
        return value ? new Date(value).toISOString().split('T')[0] : '';
      case 'notes':
      case 'emotions':
        return value ? String(value).replace(/"/g, '""') : '';
      case 'pnl':
      case 'entry_price':
      case 'exit_price':
      case 'stop_loss':
      case 'take_profit':
      case 'quantity':
      case 'commission':
      case 'swap':
      case 'risk_amount':
      case 'risk_reward_ratio':
      case 'confluence_score':
        return value !== null && value !== undefined ? String(value) : '';
      default:
        return value ? String(value) : '';
    }
  };

  const handleExportCsv = async () => {
    if (!user || selectedFields.length === 0 || selectedAccounts.length === 0) return;
    
    setIsExporting(true);
    try {
      // Build query based on account selection
      let query = supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id);

      // Filter by selected accounts
      query = query.in('trading_account_id', selectedAccounts);

      // Apply time range filter
      if (timeRange !== 'all') {
        const timeRangeConfig = TIME_RANGES.find(tr => tr.value === timeRange);
        if (timeRangeConfig?.days) {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - timeRangeConfig.days);
          query = query.gte('entry_date', startDate.toISOString());
        }
      }

      const { data: trades, error } = await query.order('entry_date', { ascending: false });

      if (error) throw error;

      if (!trades || trades.length === 0) {
        toast({
          title: "No trades found",
          description: "No trades available for export with current filters.",
          variant: "destructive"
        });
        return;
      }

      // Create CSV headers based on selected fields
      const csvHeaders = selectedFields.map(fieldKey => 
        AVAILABLE_FIELDS.find(field => field.key === fieldKey)?.label || fieldKey
      );

      // Create CSV rows with only selected fields
      const csvRows = trades.map((trade) => 
        selectedFields.map(fieldKey => formatFieldValue(trade, fieldKey))
      );

      // Format CSV content
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(field => 
          typeof field === 'string' && (field.includes(',') || field.includes('"')) 
            ? `"${field}"` 
            : field
        ).join(','))
      ].join('\n');

      // Download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      const fileName = selectedAccounts.length === 1 
        ? `${tradingAccounts.find(acc => acc.id === selectedAccounts[0])?.name.replace(/[^a-z0-9]/gi, '_')}_trades_custom_${new Date().toISOString().split('T')[0]}.csv`
        : `all_accounts_trades_custom_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export successful",
        description: `Exported ${trades.length} trades with ${selectedFields.length} fields to CSV file.`
      });
      
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({
        title: "Export failed",
        description: "Failed to export trades to CSV.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Trades
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Customize CSV Export
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Account Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Select Accounts</Label>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={selectActiveAccounts}
                >
                  Active Only
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={selectAllAccounts}
                >
                  All Accounts
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
              {tradingAccounts.filter(acc => acc.is_active).map((account) => (
                <div key={account.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`account-${account.id}`}
                    checked={selectedAccounts.includes(account.id)}
                    onCheckedChange={(checked) => handleAccountToggle(account.id, checked as boolean)}
                  />
                  <Label htmlFor={`account-${account.id}`} className="text-sm flex items-center gap-2">
                    {account.name}
                    <Badge variant="secondary" className="text-xs">Active</Badge>
                  </Label>
                </div>
              ))}
              
              {tradingAccounts.filter(acc => !acc.is_active).length > 0 && (
                <>
                  <div className="text-xs text-muted-foreground mt-2 mb-1">Inactive Accounts</div>
                  {tradingAccounts.filter(acc => !acc.is_active).map((account) => (
                    <div key={account.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`account-${account.id}`}
                        checked={selectedAccounts.includes(account.id)}
                        onCheckedChange={(checked) => handleAccountToggle(account.id, checked as boolean)}
                      />
                      <Label htmlFor={`account-${account.id}`} className="text-sm flex items-center gap-2 text-muted-foreground">
                        {account.name}
                        <Badge variant="outline" className="text-xs">Inactive</Badge>
                      </Label>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Time Range Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Time Range</Label>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger>
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Field Selection */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={selectAllFields}
            >
              Select All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={selectRequiredOnly}
            >
              Required Only
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {AVAILABLE_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center space-x-2">
                <Checkbox
                  id={field.key}
                  checked={selectedFields.includes(field.key)}
                  onCheckedChange={(checked) => handleFieldToggle(field.key, checked as boolean)}
                  disabled={field.required}
                />
                <Label 
                  htmlFor={field.key} 
                  className={`text-sm ${field.required ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                >
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
              </div>
            ))}
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Export Summary:</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>{selectedAccounts.length} account(s) selected</p>
              <p>{selectedFields.length} fields selected for export</p>
              <p>Time range: {TIME_RANGES.find(tr => tr.value === timeRange)?.label}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              * Required fields cannot be deselected
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleExportCsv}
              disabled={isExporting || selectedFields.length === 0 || selectedAccounts.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}