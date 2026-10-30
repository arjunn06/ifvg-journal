import { useMemo, useState } from 'react';
import { Upload, X } from 'lucide-react';
import type { Account, Trade } from '../types';

type Field = 'symbol' | 'trade_type' | 'entry_date' | 'entry_price' | 'exit_date' | 'exit_price' | 'quantity' | 'stop_loss' | 'take_profit' | 'pnl' | 'commission' | 'status' | 'notes';
const FIELDS: { key: Field; label: string; required?: boolean }[] = [
  { key: 'symbol', label: 'Instrument', required: true }, { key: 'trade_type', label: 'Side', required: true },
  { key: 'entry_date', label: 'Opened at', required: true }, { key: 'entry_price', label: 'Entry price' },
  { key: 'exit_date', label: 'Closed at' }, { key: 'exit_price', label: 'Exit price' }, { key: 'quantity', label: 'Quantity' },
  { key: 'stop_loss', label: 'Stop loss' }, { key: 'take_profit', label: 'Target' }, { key: 'pnl', label: 'P&L' },
  { key: 'commission', label: 'Commission' }, { key: 'status', label: 'Status' }, { key: 'notes', label: 'Notes' },
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIASES: Record<Field, string[]> = {
  symbol: ['symbol', 'instrument', 'ticker', 'market'], trade_type: ['side', 'direction', 'tradetype', 'type'],
  entry_date: ['entrydate', 'opendate', 'openedat', 'entrytime', 'datetime', 'date'], entry_price: ['entryprice', 'openprice', 'pricein'],
  exit_date: ['exitdate', 'closedate', 'closedat', 'exittime'], exit_price: ['exitprice', 'closeprice', 'priceout'],
  quantity: ['quantity', 'qty', 'size', 'contracts', 'volume'], stop_loss: ['stoploss', 'sl'], take_profit: ['takeprofit', 'target', 'tp'],
  pnl: ['pnl', 'profit', 'netpnl', 'result'], commission: ['commission', 'fees'], status: ['status'], notes: ['notes', 'comment'],
};
const number = (s: string | undefined) => { if (!s?.trim()) return null; const n = Number(s.replace(/[,$]/g, '').replace(/[()]/g, (x) => x === '(' ? '-' : '')); return Number.isFinite(n) ? n : null; };
function dateValue(s: string | undefined): string | null {
  if (!s?.trim()) return null;
  const d = new Date(s.trim());
  return Number.isNaN(+d) ? null : d.toISOString();
}

export default function ImportTradesDialog({ accounts, selectedAccountId, onClose, onImport }: {
  accounts: Account[]; selectedAccountId: string | null; onClose: () => void;
  onImport: (accountId: string, trades: Partial<Trade>[]) => Promise<void>;
}) {
  const [headers, setHeaders] = useState<string[]>([]); const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<Field, number>>>({}); const [accountId, setAccountId] = useState(selectedAccountId ?? accounts[0]?.id ?? '');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [fileName, setFileName] = useState('');
  const parsed = useMemo(() => dataRows.map((r, i) => {
    const v = (key: Field) => mapping[key] == null ? '' : (r[mapping[key]!] ?? '').trim();
    const side = v('trade_type').toLowerCase();
    const symbol = v('symbol'); const entryDate = dateValue(v('entry_date'));
    if (!symbol || !entryDate || !['long', 'short', 'buy', 'sell'].includes(side)) return null;
    const statusRaw = v('status').toLowerCase();
    const exitDate = dateValue(v('exit_date'));
    const exitPrice = number(v('exit_price'));
    const status = statusRaw.includes('open') || (!exitDate && exitPrice == null) ? 'open' : 'closed';
    return {
      symbol: symbol.toUpperCase(), trade_type: (side === 'buy' ? 'long' : side === 'sell' ? 'short' : side) as 'long' | 'short',
      status, entry_date: entryDate, entry_price: number(v('entry_price')) ?? 0, exit_date: exitDate,
      exit_price: exitPrice, quantity: number(v('quantity')) ?? 1, stop_loss: number(v('stop_loss')),
      take_profit: number(v('take_profit')), pnl: number(v('pnl')), commission: number(v('commission')),
      notes: v('notes') || null, strategy_id: null, session: null, swap: null, risk_amount: null, risk_reward_ratio: null,
      emotions: null, screenshots: null, confluence_score: null, trading_account_id: accountId,
      _row: i + 2,
    };
  }), [dataRows, mapping, accountId]);
  const valid = parsed.filter((x): x is NonNullable<typeof x> => x !== null);
  const invalid = parsed.length - valid.length;

  const load = async (file?: File) => {
    setError('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Choose a CSV file.'); return; }
    const rows = parseCsv(await file.text());
    if (rows.length < 2) { setError('This CSV needs a header row and at least one trade.'); return; }
    const head = rows[0].map((x, i) => x.trim() || `Column ${i + 1}`);
    const auto: Partial<Record<Field, number>> = {};
    FIELDS.forEach(({ key }) => { const ix = head.findIndex((h) => ALIASES[key].includes(norm(h))); if (ix >= 0) auto[key] = ix; });
    setHeaders(head); setDataRows(rows.slice(1)); setMapping(auto); setFileName(file.name);
  };
  const submit = async () => {
    setError('');
    if (!accountId) { setError('Choose the account for these trades.'); return; }
    if (!valid.length) { setError('No valid rows to import. Map Instrument, Side and Opened at, then check the values.'); return; }
    setBusy(true);
    try {
      await onImport(accountId, valid.map(({ _row: _ignored, ...t }) => t)); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Import failed.'); }
    finally { setBusy(false); }
  };

  return <div className="j-app" style={{ display: 'block', minHeight: 0, background: 'none' }}>
    <div className="j-scrim" onClick={onClose} />
    <section className="j-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title" style={{ width: 'min(760px, calc(100vw - 32px))' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h2 id="import-title">Import trades from CSV</h2><div className="j-meta" style={{ marginTop: 5 }}>Match your file’s columns to the trade fields.</div></div>
        <button className="j-icon-btn" onClick={onClose} aria-label="Close import"><X /></button>
      </header>
      <div className="body">
        <label className="j-field"><span>Import into account</span><select className="j-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></label>
        <label className="j-btn" style={{ width: 'fit-content', cursor: 'pointer' }}><Upload />{fileName || 'Choose CSV'}<input type="file" accept=".csv,text/csv" onChange={(e) => void load(e.target.files?.[0])} style={{ display: 'none' }} /></label>
        {!!headers.length && <>
          <div style={{ maxHeight: 320, overflow: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(145px, 1fr) minmax(170px, 1fr) minmax(160px, 1.4fr)', gap: 8, alignItems: 'center', padding: '0 0 7px' }} className="j-meta"><span>Trade field</span><span>CSV column</span><span>Example</span></div>
            {FIELDS.map((f) => <div key={f.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(145px, 1fr) minmax(170px, 1fr) minmax(160px, 1.4fr)', gap: 8, alignItems: 'center', padding: '5px 0' }}>
              <label htmlFor={`map-${f.key}`}>{f.label}{f.required ? ' *' : ''}</label>
              <select id={`map-${f.key}`} className="j-select sm" value={mapping[f.key] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }))}>
                <option value="">Skip column</option>{headers.map((h, i) => <option key={`${i}-${h}`} value={i}>{h}</option>)}
              </select><span className="j-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dataRows[0]?.[mapping[f.key] ?? -1] || '—'}</span>
            </div>)}
          </div>
          <div className="j-meta">{valid.length} ready to import{invalid ? ` · ${invalid} row${invalid === 1 ? '' : 's'} skipped (missing or invalid Instrument, Side or Opened at)` : ''}</div>
        </>}
        {error && <div role="alert" style={{ color: 'var(--pill-neg-ink)' }}>{error}</div>}
      </div>
      <footer><button className="j-btn" onClick={onClose} disabled={busy}>Cancel</button><button className="j-btn primary" onClick={() => void submit()} disabled={busy || !headers.length}>{busy ? 'Importing…' : `Import ${valid.length} trades`}</button></footer>
    </section>
  </div>;
}
