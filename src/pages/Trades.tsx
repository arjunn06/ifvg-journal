import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, TrendingUp, TrendingDown, ImageIcon, Eye, X, Copy, MoreHorizontal, Grid3X3, List, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumFeature, UpgradePrompt } from '@/components/PremiumFeature';
import { TradeCard } from '@/components/TradeCard';
import { TradeFilters, type TradeFilters as TradeFiltersType } from '@/components/TradeFilters';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useUndoToast } from '@/components/UndoToast';
import { CopyTradeDialog } from '@/components/CopyTradeDialog';
import { CustomizableCsvExport } from '@/components/CustomizableCsvExport';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingTable, LoadingCard } from '@/components/ui/loading-spinner';

interface Trade {
  id: string;
  symbol: string;
  trade_type: string;
  entry_price: number;
  exit_price?: number;
  quantity: number;
  status: string;
  pnl?: number;
  entry_date: string;
  exit_date?: string;
  notes?: string;
  screenshots?: string[];
  trading_account_id: string;
  strategy_id?: string;
  stop_loss?: number;
  take_profit?: number;
  commission?: number;
  swap?: number;
  risk_amount?: number;
  trading_accounts: {
    name: string;
    currency: string;
  };
  strategies?: {
    name: string;
  };
}

const Trades = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isPremium } = useSubscription();
  const { showUndoToast } = useUndoToast();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradingAccounts, setTradingAccounts] = useState<{ id: string; name: string; }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [screenshotDialog, setScreenshotDialog] = useState(false);
  const [selectedScreenshots, setSelectedScreenshots] = useState<string[]>([]);
  const [filters, setFilters] = useState<TradeFiltersType>({
    searchTerm: '',
    tradeType: '',
    status: '',
    accountId: '',
    sortBy: 'entry_date',
    sortDirection: 'desc'
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    tradeId: string;
    tradeName: string;
  }>({ open: false, tradeId: '', tradeName: '' });
  const [recentlyDeleted, setRecentlyDeleted] = useState<Trade | null>(null);
  const [closeFormData, setCloseFormData] = useState({
    exit_price: '',
    exit_date: '',
    pnl: '',
    commission: '',
    swap: '',
    partial_quantity: '',
    is_partial: false
  });
  const [partialExits, setPartialExits] = useState<Array<{
    id: string;
    exit_price: string;
    exit_date: string;
    pnl: string;
    commission: string;
    swap: string;
    partial_quantity: string;
  }>>([]);
  const [closeType, setCloseType] = useState<'full' | 'partial'>('full');
  const [copyTradeDialog, setCopyTradeDialog] = useState(false);
  const [tradeToCopy, setTradeToCopy] = useState<Trade | null>(null);

  // Premium limits for basic users
  const BASIC_TRADE_LIMIT = 50;

  useEffect(() => {
    if (user) {
      fetchTrades();
      fetchTradingAccounts();
    }
  }, [user]);

  const fetchTrades = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('trades')
        .select(`
          *,
          trading_accounts(name, currency),
          strategies(name)
        `)
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });

      if (error) throw error;
      setTrades(data || []);
    } catch (error) {
      console.error('Error fetching trades:', error);
      toast({
        title: "Error",
        description: "Failed to fetch trades",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTradingAccounts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setTradingAccounts(data || []);
    } catch (error) {
      console.error('Error fetching trading accounts:', error);
    }
  };

  const handleCloseTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrade) return;

    try {
      if (closeType === 'full') {
        // Full close - update the original trade
        const updateData = {
          status: 'closed',
          exit_price: parseFloat(closeFormData.exit_price),
          exit_date: new Date(closeFormData.exit_date).toISOString(),
          pnl: parseFloat(closeFormData.pnl),
          commission: closeFormData.commission ? parseFloat(closeFormData.commission) : 0,
          swap: closeFormData.swap ? parseFloat(closeFormData.swap) : 0
        };

        const { error } = await supabase
          .from('trades')
          .update(updateData)
          .eq('id', editingTrade.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Trade closed successfully"
        });
      } else {
        // Partial close - create new trade entries and update original
        const partialQty = parseFloat(closeFormData.partial_quantity);
        const remainingQty = editingTrade.quantity - partialQty;

        if (partialQty <= 0 || partialQty >= editingTrade.quantity) {
          throw new Error('Partial quantity must be between 0 and current quantity');
        }

        // Create closed partial trade
        const partialTradeData = {
          symbol: editingTrade.symbol,
          trade_type: editingTrade.trade_type,
          entry_price: editingTrade.entry_price,
          exit_price: parseFloat(closeFormData.exit_price),
          quantity: partialQty,
          status: 'closed',
          entry_date: editingTrade.entry_date,
          exit_date: new Date(closeFormData.exit_date).toISOString(),
          pnl: parseFloat(closeFormData.pnl),
          commission: closeFormData.commission ? parseFloat(closeFormData.commission) : 0,
          swap: closeFormData.swap ? parseFloat(closeFormData.swap) : 0,
          notes: `Partial close from trade ${editingTrade.symbol}`,
          user_id: user?.id,
          trading_account_id: editingTrade.trading_account_id,
          strategy_id: editingTrade.strategy_id,
          stop_loss: editingTrade.stop_loss,
          take_profit: editingTrade.take_profit,
          source: 'partial_close'
        };

        // Update original trade with remaining quantity
        const updateData = {
          quantity: remainingQty,
          notes: editingTrade.notes ? 
            `${editingTrade.notes} | Partial close: ${partialQty} units` : 
            `Partial close: ${partialQty} units`
        };

        const { error: insertError } = await supabase
          .from('trades')
          .insert([partialTradeData]);

        if (insertError) throw insertError;

        const { error: updateError } = await supabase
          .from('trades')
          .update(updateData)
          .eq('id', editingTrade.id);

        if (updateError) throw updateError;

        toast({
          title: "Success",
          description: `Partial close completed. ${partialQty} units closed, ${remainingQty} units remaining open.`
        });
      }

      setDialogOpen(false);
      setEditingTrade(null);
      fetchTrades();
    } catch (error) {
      console.error('Error closing trade:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to close trade",
        variant: "destructive"
      });
    }
  };

  const addPartialExit = () => {
    const newExit = {
      id: Date.now().toString(),
      exit_price: '',
      exit_date: new Date().toISOString().split('T')[0],
      pnl: '',
      commission: '',
      swap: '',
      partial_quantity: ''
    };
    setPartialExits([...partialExits, newExit]);
  };

  const removePartialExit = (id: string) => {
    setPartialExits(partialExits.filter(exit => exit.id !== id));
  };

  const updatePartialExit = (id: string, field: string, value: string) => {
    setPartialExits(partialExits.map(exit => 
      exit.id === id ? { ...exit, [field]: value } : exit
    ));
  };

  const setPercentageQuantity = (percentage: number) => {
    if (!editingTrade) return;
    const qty = (editingTrade.quantity * (percentage / 100)).toFixed(4);
    setCloseFormData({ ...closeFormData, partial_quantity: qty });
  };

  const handleDeleteTrade = async (id: string) => {
    const tradeToDelete = trades.find(t => t.id === id);
    if (!tradeToDelete) return;

    try {
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setRecentlyDeleted(tradeToDelete);
      setTrades(prev => prev.filter(t => t.id !== id));

      showUndoToast({
        message: `Deleted trade ${tradeToDelete.symbol}`,
        onUndo: () => handleUndoDelete(tradeToDelete)
      });

    } catch (error) {
      console.error('Error deleting trade:', error);
      toast({
        title: "Error",
        description: "Failed to delete trade",
        variant: "destructive"
      });
    }
  };

  const handleUndoDelete = async (trade: Trade) => {
    try {
      // Create a clean trade object without the nested trading_accounts and strategies
      const cleanTradeData = {
        symbol: trade.symbol,
        trade_type: trade.trade_type,
        entry_price: trade.entry_price,
        exit_price: trade.exit_price,
        quantity: trade.quantity,
        status: trade.status,
        pnl: trade.pnl,
        entry_date: trade.entry_date,
        exit_date: trade.exit_date,
        notes: trade.notes,
        screenshots: trade.screenshots,
        user_id: user?.id,
        trading_account_id: trade.trading_account_id,
        strategy_id: trade.strategy_id,
        stop_loss: trade.stop_loss,
        take_profit: trade.take_profit,
        commission: trade.commission,
        swap: trade.swap,
        risk_amount: trade.risk_amount
      };

      const { error } = await supabase
        .from('trades')
        .insert([cleanTradeData]);

      if (error) throw error;

      // Refresh trades to get the proper data structure
      fetchTrades();
      setRecentlyDeleted(null);

      toast({
        title: "Success",
        description: "Trade restored successfully"
      });
    } catch (error) {
      console.error('Error restoring trade:', error);
      toast({
        title: "Error",
        description: "Failed to restore trade. Please recreate the trade manually.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteConfirm = (id: string, symbol: string) => {
    setConfirmDialog({
      open: true,
      tradeId: id,
      tradeName: symbol
    });
  };

  const handleCopyTrade = (tradeId: string) => {
    const tradeToCopy = trades.find(t => t.id === tradeId);
    if (!tradeToCopy) return;
    
    setTradeToCopy(tradeToCopy);
    setCopyTradeDialog(true);
  };

  const handleCopySuccess = () => {
    fetchTrades();
  };

  const openCloseDialog = (trade: Trade) => {
    setEditingTrade(trade);
    setCloseFormData({
      exit_price: '',
      exit_date: new Date().toISOString().split('T')[0],
      pnl: '',
      commission: '0',
      swap: '0',
      partial_quantity: '',
      is_partial: false
    });
    setCloseType('full');
    setPartialExits([]);
    setDialogOpen(true);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getTradeOutcome = (trade: Trade) => {
    if (trade.status === 'open') return 'Open';
    if (!trade.pnl) return 'Break Even';
    
    if (trade.pnl > 0) {
      if (trade.exit_price === trade.take_profit) return 'Take Profit';
      return 'Partial Profit';
    } else {
      if (trade.exit_price === trade.stop_loss) return 'Stop Loss';
      return 'Loss';
    }
  };

  const getOutcomeColor = (trade: Trade) => {
    if (trade.status === 'open') return 'text-muted-foreground';
    if (!trade.pnl) return 'text-muted-foreground';
    return trade.pnl > 0 ? 'text-profit' : 'text-loss';
  };

  const openScreenshotDialog = (screenshots: string[]) => {
    setSelectedScreenshots(screenshots);
    setScreenshotDialog(true);
  };

  const handleRowClick = (tradeId: string) => {
    navigate(`/trades/${tradeId}`);
  };

  // Filter and sort trades
  const filteredAndSortedTrades = useMemo(() => {
    let filtered = trades.filter(trade => {
      // Search term filter (matches symbol, trade type, status)
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSymbol = trade.symbol.toLowerCase().includes(searchLower);
        const matchesType = trade.trade_type.toLowerCase().includes(searchLower);
        const matchesStatus = trade.status.toLowerCase().includes(searchLower);
        if (!matchesSymbol && !matchesType && !matchesStatus) {
          return false;
        }
      }

      // Account filter
      if (filters.accountId && trade.trading_account_id !== filters.accountId) {
        return false;
      }

      // Status filter
      if (filters.status && trade.status !== filters.status) {
        return false;
      }

      // Trade type filter
      if (filters.tradeType && trade.trade_type !== filters.tradeType) {
        return false;
      }
      
      return true;
    });

    // Sort trades by entry date (newest first)
    filtered.sort((a, b) => {
      const aValue = new Date(a.entry_date);
      const bValue = new Date(b.entry_date);
      return bValue.getTime() - aValue.getTime();
    });

    return filtered;
  }, [trades, filters]);

  // Get unique symbols for filter dropdown
  const symbolOptions = useMemo(() => {
    return Array.from(new Set(trades.map(trade => trade.symbol))).sort();
  }, [trades]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-64 animate-pulse"></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
              <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
            </div>
          </div>
          
          {/* Filters Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-10 bg-muted rounded animate-pulse"></div>
            <div className="h-10 bg-muted rounded animate-pulse"></div>
            <div className="h-10 bg-muted rounded animate-pulse"></div>
            <div className="h-10 bg-muted rounded animate-pulse"></div>
          </div>
          
          {/* Table Skeleton */}
          <Card>
            <CardHeader>
              <div className="h-6 bg-muted rounded w-32 animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <LoadingTable rows={8} cols={7} />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Check if basic user has exceeded trade limit
  const hasExceededLimit = !isPremium && trades.length >= BASIC_TRADE_LIMIT;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Trade History</h1>
            <p className="text-muted-foreground">View and manage your trading history</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Export Button - Show only when there are trades */}
            {trades.length > 0 && (
              <PremiumFeature
                feature="CSV Export"
                description="Export your trades to CSV with customizable fields"
                showUpgrade={false}
                fallback={
                  <Button variant="outline" disabled>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                }
              >
                <CustomizableCsvExport 
                  accountId={filters.accountId || 'all'} 
                  accountName={filters.accountId ? 
                    tradingAccounts.find(acc => acc.id === filters.accountId)?.name || 'Selected Account' : 
                    'All Accounts'
                  }
                />
              </PremiumFeature>
            )}
            
            {/* View Toggle */}
            <div className="flex items-center border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 px-3"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 px-3"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            
            {hasExceededLimit ? (
              <PremiumFeature
                feature="Unlimited Trades"
                description="You've reached the 50 trade limit for basic users. Upgrade to premium for unlimited trade tracking."
                showUpgrade={false}
                fallback={
                  <Button disabled variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Upgrade for More Trades
                  </Button>
                }
              />
            ) : (
              <Button onClick={() => navigate('/trades/new')}>
                <Plus className="h-4 w-4 mr-2" />
                New Trade
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        {trades.length > 0 && (
          <TradeFilters
            onFiltersChange={setFilters}
            symbolOptions={symbolOptions}
            accountOptions={tradingAccounts}
          />
        )}

        {trades.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No trades yet</h3>
                <p className="text-muted-foreground mb-4">Start by creating your first trade</p>
                {hasExceededLimit ? (
                  <PremiumFeature
                    feature="Unlimited Trades"
                    description="Upgrade to premium for unlimited trade tracking and advanced features."
                  />
                ) : (
                  <Button onClick={() => navigate('/trades/new')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Trade
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : filteredAndSortedTrades.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No trades match your filters</h3>
                <p className="text-muted-foreground mb-4">Try adjusting your filter criteria</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAndSortedTrades.map((trade, index) => (
                  <Card 
                    key={trade.id} 
                    className="group relative cursor-pointer hover:shadow-xl transition-all duration-300 ring-1 ring-border hover:ring-accent"
                    onClick={() => navigate(`/trades/${trade.id}`)}
                  >
                    {/* Hover actions */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyTrade(trade.id);
                        }}
                        aria-label="Duplicate trade"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConfirm(trade.id, trade.symbol);
                        }}
                        aria-label="Delete trade"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="text-sm text-muted-foreground">
                          Trade #{String(index + 1).padStart(2, '0')}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg group-hover:underline decoration-primary/40 decoration-2 underline-offset-4 transition-[text-decoration-color]">{trade.symbol}</span>
                          <Badge 
                            variant={trade.trade_type === 'long' ? 'default' : 'secondary'}
                            className={`text-xs ${
                              trade.trade_type === 'long' 
                                ? 'bg-profit/10 text-profit border-profit/20' 
                                : 'bg-loss/10 text-loss border-loss/20'
                            }`}
                          >
                            {trade.trade_type === 'long' ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          {getTradeOutcome(trade)}
                        </div>
                        
                        <div className={`text-xl font-bold ${getOutcomeColor(trade)}`}>
                          {trade.status === 'open' 
                            ? 'Open'
                            : trade.pnl 
                              ? formatCurrency(trade.pnl, trade.trading_accounts?.currency)
                              : 'Break Even'
                          }
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Mobile View - Cards (when in list mode) */}
            {viewMode === 'list' && (
              <div className="block lg:hidden space-y-4">
                {filteredAndSortedTrades.map((trade) => (
                  <TradeCard
                    key={trade.id}
                    trade={trade}
                    onClose={openCloseDialog}
                    onDelete={(id) => handleDeleteConfirm(id, trade.symbol)}
                    onDuplicate={() => handleCopyTrade(trade.id)}
                    onViewScreenshots={openScreenshotDialog}
                  />
                ))}
              </div>
            )}

            {/* Desktop View - Table (when in list mode) */}
            {viewMode === 'list' && (
            <Card className="hidden lg:block">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  All Trades
                  {!isPremium && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{trades.length}/{BASIC_TRADE_LIMIT} trades used</span>
                      {trades.length >= BASIC_TRADE_LIMIT * 0.8 && (
                        <Button size="sm" variant="outline" onClick={() => navigate('/')}>
                          Upgrade
                        </Button>
                      )}
                    </div>
                  )}
                </CardTitle>
                <CardDescription>
                  {filteredAndSortedTrades.length === trades.length 
                    ? `${trades.length} trades total`
                    : `${filteredAndSortedTrades.length} of ${trades.length} trades shown`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>Exit</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>P&L</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Charts</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedTrades.map((trade) => (
                      <TableRow 
                        key={trade.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleRowClick(trade.id)}
                      >
                        <TableCell className="font-medium">{trade.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={trade.trade_type === 'long' ? 'long' : 'short'}>
                            {trade.trade_type === 'long' ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {trade.trade_type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{trade.entry_price}</TableCell>
                        <TableCell>{trade.exit_price || '-'}</TableCell>
                        <TableCell>{trade.quantity}</TableCell>
                        <TableCell>
                          {trade.pnl ? (
                            <span className={trade.pnl >= 0 ? 'text-profit' : 'text-loss'}>
                              {formatCurrency(trade.pnl, trade.trading_accounts.currency)}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={trade.status === 'open' ? 'outline' : 'secondary'}
                          >
                            {trade.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {trade.screenshots && trade.screenshots.length > 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                openScreenshotDialog(trade.screenshots!);
                              }}
                            >
                              <ImageIcon className="h-4 w-4 mr-1" />
                              {trade.screenshots.length}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(trade.entry_date)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Dropdown trigger clicked for trade:', trade.id);
                                }}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="z-50 bg-popover">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                console.log('Navigating to trade details:', trade.id);
                                navigate(`/trades/${trade.id}`);
                              }}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleCopyTrade(trade.id);
                              }}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy to Account
                              </DropdownMenuItem>
                              {trade.status === 'open' && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  openCloseDialog(trade);
                                }}>
                                  <X className="h-4 w-4 mr-2" />
                                  Close Trade
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteConfirm(trade.id, trade.symbol);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Trade
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
            )}
          </>
        )}

        {/* Confirm Delete Dialog */}
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
          title="Delete Trade"
          description={`Are you sure you want to delete the ${confirmDialog.tradeName} trade? This action cannot be undone immediately, but you can undo it using the notification that will appear.`}
          confirmText="Delete"
          onConfirm={() => {
            handleDeleteTrade(confirmDialog.tradeId);
            setConfirmDialog({ open: false, tradeId: '', tradeName: '' });
          }}
          variant="destructive"
        />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Close Trade</DialogTitle>
            <DialogDescription>
              Enter the exit details for {editingTrade?.symbol} - Current Quantity: {editingTrade?.quantity}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCloseTrade} className="space-y-4">
            {/* Close Type Selection */}
            <div className="space-y-2">
              <Label>Close Type</Label>
              <Select value={closeType} onValueChange={(value: 'full' | 'partial') => setCloseType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Close</SelectItem>
                  <SelectItem value="partial">Partial Close</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Partial Quantity with Percentage Suggestions */}
            {closeType === 'partial' && (
              <div className="space-y-2">
                <Label htmlFor="partial_quantity">Partial Quantity</Label>
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPercentageQuantity(25)}
                  >
                    25%
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPercentageQuantity(30)}
                  >
                    30%
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPercentageQuantity(50)}
                  >
                    50%
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPercentageQuantity(75)}
                  >
                    75%
                  </Button>
                </div>
                <Input
                  id="partial_quantity"
                  type="number"
                  step="any"
                  placeholder="Enter quantity to close"
                  value={closeFormData.partial_quantity}
                  onChange={(e) => setCloseFormData({ ...closeFormData, partial_quantity: e.target.value })}
                  required={closeType === 'partial'}
                />
                <p className="text-xs text-muted-foreground">
                  Max: {editingTrade?.quantity} units. Remaining after close: {
                    editingTrade && closeFormData.partial_quantity ? 
                    (editingTrade.quantity - parseFloat(closeFormData.partial_quantity || '0')).toFixed(4) :
                    editingTrade?.quantity
                  } units
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="exit_price">Exit Price</Label>
              <Input
                id="exit_price"
                type="number"
                step="any"
                value={closeFormData.exit_price}
                onChange={(e) => setCloseFormData({ ...closeFormData, exit_price: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="exit_date">Exit Date</Label>
              <Input
                id="exit_date"
                type="date"
                value={closeFormData.exit_date}
                onChange={(e) => setCloseFormData({ ...closeFormData, exit_date: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="pnl">P&L {closeType === 'partial' ? '(for this partial close only)' : ''}</Label>
              <Input
                id="pnl"
                type="number"
                step="0.01"
                value={closeFormData.pnl}
                onChange={(e) => setCloseFormData({ ...closeFormData, pnl: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="commission">Commission</Label>
                <Input
                  id="commission"
                  type="number"
                  step="0.01"
                  value={closeFormData.commission}
                  onChange={(e) => setCloseFormData({ ...closeFormData, commission: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="swap">Swap</Label>
                <Input
                  id="swap"
                  type="number"
                  step="0.01"
                  value={closeFormData.swap}
                  onChange={(e) => setCloseFormData({ ...closeFormData, swap: e.target.value })}
                />
              </div>
            </div>

            {closeType === 'partial' && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> This will create a new closed trade record for the partial exit and keep the original trade open with the remaining quantity.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full">
              {closeType === 'full' ? 'Close Trade' : 'Execute Partial Close'}
            </Button>
          </form>
         </DialogContent>
       </Dialog>

       {/* Screenshot Gallery Dialog */}
       <Dialog open={screenshotDialog} onOpenChange={setScreenshotDialog}>
         <DialogContent className="max-w-4xl">
           <DialogHeader>
             <DialogTitle>Chart Screenshots</DialogTitle>
             <DialogDescription>
               View trading chart screenshots for this trade
             </DialogDescription>
           </DialogHeader>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
             {selectedScreenshots.map((screenshot, index) => (
               <div key={index} className="relative group">
                 <img
                   src={screenshot}
                   alt={`Screenshot ${index + 1}`}
                   className="w-full h-auto rounded-lg border"
                 />
                 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Button
                     size="sm"
                     variant="secondary"
                     asChild
                   >
                     <a href={screenshot} target="_blank" rel="noopener noreferrer">
                       <Eye className="h-4 w-4" />
                     </a>
                   </Button>
                 </div>
               </div>
             ))}
           </div>
          </DialogContent>
        </Dialog>

        {/* Copy Trade Dialog */}
        <CopyTradeDialog
          open={copyTradeDialog}
          onOpenChange={(open) => {
            console.log('Copy dialog open change:', open);
            setCopyTradeDialog(open);
            if (!open) {
              setTradeToCopy(null);
            }
          }}
          trade={tradeToCopy}
          onCopySuccess={handleCopySuccess}
        />
      </div>
    </DashboardLayout>
  );
};

export default Trades;