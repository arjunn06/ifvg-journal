import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, ImageIcon, Edit, Trash2, Eye, X, Copy, MoreHorizontal, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ShareableTradeCard } from '@/components/ShareableTradeCard';
import { useState } from 'react';

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
  trading_accounts: {
    name: string;
    currency: string;
  };
  strategies?: {
    name: string;
  };
}

interface TradeCardProps {
  trade: Trade;
  onClose?: (trade: Trade) => void;
  onDelete?: (tradeId: string) => void;
  onDuplicate?: (tradeId: string) => void;
  onViewScreenshots?: (screenshots: string[]) => void;
}

export function TradeCard({ trade, onClose, onDelete, onDuplicate, onViewScreenshots }: TradeCardProps) {
  const navigate = useNavigate();
  const [showShareDialog, setShowShareDialog] = useState(false);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleCardClick = () => {
    navigate(`/trades/${trade.id}`);
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <Card 
      className="interactive-card group relative animate-fade-in hover:shadow-xl transition-all duration-300"
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{trade.symbol}</h3>
            <Badge variant={trade.trade_type === 'long' ? 'default' : 'short'}>
              {trade.trade_type === 'long' ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {trade.trade_type.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={trade.status === 'open' ? 'outline' : 'secondary'}
            >
              {trade.status}
            </Badge>
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
                <DropdownMenuItem onClick={(e) => handleActionClick(e, () => navigate(`/trades/${trade.id}`))}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                {onDuplicate && (
                  <DropdownMenuItem onClick={(e) => handleActionClick(e, () => onDuplicate(trade.id))}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy to Account
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={(e) => handleActionClick(e, () => setShowShareDialog(true))}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Trade
                </DropdownMenuItem>
                {trade.status === 'open' && onClose && (
                  <DropdownMenuItem onClick={(e) => handleActionClick(e, () => onClose(trade))}>
                    <X className="h-4 w-4 mr-2" />
                    Close Trade
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={(e) => handleActionClick(e, () => onDelete(trade.id))}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Trade
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Entry Price</p>
            <p className="font-medium">{trade.entry_price}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Exit Price</p>
            <p className="font-medium">{trade.exit_price || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Quantity</p>
            <p className="font-medium">{trade.quantity}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">P&L</p>
            {trade.pnl ? (
              <p className={`font-medium transition-colors duration-300 ${trade.pnl >= 0 ? 'text-profit group-hover:animate-bounce-gentle' : 'text-loss group-hover:animate-bounce-gentle'}`}>
                {formatCurrency(trade.pnl, trade.trading_accounts.currency)}
              </p>
            ) : (
              <p className="font-medium">-</p>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-sm text-muted-foreground">Entry Date</p>
            <p className="text-sm">{formatDate(trade.entry_date)}</p>
          </div>
          {trade.exit_date && (
            <div>
              <p className="text-sm text-muted-foreground">Exit Date</p>
              <p className="text-sm">{formatDate(trade.exit_date)}</p>
            </div>
          )}
        </div>

        {trade.screenshots && trade.screenshots.length > 0 && (
          <div className="mb-3">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleActionClick(e, () => onViewScreenshots?.(trade.screenshots!))}
              className="w-full"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              View Screenshots ({trade.screenshots.length})
            </Button>
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => handleActionClick(e, () => navigate(`/trades/${trade.id}`))}
            className="flex-1 hover:scale-105 transition-transform duration-200"
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          {onDuplicate && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleActionClick(e, () => onDuplicate(trade.id))}
              className="hover:scale-105 transition-transform duration-200"
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
          {trade.status === 'open' && onClose && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleActionClick(e, () => onClose(trade))}
              className="hover:scale-105 transition-transform duration-200"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => handleActionClick(e, () => onDelete(trade.id))}
              className="hover:scale-105 transition-transform duration-200 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
      
      <ShareableTradeCard 
        trade={trade}
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
      />
    </Card>
  );
}