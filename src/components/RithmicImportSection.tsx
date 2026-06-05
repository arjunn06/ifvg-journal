import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseRithmicCsv, type RithmicTradeRow } from '@/lib/rithmicParser';

interface RithmicImportSectionProps {
  accountId: string;
  onImportComplete?: () => void;
}

export function RithmicImportSection({ accountId, onImportComplete }: RithmicImportSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isBusy, setIsBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RithmicTradeRow[]>([]);
  const [stats, setStats] = useState<{ fillCount: number; unmatched: number; warnings: string[] } | null>(null);

  const reset = () => {
    setPreview([]);
    setSelectedFile(null);
    setStats(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setSelectedFile(f);
      setPreview([]);
      setStats(null);
    }
  };

  const handleParse = async () => {
    if (!selectedFile || !user) return;
    setIsBusy(true);
    try {
      const text = await selectedFile.text();
      const result = parseRithmicCsv(text, {
        userId: user.id,
        tradingAccountId: accountId,
      });
      if (result.trades.length === 0) {
        throw new Error('No round-trip trades could be matched from this file.');
      }
      setPreview(result.trades);
      setStats({
        fillCount: result.fillCount,
        unmatched: result.unmatchedFills,
        warnings: result.warnings,
      });
      toast({
        title: 'Preview ready',
        description: `${result.trades.length} round-trip trade(s) paired from ${result.fillCount} fill(s).`,
      });
    } catch (err) {
      logger.apiError('RithmicImportSection - parse', err);
      toast({
        title: 'Could not parse Rithmic file',
        description: err instanceof Error ? err.message : 'Unknown error.',
        variant: 'destructive',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (preview.length === 0 || !user) return;
    setIsBusy(true);
    try {
      // Dedupe: query existing external_ids for this account/source
      const externalIds = preview.map((t) => t.external_id);
      const { data: existing, error: dupErr } = await supabase
        .from('trades')
        .select('external_id')
        .eq('trading_account_id', accountId)
        .eq('user_id', user.id)
        .eq('source', 'rithmic')
        .in('external_id', externalIds);
      if (dupErr) throw dupErr;

      const existingSet = new Set((existing || []).map((r: { external_id: string | null }) => r.external_id));
      const toInsert = preview.filter((t) => !existingSet.has(t.external_id));
      const skipped = preview.length - toInsert.length;

      if (toInsert.length === 0) {
        toast({
          title: 'Nothing new to import',
          description: `All ${preview.length} trade(s) were already imported previously.`,
        });
        reset();
        return;
      }

      const { error } = await supabase.from('trades').insert(toInsert);
      if (error) throw error;

      toast({
        title: 'Rithmic import complete',
        description:
          `Imported ${toInsert.length} new trade(s)` +
          (skipped > 0 ? `; skipped ${skipped} already-imported.` : '.'),
      });
      reset();
      onImportComplete?.();
    } catch (err) {
      logger.apiError('RithmicImportSection - insert', err);
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Unknown error.',
        variant: 'destructive',
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-2">
        <p className="font-semibold text-foreground">How to export from R Trader Pro</p>
        <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
          <li>Open R Trader Pro and sign in to your Rithmic account.</li>
          <li>
            Open the <span className="font-mono">Orders</span> or{' '}
            <span className="font-mono">Order History</span> window.
          </li>
          <li>Filter by date range, right-click the grid, choose <span className="font-mono">Export → CSV</span>.</li>
          <li>Upload that CSV below.</li>
        </ol>
        <p className="text-muted-foreground">
          Works for any Rithmic-backed prop firm (Lucid, Tradesea, Apex, TopStep, MFFU, etc.). Individual
          fills are paired FIFO into round-trip trades. Re-uploading the same file is safe — duplicates
          are skipped automatically.
        </p>
      </div>

      {preview.length === 0 ? (
        <div className="space-y-2">
          <Label htmlFor="rithmic-csv">Rithmic CSV file</Label>
          <Input
            id="rithmic-csv"
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={isBusy}
            className="cursor-pointer"
          />
          {selectedFile && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground truncate">{selectedFile.name}</span>
              <Button onClick={handleParse} disabled={isBusy} size="sm">
                <Upload className="h-4 w-4 mr-2" />
                {isBusy ? 'Parsing…' : 'Parse & Preview'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="text-sm">
              <div className="font-medium">
                {preview.length} round-trip trade(s) ready
              </div>
              {stats && (
                <div className="text-xs text-muted-foreground">
                  Paired from {stats.fillCount} fill(s)
                  {stats.unmatched > 0 ? ` · ${stats.unmatched} open fill(s) skipped` : ''}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={reset} disabled={isBusy} size="sm" variant="outline">
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={isBusy} size="sm">
                <CheckCircle className="h-4 w-4 mr-1" />
                {isBusy ? 'Importing…' : 'Confirm Import'}
              </Button>
            </div>
          </div>

          {stats?.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 p-2 rounded border border-amber-500/30 bg-amber-500/5">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}

          <ScrollArea className="h-80 border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Exit</TableHead>
                  <TableHead>Entry Time</TableHead>
                  <TableHead>P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{t.symbol}</TableCell>
                    <TableCell className="capitalize">{t.trade_type}</TableCell>
                    <TableCell>{t.quantity}</TableCell>
                    <TableCell>{t.entry_price}</TableCell>
                    <TableCell>{t.exit_price}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(t.entry_date).toLocaleString()}
                    </TableCell>
                    <TableCell className={t.pnl > 0 ? 'text-green-600' : t.pnl < 0 ? 'text-red-600' : ''}>
                      {t.pnl.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
