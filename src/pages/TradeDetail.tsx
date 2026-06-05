import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, TrendingDown, ImageIcon, Edit, Trash2, Calendar, CheckSquare, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { LoadingCard } from '@/components/ui/loading-spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ShareableTradeCard } from '@/components/ShareableTradeCard';

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
  stop_loss?: number;
  take_profit?: number;
  commission?: number;
  swap?: number;
  risk_amount?: number;
  risk_reward_ratio?: number;
  trading_accounts: {
    name: string;
    currency: string;
  };
  strategies?: {
    name: string;
  };
}

interface ConfluenceItem {
  id: string;
  name: string;
  description: string;
  weight: number;
  category: string;
}

const TradeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [confluenceItems, setConfluenceItems] = useState<ConfluenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [screenshotDialog, setScreenshotDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  useEffect(() => {
    if (user && id) {
      fetchTrade();
      fetchTradeConfluence();
    }
  }, [user, id]);

  const fetchTrade = async () => {
    if (!user || !id) return;

    try {
      const { data, error } = await supabase
        .from('trades')
        .select(`
          *,
          trading_accounts(name, currency),
          strategies(name)
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setTrade(data);
    } catch (error) {
      console.error('Error fetching trade:', error);
      toast({
        title: "Error",
        description: "Failed to fetch trade details",
        variant: "destructive"
      });
      navigate('/trades');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchTradeConfluence = async () => {
    if (!user || !id) return;

    try {
      const { data: confluenceData, error: confluenceError } = await supabase
        .from('trade_confluence')
        .select(`
          confluence_item_id,
          is_present,
          confluence_items (
            id,
            name,
            description,
            weight,
            category
          )
        `)
        .eq('trade_id', id)
        .eq('is_present', true);

      if (confluenceError) throw confluenceError;

      const items = confluenceData?.map(item => item.confluence_items).filter(Boolean) || [];
      setConfluenceItems(items as ConfluenceItem[]);
    } catch (error) {
      console.error('Error fetching trade confluence:', error);
    }
  };

  const handleDelete = async () => {
    if (!trade) return;

    try {
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', trade.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Trade deleted successfully"
      });

      navigate('/trades');
    } catch (error) {
      console.error('Error deleting trade:', error);
      toast({
        title: "Error",
        description: "Failed to delete trade",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center gap-4">
            <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
            <div className="flex-1 space-y-2">
              <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
              <div className="flex gap-2">
                <div className="h-6 bg-muted rounded w-16 animate-pulse"></div>
                <div className="h-6 bg-muted rounded w-16 animate-pulse"></div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-10 bg-muted rounded w-20 animate-pulse"></div>
              <div className="h-10 bg-muted rounded w-24 animate-pulse"></div>
            </div>
          </div>
          
          {/* Trade Details Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingCard key={i} className="h-48" />
            ))}
          </div>
          
          {/* Notes and Confluence Skeleton */}
          <LoadingCard className="h-32" />
          <LoadingCard className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  if (!trade) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Trade not found</h2>
          <Button onClick={() => navigate('/trades')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Trades
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Mobile Header */}
        <div className="flex flex-col gap-4 lg:hidden">
          <Button variant="ghost" onClick={() => navigate('/trades')} className="self-start">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Trades
          </Button>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{trade.symbol}</h1>
              <Badge variant={trade.trade_type === 'long' ? 'default' : 'secondary'}>
                {trade.trade_type === 'long' ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {trade.trade_type.toUpperCase()}
              </Badge>
              <Badge 
                variant={trade.status === 'open' ? 'outline' : 'secondary'}
              >
                {trade.status}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(`/trades/edit/${trade.id}`)} className="flex-1">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="outline" onClick={() => setShowShareDialog(true)} className="flex-1">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="destructive" onClick={handleDelete} className="flex-1">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/trades')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Trades
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              {trade.symbol}
              <Badge variant={trade.trade_type === 'long' ? 'default' : 'secondary'}>
                {trade.trade_type === 'long' ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1" />
                )}
                {trade.trade_type.toUpperCase()}
              </Badge>
              <Badge 
                variant={trade.status === 'open' ? 'outline' : 'secondary'}
              >
                {trade.status}
              </Badge>
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/trades/edit/${trade.id}`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" onClick={() => setShowShareDialog(true)}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Price Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Price Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Entry Price</p>
                <p className="text-xl md:text-2xl font-bold">{trade.entry_price}</p>
              </div>
              {trade.exit_price && (
                <div>
                  <p className="text-sm text-muted-foreground">Exit Price</p>
                  <p className="text-xl md:text-2xl font-bold">{trade.exit_price}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Quantity</p>
                <p className="text-xl font-semibold">{trade.quantity}</p>
              </div>
            </CardContent>
          </Card>

          {/* P&L Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {trade.pnl && (
                <div>
                  <p className="text-sm text-muted-foreground">P&L</p>
                  <p className={`text-xl md:text-2xl font-bold ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatCurrency(trade.pnl, trade.trading_accounts.currency)}
                  </p>
                </div>
              )}
              {trade.commission && (
                <div>
                  <p className="text-sm text-muted-foreground">Commission</p>
                  <p className="text-base md:text-lg">{formatCurrency(trade.commission, trade.trading_accounts.currency)}</p>
                </div>
              )}
              {trade.swap && (
                <div>
                  <p className="text-sm text-muted-foreground">Swap</p>
                  <p className="text-base md:text-lg">{formatCurrency(trade.swap, trade.trading_accounts.currency)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Risk Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {trade.stop_loss && (
                <div>
                  <p className="text-sm text-muted-foreground">Stop Loss</p>
                  <p className="text-base md:text-lg font-semibold">{trade.stop_loss}</p>
                </div>
              )}
              {trade.take_profit && (
                <div>
                  <p className="text-sm text-muted-foreground">Take Profit</p>
                  <p className="text-base md:text-lg font-semibold">{trade.take_profit}</p>
                </div>
              )}
              {trade.risk_reward_ratio && (
                <div>
                  <p className="text-sm text-muted-foreground">Risk:Reward Ratio</p>
                  <p className="text-base md:text-lg font-semibold">1:{trade.risk_reward_ratio}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timing Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Timing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Entry Date</p>
                <p className="font-medium">{formatDate(trade.entry_date)}</p>
              </div>
              {trade.exit_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Exit Date</p>
                  <p className="font-medium">{formatDate(trade.exit_date)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account & Strategy */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Trade Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Trading Account</p>
                <p className="font-medium">{trade.trading_accounts.name}</p>
              </div>
              {trade.strategies && (
                <div>
                  <p className="text-sm text-muted-foreground">Strategy</p>
                  <p className="font-medium">{trade.strategies.name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Currency</p>
                <p className="font-medium">{trade.trading_accounts.currency}</p>
              </div>
            </CardContent>
          </Card>

          {/* Screenshots */}
          {trade.screenshots && trade.screenshots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Screenshots
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setScreenshotDialog(true)}
                  className="w-full"
                  size="sm"
                >
                  View Charts ({trade.screenshots.length})
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Notes Section */}
        {trade.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">{trade.notes}</div>
            </CardContent>
          </Card>
        )}

        {/* Confluence Section */}
        {confluenceItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Confluence Analysis
              </CardTitle>
              <CardDescription>
                Confluence factors that supported this trade setup
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                  <span className="font-medium">Total Confluence Score:</span>
                  <span className="font-bold text-primary text-lg">
                    {confluenceItems.reduce((sum, item) => sum + item.weight, 0).toFixed(1)} points
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {confluenceItems.reduce((acc, item) => {
                    const category = item.category || 'General';
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(item);
                    return acc;
                  }, {} as Record<string, ConfluenceItem[]>)
                  && Object.entries(
                    confluenceItems.reduce((acc, item) => {
                      const category = item.category || 'General';
                      if (!acc[category]) acc[category] = [];
                      acc[category].push(item);
                      return acc;
                    }, {} as Record<string, ConfluenceItem[]>)
                  ).map(([category, items]) => (
                    <div key={category} className="space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                        {category}
                      </h4>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg bg-muted/20">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">
                                {item.name}
                              </p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <Badge variant="secondary" className="ml-2 flex-shrink-0">
                              {item.weight}pts
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Screenshot Gallery Dialog */}
        <Dialog open={screenshotDialog} onOpenChange={setScreenshotDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Chart Screenshots</DialogTitle>
              <DialogDescription>
                Trading chart screenshots for {trade.symbol}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {trade.screenshots?.map((screenshot, index) => (
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
                        <ImageIcon className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Shareable Trade Card */}
        {trade && (
          <ShareableTradeCard 
            trade={trade}
            isOpen={showShareDialog}
            onClose={() => setShowShareDialog(false)}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default TradeDetail;