import React, { useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { TrendingUp, TrendingDown, Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';

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
  trading_accounts: {
    name: string;
    currency: string;
  };
  strategies?: {
    name: string;
  };
}

interface ShareableTradeCardProps {
  trade: Trade;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareableTradeCard({ trade, isOpen, onClose }: ShareableTradeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const downloadAsImage = async () => {
    if (!cardRef.current) return;

    try {
      // Ensure web fonts are ready
      await (document as any).fonts?.ready;

      // Preload background image (if any) to avoid blank canvas
      const style = window.getComputedStyle(cardRef.current);
      const bgImage = style.backgroundImage;
      const match = bgImage && bgImage !== 'none' ? bgImage.match(/url\(["']?(.*?)["']?\)/) : null;
      if (match?.[1]) {
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = match[1];
        });
      }

      const rect = cardRef.current.getBoundingClientRect();
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 4,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        useCORS: true,
        allowTaint: false,
        foreignObjectRendering: false,
        logging: false,
        imageTimeout: 0,
        onclone: (doc) => {
          const pill = doc.querySelector('[data-share-pill]') as HTMLElement | null;
          if (pill) {
            pill.style.backdropFilter = 'none';
            // @ts-ignore - vendor prefix for Safari
            pill.style.webkitBackdropFilter = 'none';
            pill.style.display = 'inline-flex';
            pill.style.width = 'auto';
          }
          const root = doc.querySelector('[data-share-root]') as HTMLElement | null;
          if (root) {
            root.style.borderRadius = '0px';
            root.style.overflow = 'visible';
          }
        }
      });
      const dataUrl = canvas.toDataURL('image/png');

      const link = document.createElement('a');
      link.download = `trade-${trade.symbol}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();

      toast.success('Trade card downloaded successfully!');
    } catch (error) {
      console.error('Error downloading image:', error);
      toast.error('Failed to download image');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Share Trade</span>
            <Button onClick={downloadAsImage} size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </DialogTitle>
          <DialogDescription className="sr-only">Share and download a static trade summary image.</DialogDescription>
        </DialogHeader>
        
        <div className="p-6 pt-4">
          <div 
            ref={cardRef}
            data-share-root
            className="w-[500px] h-[500px] rounded-xl p-6 relative overflow-hidden mx-auto"
            style={{ 
              backgroundImage: `url('/lovable-uploads/d2ebd9e4-65b8-4650-9df3-b2d4d5ace41a.png')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
            }}
          >
            {/* Content */}
            <div className="relative z-10 flex flex-col h-full">
              {/* Header with Symbol and Trade Type - horizontal alignment with 16px gap */}
              <div className="flex items-center gap-4">
                <h1 
                  className="text-white leading-none font-cirka-bold inline-block align-middle" 
                  style={{ 
                    color: '#FFF',
                    fontSize: '52px',
                    fontStyle: 'normal',
                    fontWeight: 700,
                    lineHeight: '1',
                    fontFamily: '"Archivo Black", Inter, system-ui, sans-serif'
                  }}
                >
                  {trade.symbol}
                </h1>
                <div 
                  className="h-6 px-3 rounded-full inline-flex items-center leading-none align-middle translate-y-[2px]"
                  data-share-pill
                  style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <span 
                    className="text-white font-cirka-light" 
                    style={{ 
                      fontSize: '14px',
                      fontWeight: 300,
                      fontFamily: 'Inter, system-ui, sans-serif',
                      lineHeight: '1'
                    }}
                  >
                    {trade.trade_type}
                  </span>
                </div>
              </div>

              {/* Price Section - 16px vertical spacing from header */}
              <div style={{ marginTop: '16px' }}>
                <div className="flex items-center gap-3">
                  <span 
                    className="text-white font-proxima" 
                    style={{ 
                      color: '#FFF',
                      fontSize: '22px',
                      fontStyle: 'normal',
                      fontWeight: 400,
                      lineHeight: 'normal'
                    }}
                  >
                    {trade.entry_price}
                  </span>
                  <span className="text-white/70 font-proxima" style={{ fontSize: '18px' }}>→</span>
                  <span 
                    className="text-white font-proxima" 
                    style={{ 
                      color: '#FFF',
                      fontSize: '22px',
                      fontStyle: 'normal',
                      fontWeight: 400,
                      lineHeight: 'normal'
                    }}
                  >
                    {trade.exit_price || 'Open'}
                  </span>
                </div>
              </div>

              {/* Quantity - 40px from entry/exit price */}
              <div style={{ marginTop: '40px' }}>
                <p 
                  className="text-white/70 mb-1 uppercase font-proxima" 
                  style={{ 
                    fontSize: '10px',
                    fontWeight: 400,
                    letterSpacing: '0.1em'
                  }}
                >
                  QUANTITY
                </p>
                <p 
                  className="text-white font-proxima" 
                  style={{ 
                    fontSize: '18px',
                    fontWeight: 600
                  }}
                >
                  {trade.quantity} Lots
                </p>
              </div>

              {/* P&L - 60px from quantity */}
              {trade.pnl && (
                <div style={{ marginTop: '60px' }}>
                  <p 
                    className="font-proxima" 
                    style={{ 
                      fontSize: '48px',
                      fontWeight: 700,
                      color: trade.pnl >= 0 ? '#EADF8B' : '#FF9A9A'
                    }}
                  >
                    {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl, trade.trading_accounts.currency)}
                  </p>
                </div>
              )}

              {/* Footer - 60px from P&L, left aligned */}
              <div style={{ marginTop: '60px' }}>
                <div className="flex items-center">
                  <div>
                    <span 
                      className="text-white/60 uppercase font-proxima block" 
                      style={{ 
                        fontSize: '10px',
                        fontWeight: 400,
                        letterSpacing: '0.1em'
                      }}
                    >
                      SHARED FROM
                    </span>
                    <div className="flex items-center gap-1 mt-1">
                      <TrendingUp className="h-[14px] w-[14px] text-white shrink-0" />
                      <span 
                        className="text-white font-proxima leading-none" 
                        style={{ 
                          fontSize: '14px',
                          fontWeight: 600,
                          lineHeight: '14px'
                        }}
                      >
                        IFVG Journal
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}