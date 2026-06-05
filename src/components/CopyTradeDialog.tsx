import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Copy, Edit3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

interface Trade {
  id: string;
  symbol: string;
  trade_type: string;
  entry_price: number;
  exit_price?: number | null;
  quantity: number;
  status: string;
  pnl?: number | null;
  entry_date: string;
  exit_date?: string | null;
  notes?: string | null;
  screenshots?: string[] | null;
  trading_accounts?: { name: string; currency: string } | null;
  strategies?: { name: string } | null;
  trading_account_id: string;
  strategy_id?: string | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  risk_amount?: number | null;
  commission?: number | null;
  swap?: number | null;
}

interface TradingAccount {
  id: string;
  name: string;
  currency: string;
  current_balance?: number;
}

interface Strategy {
  id: string;
  name: string;
}

interface CopyTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade | null;
  onCopySuccess: () => void;
}

export function CopyTradeDialog({ open, onOpenChange, trade, onCopySuccess }: CopyTradeDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tradingAccounts, setTradingAccounts] = useState<TradingAccount[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copyData, setCopyData] = useState({
    trading_account_id: '',
    quantity: '',
    risk_amount: '',
    stop_loss: '',
    take_profit: '',
    strategy_id: '',
    notes: '',
    copy_exit_details: false,
    entry_price: '',
    entry_date: '',
    exit_price: '',
    exit_date: '',
    pnl: '',
    commission: '',
    swap: ''
   });

   // Auto-calculate PnL when relevant fields change
   useEffect(() => {
     const calculatePnL = () => {
       const entryPrice = parseFloat(copyData.entry_price);
       const exitPrice = parseFloat(copyData.exit_price);
       const quantity = parseFloat(copyData.quantity);
       const commission = parseFloat(copyData.commission) || 0;
       const swap = parseFloat(copyData.swap) || 0;

       if (entryPrice && exitPrice && quantity && trade?.trade_type) {
         let grossPnL = 0;
         
         if (trade.trade_type.toLowerCase() === 'buy') {
           grossPnL = (exitPrice - entryPrice) * quantity;
         } else if (trade.trade_type.toLowerCase() === 'sell') {
           grossPnL = (entryPrice - exitPrice) * quantity;
         }

         // Calculate net PnL including commission and swap
         const netPnL = grossPnL - commission - swap;

         // Only update if the calculated value is different from current
         if (Math.abs(netPnL - parseFloat(copyData.pnl || '0')) > 0.001) {
           setCopyData(prev => ({
             ...prev,
             pnl: netPnL.toFixed(2)
           }));
         }
       }
     };

     // Only calculate if we have exit price and copying exit details
     if (copyData.copy_exit_details && copyData.exit_price) {
       calculatePnL();
     }
   }, [copyData.entry_price, copyData.exit_price, copyData.quantity, copyData.commission, copyData.swap, copyData.copy_exit_details, trade?.trade_type]);

   // Calculate lot size based on percentage of account balance
   const calculateLotSizeByPercentage = (percentage: number) => {
     const selectedAccount = tradingAccounts.find(acc => acc.id === copyData.trading_account_id);
     const entryPrice = parseFloat(copyData.entry_price);
     
     if (!selectedAccount || !entryPrice) {
       toast({
         title: "Cannot calculate lot size",
         description: "Please select an account and entry price first",
         variant: "destructive"
       });
       return;
     }

      // For copy dialog, use the actual account balance if available
      const accountBalance = selectedAccount.current_balance || 10000; // fallback to theoretical balance
      const riskAmount = (accountBalance * percentage) / 100;
      const suggestedLotSize = (riskAmount / entryPrice).toFixed(4);
     
     setCopyData({ ...copyData, quantity: suggestedLotSize });
     
      toast({
        title: "Lot size calculated",
        description: `${percentage}% of ${accountBalance} ${selectedAccount.currency} = ${suggestedLotSize} lots`,
      });
   };
  useEffect(() => {
    if (open && user) {
      fetchTradingAccounts();
      fetchStrategies();
      if (trade) {
        setCopyData({
          trading_account_id: '',
          quantity: trade.quantity.toString(),
          risk_amount: trade.risk_amount?.toString() || '',
          stop_loss: trade.stop_loss?.toString() || '',
          take_profit: trade.take_profit?.toString() || '',
          strategy_id: trade.strategy_id || '',
          notes: trade.notes ? `Copy of: ${trade.notes}` : 'Copied trade',
          copy_exit_details: false,
          entry_price: trade.entry_price.toString(),
          entry_date: new Date().toISOString().split('T')[0],
          exit_price: trade.exit_price?.toString() || '',
          exit_date: trade.exit_date ? new Date(trade.exit_date).toISOString().split('T')[0] : '',
          pnl: trade.pnl?.toString() || '',
          commission: trade.commission?.toString() || '',
          swap: trade.swap?.toString() || ''
        });
      }
    }
  }, [open, user, trade]);

  const fetchTradingAccounts = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('id, name, currency, current_balance')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      setTradingAccounts(data || []);
    } catch (error) {
      logger.apiError('CopyTradeDialog - fetching trading accounts', error);
    }
  };

  const fetchStrategies = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('strategies')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      setStrategies(data || []);
    } catch (error) {
      logger.apiError('CopyTradeDialog - fetching strategies', error);
    }
  };

  const handleCopy = async () => {
    if (!trade || !user || !copyData.trading_account_id) {
      toast({
        title: "Error",
        description: "Please select a trading account",
        variant: "destructive"
      });
      return;
    }

    try {
      const copyTradeData: any = {
        symbol: trade.symbol,
        trade_type: trade.trade_type,
        entry_price: parseFloat(copyData.entry_price),
        quantity: parseFloat(copyData.quantity),
        status: copyData.copy_exit_details && trade.status === 'closed' ? 'closed' : 'open',
        entry_date: new Date(copyData.entry_date).toISOString(),
        notes: copyData.notes,
        user_id: user.id,
        trading_account_id: copyData.trading_account_id,
        strategy_id: copyData.strategy_id || null,
        stop_loss: copyData.stop_loss ? parseFloat(copyData.stop_loss) : null,
        take_profit: copyData.take_profit ? parseFloat(copyData.take_profit) : null,
        risk_amount: copyData.risk_amount ? parseFloat(copyData.risk_amount) : null,
        source: 'copied'
      };

      // Include exit details if copying closed trade
      if (copyData.copy_exit_details && trade.status === 'closed') {
        copyTradeData.exit_price = copyData.exit_price ? parseFloat(copyData.exit_price) : trade.exit_price;
        copyTradeData.exit_date = copyData.exit_date ? new Date(copyData.exit_date).toISOString() : trade.exit_date;
        copyTradeData.pnl = copyData.pnl ? parseFloat(copyData.pnl) : trade.pnl;
        copyTradeData.commission = copyData.commission ? parseFloat(copyData.commission) : trade.commission;
        copyTradeData.swap = copyData.swap ? parseFloat(copyData.swap) : trade.swap;
      }

      const { error } = await supabase
        .from('trades')
        .insert([copyTradeData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Trade copied to ${tradingAccounts.find(acc => acc.id === copyData.trading_account_id)?.name} successfully`
      });

      onCopySuccess();
      onOpenChange(false);
    } catch (error) {
      logger.apiError('CopyTradeDialog - copying trade', error);
      toast({
        title: "Error",
        description: "Failed to copy trade",
        variant: "destructive"
      });
    }
  };

  const navigateToEditTrade = () => {
    if (!trade) return;
    // Use navigate instead of window.open to preserve screenshots
    window.location.href = `/new-trade?copy=${trade.id}`;
  };

  if (!trade) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy size={20} />
            Copy Trade to Another Account
          </DialogTitle>
          <DialogDescription>
            Copy {trade.symbol} trade with customizable parameters
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Trade Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Original Trade</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Symbol:</span> {trade.symbol}
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span> <Badge variant="outline">{trade.trade_type}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span> <Badge variant={trade.status === 'closed' ? 'default' : 'secondary'}>{trade.status}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Account:</span> {trade.trading_accounts?.name}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Copy Settings */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="target_account">Target Trading Account *</Label>
              <Select
                value={copyData.trading_account_id}
                onValueChange={(value) => setCopyData({ ...copyData, trading_account_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target account" />
                </SelectTrigger>
                <SelectContent>
                  {tradingAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                
                {/* Percentage buttons for quick lot size calculation */}
                <div className="flex gap-2 mb-2 mt-1">
                  <span className="text-xs text-muted-foreground self-center">Quick %:</span>
                  {[1, 2, 5, 10].map((percentage) => (
                    <Button
                      key={percentage}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => calculateLotSizeByPercentage(percentage)}
                      className="text-xs px-2 py-1 h-7"
                      disabled={!copyData.trading_account_id || !copyData.entry_price}
                    >
                      {percentage}%
                    </Button>
                  ))}
                </div>
                
                <Input
                  id="quantity"
                  type="number"
                  step="any"
                  value={copyData.quantity}
                  onChange={(e) => setCopyData({ ...copyData, quantity: e.target.value })}
                  required
                />
                {copyData.trading_account_id && copyData.entry_price && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Click percentage buttons to auto-calculate lot size
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="risk_amount">Risk Amount</Label>
                <Input
                  id="risk_amount"
                  type="number"
                  step="0.01"
                  value={copyData.risk_amount}
                  onChange={(e) => setCopyData({ ...copyData, risk_amount: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="entry_price">Entry Price</Label>
                <Input
                  id="entry_price"
                  type="number"
                  step="any"
                  value={copyData.entry_price}
                  onChange={(e) => setCopyData({ ...copyData, entry_price: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="entry_date">Entry Date</Label>
                <Input
                  id="entry_date"
                  type="date"
                  value={copyData.entry_date}
                  onChange={(e) => setCopyData({ ...copyData, entry_date: e.target.value })}
                />
              </div>
            </div>

            {trade.status === 'closed' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="copy_exit_details"
                    checked={copyData.copy_exit_details}
                    onCheckedChange={(checked) => setCopyData({ ...copyData, copy_exit_details: checked === true })}
                  />
                  <Label htmlFor="copy_exit_details" className="text-sm font-medium">
                    Copy exit details (create as closed trade)
                  </Label>
                </div>

                {/* Exit Details Section - More prominent placement */}
                {copyData.copy_exit_details && (
                  <Card className="p-4 bg-muted/30">
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-foreground">Exit Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="exit_price">Exit Price *</Label>
                          <Input
                            id="exit_price"
                            type="number"
                            step="any"
                            value={copyData.exit_price}
                            onChange={(e) => setCopyData({ ...copyData, exit_price: e.target.value })}
                            placeholder="Exit price"
                          />
                        </div>
                        <div>
                          <Label htmlFor="exit_date">Exit Date *</Label>
                          <Input
                            id="exit_date"
                            type="date"
                            value={copyData.exit_date}
                            onChange={(e) => setCopyData({ ...copyData, exit_date: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="pnl">P&L</Label>
                          <Input
                            id="pnl"
                            type="number"
                            step="0.01"
                            value={copyData.pnl}
                            onChange={(e) => setCopyData({ ...copyData, pnl: e.target.value })}
                            placeholder="Auto-calculated"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Auto-calculated based on prices
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="commission">Commission</Label>
                          <Input
                            id="commission"
                            type="number"
                            step="0.01"
                            value={copyData.commission}
                            onChange={(e) => setCopyData({ ...copyData, commission: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="swap">Swap</Label>
                          <Input
                            id="swap"
                            type="number"
                            step="0.01"
                            value={copyData.swap}
                            onChange={(e) => setCopyData({ ...copyData, swap: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}

            <Separator />

            {/* Advanced Options */}
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm"
              >
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
              </Button>
            </div>

            {showAdvanced && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="stop_loss">Stop Loss</Label>
                    <Input
                      id="stop_loss"
                      type="number"
                      step="any"
                      value={copyData.stop_loss}
                      onChange={(e) => setCopyData({ ...copyData, stop_loss: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="take_profit">Take Profit</Label>
                    <Input
                      id="take_profit"
                      type="number"
                      step="any"
                      value={copyData.take_profit}
                      onChange={(e) => setCopyData({ ...copyData, take_profit: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="strategy">Strategy</Label>
                  <Select
                    value={copyData.strategy_id}
                    onValueChange={(value) => setCopyData({ ...copyData, strategy_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select strategy (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No strategy</SelectItem>
                      {strategies.map((strategy) => (
                        <SelectItem key={strategy.id} value={strategy.id}>
                          {strategy.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={copyData.notes}
                    onChange={(e) => setCopyData({ ...copyData, notes: e.target.value })}
                    placeholder="Add notes for this copied trade"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button onClick={handleCopy} className="flex-1">
              <Copy size={16} className="mr-2" />
              Copy Trade
            </Button>
            <Button
              variant="outline"
              onClick={navigateToEditTrade}
              className="flex items-center gap-2"
            >
              <Edit3 size={16} />
              Edit Full Details
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}