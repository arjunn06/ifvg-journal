import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileSpreadsheet, X, CheckCircle, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CsvImportSectionProps {
  accountId: string;
  onImportComplete?: () => void;
  compact?: boolean;
}

type Step = 'upload' | 'map' | 'review';

interface DestField {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

const DEST_FIELDS: DestField[] = [
  { key: 'symbol', label: 'Symbol', required: true, aliases: ['symbol', 'ticker', 'instrument', 'pair'] },
  { key: 'trade_type', label: 'Trade Type', required: true, aliases: ['trade type', 'tradetype', 'side', 'direction', 'type', 'buy/sell'] },
  { key: 'entry_price', label: 'Entry Price', required: true, aliases: ['entry price', 'entryprice', 'open price', 'openprice', 'price in', 'avg entry'] },
  { key: 'quantity', label: 'Quantity', required: true, aliases: ['quantity', 'qty', 'size', 'lots', 'volume', 'contracts'] },
  { key: 'entry_date', label: 'Entry Date', required: true, aliases: ['entry date', 'entrydate', 'open date', 'open time', 'opened at', 'date in', 'entry time'] },
  { key: 'exit_price', label: 'Exit Price', aliases: ['exit price', 'exitprice', 'close price', 'closeprice', 'price out', 'avg exit'] },
  { key: 'exit_date', label: 'Exit Date', aliases: ['exit date', 'exitdate', 'close date', 'close time', 'closed at', 'date out', 'exit time'] },
  { key: 'stop_loss', label: 'Stop Loss', aliases: ['stop loss', 'stoploss', 'sl', 'stop'] },
  { key: 'take_profit', label: 'Take Profit', aliases: ['take profit', 'takeprofit', 'tp', 'target'] },
  { key: 'pnl', label: 'PnL', aliases: ['pnl', 'p/l', 'profit', 'profit/loss', 'net pnl', 'net p/l', 'realized pnl'] },
  { key: 'status', label: 'Status', aliases: ['status', 'state'] },
  { key: 'commission', label: 'Commission', aliases: ['commission', 'fee', 'fees', 'commissions'] },
  { key: 'swap', label: 'Swap', aliases: ['swap', 'rollover', 'overnight'] },
  { key: 'risk_amount', label: 'Risk Amount', aliases: ['risk amount', 'risk', 'risk $'] },
  { key: 'risk_reward_ratio', label: 'Risk Reward Ratio', aliases: ['risk reward ratio', 'rr', 'r:r', 'r/r', 'risk/reward'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comments', 'comment', 'description'] },
];

const SKIP = '__skip__';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim()); current = '';
    } else current += c;
  }
  result.push(current.trim());
  return result;
}

function autoMap(header: string): string {
  const h = header.toLowerCase().trim().replace(/[_-]/g, ' ');
  for (const field of DEST_FIELDS) {
    if (field.aliases.some(a => a === h)) return field.key;
  }
  for (const field of DEST_FIELDS) {
    if (field.aliases.some(a => h.includes(a) || a.includes(h))) return field.key;
  }
  return SKIP;
}

export function CsvImportSection({ accountId, onImportComplete, compact = false }: CsvImportSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('upload');
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<number, { dest: string; include: boolean }>>({});
  const [previewTrades, setPreviewTrades] = useState<any[]>([]);

  const reset = () => {
    setStep('upload');
    setSelectedFile(null);
    setHeaders([]);
    setRows([]);
    setMappings({});
    setPreviewTrades([]);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setHeaders([]);
      setRows([]);
      setMappings({});
    }
  };

  const handleParseHeaders = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    try {
      const text = await selectedFile.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV must have headers and at least one data row');
      const hdrs = parseCsvLine(lines[0]);
      const dataRows = lines.slice(1).map(parseCsvLine);
      const initial: Record<number, { dest: string; include: boolean }> = {};
      hdrs.forEach((h, idx) => {
        const dest = autoMap(h);
        initial[idx] = { dest, include: dest !== SKIP };
      });
      setHeaders(hdrs);
      setRows(dataRows);
      setMappings(initial);
      setStep('map');
    } catch (err) {
      toast({ title: 'Parse failed', description: err instanceof Error ? err.message : 'Failed to read CSV', variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const sampleData = useMemo(() => {
    return headers.map((_, idx) => rows.slice(0, 3).map(r => r[idx] ?? '').filter(Boolean));
  }, [headers, rows]);

  const usedDests = useMemo(() => {
    const used = new Set<string>();
    Object.values(mappings).forEach(m => { if (m.include && m.dest !== SKIP) used.add(m.dest); });
    return used;
  }, [mappings]);

  const missingRequired = useMemo(() => {
    return DEST_FIELDS.filter(f => f.required && !usedDests.has(f.key)).map(f => f.label);
  }, [usedDests]);

  const handleBuildPreview = () => {
    if (missingRequired.length) {
      toast({ title: 'Missing required mappings', description: missingRequired.join(', '), variant: 'destructive' });
      return;
    }
    if (!user) return;

    const trades: any[] = [];
    for (const row of rows) {
      const trade: any = { user_id: user.id, trading_account_id: accountId, status: 'open' };
      headers.forEach((_, idx) => {
        const m = mappings[idx];
        if (!m || !m.include || m.dest === SKIP) return;
        const value = (row[idx] ?? '').trim();
        if (!value) return;
        switch (m.dest) {
          case 'symbol': trade.symbol = value; break;
          case 'trade_type': {
            const v = value.toLowerCase();
            trade.trade_type = v === 'buy' || v === 'long' ? 'long' : v === 'sell' || v === 'short' ? 'short' : v;
            break;
          }
          case 'entry_price': trade.entry_price = parseFloat(value); break;
          case 'exit_price': trade.exit_price = parseFloat(value); break;
          case 'quantity': trade.quantity = parseFloat(value); break;
          case 'entry_date': trade.entry_date = new Date(value).toISOString(); break;
          case 'exit_date': trade.exit_date = new Date(value).toISOString(); break;
          case 'stop_loss': trade.stop_loss = parseFloat(value); break;
          case 'take_profit': trade.take_profit = parseFloat(value); break;
          case 'pnl': trade.pnl = parseFloat(value); break;
          case 'status': trade.status = value.toLowerCase(); break;
          case 'commission': trade.commission = parseFloat(value); break;
          case 'swap': trade.swap = parseFloat(value); break;
          case 'risk_amount': trade.risk_amount = parseFloat(value); break;
          case 'risk_reward_ratio': trade.risk_reward_ratio = parseFloat(value); break;
          case 'notes': trade.notes = value; break;
        }
      });
      if (!trade.symbol || !trade.trade_type || !trade.entry_price || !trade.quantity || !trade.entry_date) continue;
      if (trade.status === 'open' && (trade.exit_price || trade.exit_date || trade.pnl !== undefined)) {
        trade.status = 'closed';
      }
      trades.push(trade);
    }

    if (!trades.length) {
      toast({ title: 'No valid rows', description: 'Check your mappings — no rows had all required fields.', variant: 'destructive' });
      return;
    }
    setPreviewTrades(trades);
    setStep('review');
  };

  const handleConfirmImport = async () => {
    if (!previewTrades.length) return;
    setIsImporting(true);
    try {
      const { error } = await supabase.from('trades').insert(previewTrades);
      if (error) throw error;
      toast({ title: 'Import successful', description: `Imported ${previewTrades.length} trades.` });
      reset();
      onImportComplete?.();
    } catch (err) {
      logger.apiError('CsvImportSection - importing trades', err);
      toast({ title: 'Import failed', description: err instanceof Error ? err.message : 'Failed to import trades.', variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const Stepper = () => {
    const steps: { key: Step; label: string }[] = [
      { key: 'upload', label: 'Upload' },
      { key: 'map', label: 'Map Columns' },
      { key: 'review', label: 'Review' },
    ];
    const activeIdx = steps.findIndex(s => s.key === step);
    return (
      <div className="flex items-center justify-center gap-2 sm:gap-4 py-2">
        {steps.map((s, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <div key={s.key} className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium border',
                  done && 'bg-primary text-primary-foreground border-primary',
                  active && 'bg-primary text-primary-foreground border-primary',
                  !done && !active && 'bg-muted text-muted-foreground border-border'
                )}>
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={cn('text-sm', active ? 'font-medium' : 'text-muted-foreground')}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className="w-8 sm:w-12 h-px bg-border" />}
            </div>
          );
        })}
      </div>
    );
  };

  const UploadStep = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="csv-import" className="text-sm font-medium">Select CSV File</Label>
        <Input
          id="csv-import"
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          disabled={isImporting}
          className="cursor-pointer mt-2"
        />
        {selectedFile && (
          <p className="text-sm text-muted-foreground mt-2">Selected: {selectedFile.name}</p>
        )}
      </div>
      <div className="flex justify-end">
        <Button onClick={handleParseHeaders} disabled={!selectedFile || isImporting}>
          <Upload className="h-4 w-4 mr-2" />
          {isImporting ? 'Reading…' : 'Continue'}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
      <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground space-y-1">
        <p><strong>Tip:</strong> Any CSV works. On the next step you'll map your columns to the platform fields.</p>
        <p><strong>Required fields:</strong> Symbol, Trade Type, Entry Price, Quantity, Entry Date.</p>
      </div>
    </div>
  );

  const MapStep = (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Your File Column</TableHead>
              <TableHead>Your Sample Data</TableHead>
              <TableHead className="w-[240px]">Destination Column</TableHead>
              <TableHead className="w-[80px] text-center">Include</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {headers.map((h, idx) => {
              const m = mappings[idx] ?? { dest: SKIP, include: false };
              const samples = sampleData[idx] ?? [];
              return (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{h}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {samples.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      {samples.map((s, i) => (
                        <code key={i} className="px-1.5 py-0.5 bg-muted rounded text-[11px] font-mono truncate max-w-[140px]">{s}</code>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={m.dest}
                      onValueChange={(v) => setMappings(prev => ({ ...prev, [idx]: { dest: v, include: v !== SKIP } }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>— Skip —</SelectItem>
                        {DEST_FIELDS.map(f => (
                          <SelectItem
                            key={f.key}
                            value={f.key}
                            disabled={usedDests.has(f.key) && m.dest !== f.key}
                          >
                            {f.label}{f.required ? ' *' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={m.include && m.dest !== SKIP}
                      disabled={m.dest === SKIP}
                      onCheckedChange={(c) => setMappings(prev => ({ ...prev, [idx]: { ...m, include: !!c } }))}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {missingRequired.length > 0 && (
        <div className="text-xs text-destructive">
          Missing required mappings: {missingRequired.join(', ')}
        </div>
      )}
      <div className="flex justify-between">
        <Button variant="outline" onClick={reset}>
          <X className="h-4 w-4 mr-2" /> Cancel
        </Button>
        <Button onClick={handleBuildPreview} disabled={missingRequired.length > 0}>
          Continue <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const ReviewStep = (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <span className="text-sm font-medium">{previewTrades.length} trades ready to import</span>
      </div>
      <ScrollArea className={compact ? 'h-64 border rounded-lg' : 'h-96 border rounded-lg'}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Entry</TableHead>
              {!compact && <TableHead>Exit</TableHead>}
              <TableHead>Qty</TableHead>
              {!compact && <TableHead>Entry Date</TableHead>}
              {!compact && <TableHead>PnL</TableHead>}
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewTrades.map((t, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{t.symbol}</TableCell>
                <TableCell className="capitalize">{t.trade_type}</TableCell>
                <TableCell>{t.entry_price}</TableCell>
                {!compact && <TableCell>{t.exit_price ?? '-'}</TableCell>}
                <TableCell>{t.quantity}</TableCell>
                {!compact && <TableCell>{new Date(t.entry_date).toLocaleDateString()}</TableCell>}
                {!compact && (
                  <TableCell className={t.pnl ? (t.pnl > 0 ? 'text-profit' : 'text-loss') : ''}>
                    {t.pnl ? `$${t.pnl.toFixed(2)}` : '-'}
                  </TableCell>
                )}
                <TableCell className="capitalize">{t.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep('map')} disabled={isImporting}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset} disabled={isImporting}>
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
          <Button onClick={handleConfirmImport} disabled={isImporting}>
            <CheckCircle className="h-4 w-4 mr-2" />
            {isImporting ? 'Importing…' : 'Confirm Import'}
          </Button>
        </div>
      </div>
    </div>
  );

  const body = (
    <div className="space-y-4">
      <Stepper />
      {step === 'upload' && UploadStep}
      {step === 'map' && MapStep}
      {step === 'review' && ReviewStep}
    </div>
  );

  if (compact) {
    return <div>{body}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Import Trades from CSV
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
