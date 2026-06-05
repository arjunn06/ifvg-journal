import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Download, Upload, FileSpreadsheet, X, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { PremiumFeature } from '@/components/PremiumFeature';
import { CustomizableCsvExport } from '@/components/CustomizableCsvExport';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RithmicImportSection } from '@/components/RithmicImportSection';

interface TradeCsvManagerProps {
  accountId: string;
  accountName: string;
}

interface Trade {
  id: string;
  symbol: string;
  trade_type: string;
  entry_price: number;
  exit_price?: number;
  quantity: number;
  entry_date: string;
  exit_date?: string;
  stop_loss?: number;
  take_profit?: number;
  pnl?: number;
  notes?: string;
  status: string;
  commission?: number;
  swap?: number;
  risk_amount?: number;
  risk_reward_ratio?: number;
}

export function TradeCsvManager({ accountId, accountName }: TradeCsvManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewTrades, setPreviewTrades] = useState<any[]>([]);

  const handleExportCsv = async () => {
    if (!user) return;
    
    setIsExporting(true);
    try {
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('trading_account_id', accountId)
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });

      if (error) throw error;

      if (!trades || trades.length === 0) {
        toast({
          title: "No trades found",
          description: "No trades available for export in this account.",
          variant: "destructive"
        });
        return;
      }

      // Convert trades to CSV
      const csvHeaders = [
        'Symbol',
        'Trade Type',
        'Entry Price',
        'Exit Price',
        'Quantity',
        'Entry Date',
        'Exit Date',
        'Stop Loss',
        'Take Profit',
        'PnL',
        'Status',
        'Commission',
        'Swap',
        'Risk Amount',
        'Risk Reward Ratio',
        'Notes'
      ];

      const csvRows = trades.map((trade: Trade) => [
        trade.symbol,
        trade.trade_type,
        trade.entry_price,
        trade.exit_price || '',
        trade.quantity,
        new Date(trade.entry_date).toISOString().split('T')[0],
        trade.exit_date ? new Date(trade.exit_date).toISOString().split('T')[0] : '',
        trade.stop_loss || '',
        trade.take_profit || '',
        trade.pnl || '',
        trade.status,
        trade.commission || 0,
        trade.swap || 0,
        trade.risk_amount || '',
        trade.risk_reward_ratio || '',
        (trade.notes || '').replace(/"/g, '""') // Escape quotes in notes
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(field => 
          typeof field === 'string' && field.includes(',') 
            ? `"${field}"` 
            : field
        ).join(','))
      ].join('\n');

      // Download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${accountName.replace(/[^a-z0-9]/gi, '_')}_trades_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export successful",
        description: `Exported ${trades.length} trades to CSV file.`
      });
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewTrades([]); // Clear preview when new file is selected
    }
  };

  const handleCancelPreview = () => {
    setPreviewTrades([]);
    setSelectedFile(null);
  };

  const handleParseAndPreview = async () => {
    if (!selectedFile || !user) return;

    setIsImporting(true);
    try {
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file must have headers and at least one trade row');
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const rows = lines.slice(1);

      // Validate required headers
      const requiredHeaders = ['Symbol', 'Trade Type', 'Entry Price', 'Quantity', 'Entry Date'];
      const missingHeaders = requiredHeaders.filter(req => 
        !headers.some(h => h.toLowerCase().includes(req.toLowerCase()))
      );

      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
      }

      const trades = [];
      for (const row of rows) {
        const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
        const trade: any = { 
          user_id: user.id,
          trading_account_id: accountId,
          status: 'open'
        };

        headers.forEach((header, index) => {
          const value = values[index] || '';
          
          switch (header.toLowerCase()) {
            case 'symbol':
              trade.symbol = value;
              break;
            case 'trade type':
              const lowerValue = value.toLowerCase();
              if (lowerValue === 'buy' || lowerValue === 'long') {
                trade.trade_type = 'long';
              } else if (lowerValue === 'sell' || lowerValue === 'short') {
                trade.trade_type = 'short';
              } else {
                trade.trade_type = lowerValue;
              }
              break;
            case 'entry price':
              trade.entry_price = parseFloat(value);
              break;
            case 'exit price':
              if (value) trade.exit_price = parseFloat(value);
              break;
            case 'quantity':
              trade.quantity = parseFloat(value);
              break;
            case 'entry date':
              trade.entry_date = new Date(value).toISOString();
              break;
            case 'exit date':
              if (value) trade.exit_date = new Date(value).toISOString();
              break;
            case 'stop loss':
              if (value) trade.stop_loss = parseFloat(value);
              break;
            case 'take profit':
              if (value) trade.take_profit = parseFloat(value);
              break;
            case 'pnl':
              if (value) trade.pnl = parseFloat(value);
              break;
            case 'status':
              if (value) trade.status = value.toLowerCase();
              break;
            case 'commission':
              if (value) trade.commission = parseFloat(value);
              break;
            case 'swap':
              if (value) trade.swap = parseFloat(value);
              break;
            case 'risk amount':
              if (value) trade.risk_amount = parseFloat(value);
              break;
            case 'risk reward ratio':
              if (value) trade.risk_reward_ratio = parseFloat(value);
              break;
            case 'notes':
              if (value) trade.notes = value;
              break;
          }
        });

        // Auto-determine status based on exit data
        if (!trade.status || trade.status === 'open') {
          if (trade.exit_price || trade.exit_date || trade.pnl !== undefined) {
            trade.status = 'closed';
          } else {
            trade.status = 'open';
          }
        }

        // Validate required fields
        if (!trade.symbol || !trade.trade_type || !trade.entry_price || !trade.quantity || !trade.entry_date) {
          throw new Error(`Invalid trade data in row: ${row}`);
        }

        trades.push(trade);
      }

      setPreviewTrades(trades);
      toast({
        title: "Preview ready",
        description: `${trades.length} trades parsed successfully. Review and confirm to import.`
      });
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast({
        title: "Parse failed",
        description: error instanceof Error ? error.message : "Failed to parse CSV file.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (previewTrades.length === 0) return;

    setIsImporting(true);
    try {
      const { error } = await supabase
        .from('trades')
        .insert(previewTrades);

      if (error) throw error;

      toast({
        title: "Import successful",
        description: `Successfully imported ${previewTrades.length} trades.`
      });

      // Reset state
      setSelectedFile(null);
      setPreviewTrades([]);
    } catch (error) {
      console.error('Error importing trades:', error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import trades.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <PremiumFeature
      feature="CSV Import/Export"
      description="Import and export your trades as CSV files for advanced analysis and record keeping."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            CSV Import/Export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div>
                <Label className="text-sm font-medium">Import Trades</Label>
                <Tabs defaultValue="generic" className="mt-2">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="generic">Generic CSV</TabsTrigger>
                    <TabsTrigger value="rithmic">Rithmic / Prop Firm</TabsTrigger>
                  </TabsList>
                  <TabsContent value="generic" className="mt-3 space-y-2">
                  {previewTrades.length === 0 ? (
                    <>
                      <Input
                        id="csv-import"
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        disabled={isImporting}
                        className="cursor-pointer"
                      />
                      {selectedFile && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground truncate">
                            Selected: {selectedFile.name}
                          </span>
                          <Button
                            onClick={handleParseAndPreview}
                            disabled={isImporting}
                            size="sm"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {isImporting ? 'Processing...' : 'Preview'}
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Select a CSV file with your trade data, then click Preview
                      </p>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{previewTrades.length} trades ready</p>
                          <p className="text-xs text-muted-foreground">Review and confirm below</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleCancelPreview}
                            disabled={isImporting}
                            size="sm"
                            variant="outline"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            onClick={handleConfirmImport}
                            disabled={isImporting}
                            size="sm"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            {isImporting ? 'Importing...' : 'Confirm'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  </TabsContent>
                  <TabsContent value="rithmic" className="mt-3">
                    <RithmicImportSection accountId={accountId} />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
            
            <div className="flex-1">
              <Label className="text-sm font-medium">
                Export Trades
              </Label>
              <div className="mt-2 space-y-2">
                <Button
                  onClick={handleExportCsv}
                  disabled={isExporting}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? 'Exporting...' : 'Quick Export (All Fields)'}
                </Button>
                <CustomizableCsvExport />
                <p className="text-xs text-muted-foreground">
                  Quick export includes all fields, or use custom export to select specific fields
                </p>
              </div>
            </div>
          </div>

          {previewTrades.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Trade Preview</h4>
              <ScrollArea className="h-80 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>Exit</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>PnL</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewTrades.map((trade, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{trade.symbol}</TableCell>
                        <TableCell className="capitalize">{trade.trade_type}</TableCell>
                        <TableCell>{trade.entry_price}</TableCell>
                        <TableCell>{trade.exit_price || '-'}</TableCell>
                        <TableCell>{trade.quantity}</TableCell>
                        <TableCell>{new Date(trade.entry_date).toLocaleDateString()}</TableCell>
                        <TableCell className={trade.pnl ? (trade.pnl > 0 ? 'text-green-600' : 'text-red-600') : ''}>
                          {trade.pnl ? `$${trade.pnl.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="capitalize">{trade.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center justify-between">
                <span>CSV Column Format</span>
                <a 
                  href="https://docs.google.com/spreadsheets/d/1example/edit" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs font-normal"
                >
                  View Example Template →
                </a>
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Your CSV file must have column headers in the first row. Column names are case-insensitive.
              </p>
            </div>
            
            <div className="grid gap-3">
              <div className="p-3 bg-background rounded border">
                <h5 className="text-xs font-semibold text-foreground mb-2">✓ Required Columns (must be present):</h5>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <code className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Symbol</code>
                    <span>- Trading pair/instrument (e.g., EURUSD, AAPL)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <code className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Trade Type</code>
                    <span>- Must be: buy, sell, long, or short</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <code className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Entry Price</code>
                    <span>- Opening price (number, e.g., 1.2550)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <code className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Quantity</code>
                    <span>- Position size/lots (number, e.g., 0.5)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <code className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Entry Date</code>
                    <span>- Format: YYYY-MM-DD (e.g., 2024-03-15)</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-background rounded border">
                <h5 className="text-xs font-semibold text-foreground mb-2">Optional Columns (will be imported if present):</h5>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <code className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Exit Price</code>
                    <span className="text-[10px]">- Closing price</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Exit Date</code>
                    <span className="text-[10px]">- YYYY-MM-DD</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Stop Loss</code>
                    <span className="text-[10px]">- SL price level</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Take Profit</code>
                    <span className="text-[10px]">- TP price level</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">PnL</code>
                    <span className="text-[10px]">- Profit/Loss ($)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Status</code>
                    <span className="text-[10px]">- open/closed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Commission</code>
                    <span className="text-[10px]">- Trading fees</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Swap</code>
                    <span className="text-[10px]">- Overnight fees</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Risk Amount</code>
                    <span className="text-[10px]">- $ at risk</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Risk Reward Ratio</code>
                    <span className="text-[10px]">- R:R (e.g., 2.5)</span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2">
                    <code className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Notes</code>
                    <span className="text-[10px]">- Text comments/observations</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/50 space-y-1">
              <p className="text-xs text-muted-foreground">
                <strong>💡 Auto-Detection:</strong> Trades with Exit Price, Exit Date, or PnL will be marked as 'closed' automatically.
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>📋 Example Header Row:</strong> <code className="text-[10px] bg-muted px-1 py-0.5 rounded">Symbol,Trade Type,Entry Price,Quantity,Entry Date,Exit Price,PnL</code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </PremiumFeature>
  );
}