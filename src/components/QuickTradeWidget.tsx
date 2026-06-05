import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { Plus, TrendingUp, TrendingDown, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';


interface TradingAccount {
  id: string;
  name: string;
  currency: string;
}

export function QuickTradeWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [formData, setFormData] = useState({
    trading_account_id: '',
    symbol: '',
    trade_type: '',
    entry_price: '',
    quantity: '',
    stop_loss: '',
    take_profit: '',
    exit_price: '',
    pnl: '',
    notes: ''
  });

  useEffect(() => {
    if (user) {
      fetchAccounts();
    }
  }, [user]);

  const fetchAccounts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('id, name, currency')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      setAccounts(data || []);
      
      // Auto-select first account if only one exists
      if (data && data.length === 1) {
        setFormData(prev => ({ ...prev, trading_account_id: data[0].id }));
      }
    } catch (error) {
      logger.apiError('QuickTradeWidget - fetching accounts', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.trading_account_id || !formData.symbol || !formData.trade_type || 
        !formData.entry_price || !formData.quantity || !formData.notes.trim()) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields including notes",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Use the create-trade edge function
      const { data: authData } = await supabase.auth.getSession();
      
      if (!authData.session) {
        throw new Error('Not authenticated');
      }

      const tradeData = {
        trading_account_id: formData.trading_account_id,
        symbol: formData.symbol.toUpperCase(),
        trade_type: formData.trade_type,
        entry_price: parseFloat(formData.entry_price),
        quantity: parseFloat(formData.quantity),
        ...(formData.stop_loss && { stop_loss: parseFloat(formData.stop_loss) }),
        ...(formData.take_profit && { take_profit: parseFloat(formData.take_profit) }),
        ...(formData.exit_price && { exit_price: parseFloat(formData.exit_price) }),
        ...(formData.pnl && { pnl: parseFloat(formData.pnl) }),
        entry_date: entryDate.toISOString(),
        status: formData.exit_price ? 'closed' : 'open',
        ...(formData.exit_price && { exit_date: entryDate.toISOString() }),
        notes: formData.notes
      };

      const response = await fetch(`https://dynibyqrcbxneiwjyahn.supabase.co/functions/v1/create-trade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify(tradeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create trade');
      }

      toast({
        title: "Trade created successfully",
        description: `${formData.trade_type.toUpperCase()} ${formData.symbol} trade has been added`,
      });

      // Reset form
      setFormData({
        trading_account_id: accounts.length === 1 ? accounts[0].id : '',
        symbol: '',
        trade_type: '',
        entry_price: '',
        quantity: '',
        stop_loss: '',
        take_profit: '',
        exit_price: '',
        pnl: '',
        notes: ''
      });
      setEntryDate(new Date());

      // Trigger a page refresh to update dashboard data
      window.location.reload();

    } catch (error) {
      logger.apiError('QuickTradeWidget - creating trade', error);
      toast({
        title: "Error creating trade",
        description: error instanceof Error ? error.message : "Failed to create trade",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="quick-trade-widget">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5" />
            Quick Add Trade
          </CardTitle>
        </CardHeader>
        <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="account">Account</Label>
              <Select 
                value={formData.trading_account_id} 
                onValueChange={(value) => handleInputChange('trading_account_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                value={formData.symbol}
                onChange={(e) => handleInputChange('symbol', e.target.value)}
                placeholder="e.g. EURUSD"
                className="uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="direction">Direction</Label>
              <Select 
                value={formData.trade_type} 
                onValueChange={(value) => handleInputChange('trade_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Buy/Sell" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-profit" />
                      Buy
                    </div>
                  </SelectItem>
                  <SelectItem value="short">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-loss" />
                      Sell
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => handleInputChange('quantity', e.target.value)}
                placeholder="Lot size"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="entry_price">Entry Price</Label>
              <Input
                id="entry_price"
                type="number"
                step="0.00001"
                value={formData.entry_price}
                onChange={(e) => handleInputChange('entry_price', e.target.value)}
                placeholder="Entry price"
              />
            </div>
            
            <div>
              <Label htmlFor="entry_date">Entry Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !entryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {entryDate ? format(entryDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={entryDate}
                    onSelect={(date) => date && setEntryDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="exit_price">Exit Price (Optional)</Label>
              <Input
                id="exit_price"
                type="number"
                step="0.00001"
                value={formData.exit_price}
                onChange={(e) => handleInputChange('exit_price', e.target.value)}
                placeholder="Exit price"
              />
            </div>
            
            <div>
              <Label htmlFor="pnl">P&L (Optional)</Label>
              <Input
                id="pnl"
                type="number"
                step="0.01"
                value={formData.pnl}
                onChange={(e) => handleInputChange('pnl', e.target.value)}
                placeholder="Profit/Loss amount"
                className={formData.pnl && parseFloat(formData.pnl) >= 0 ? 'text-profit' : formData.pnl && parseFloat(formData.pnl) < 0 ? 'text-loss' : ''}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="stop_loss">Stop Loss (Optional)</Label>
              <Input
                id="stop_loss"
                type="number"
                step="0.00001"
                value={formData.stop_loss}
                onChange={(e) => handleInputChange('stop_loss', e.target.value)}
                placeholder="Stop loss price"
              />
            </div>
            
            <div>
              <Label htmlFor="take_profit">Take Profit (Optional)</Label>
              <Input
                id="take_profit"
                type="number"
                step="0.00001"
                value={formData.take_profit}
                onChange={(e) => handleInputChange('take_profit', e.target.value)}
                placeholder="Take profit price"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Trade notes, setup, reasoning..."
              rows={3}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Creating...' : 'Add Trade'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}