/**
 * Rithmic R Trader Pro CSV parser.
 *
 * R Trader Pro's "Orders" / "Order History" / "Completed Orders" export
 * contains individual FILLS (not trades). We pair opposing fills FIFO per
 * (account, symbol) to produce round-trip trades for the journal.
 *
 * Typical Rithmic columns we look for (case/space-insensitive, also tolerant
 * of common variants from prop firms like Lucid/Tradesea that white-label
 * Rithmic):
 *   Account, Symbol, Buy/Sell (or Side / B/S), Qty (or Quantity / Filled Qty),
 *   Avg Fill Price (or Fill Price / Price / Limit Price),
 *   Update Time / Fill Time / Time / Closed Time, Status, Commission,
 *   Order Number (or Order ID), Exchange.
 *
 * We only consume rows whose Status is "Filled" / "Complete" / "Completed".
 */

export interface RithmicTradeRow {
  user_id: string;
  trading_account_id: string;
  symbol: string;
  trade_type: 'long' | 'short';
  entry_price: number;
  exit_price: number;
  quantity: number;
  entry_date: string; // ISO
  exit_date: string; // ISO
  pnl: number;
  commission: number;
  status: 'closed';
  source: 'rithmic';
  external_id: string; // composite of entry+exit order ids for dedupe
  notes: string;
}

interface ParsedFill {
  account: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  time: Date;
  commission: number;
  orderId: string;
}

/** Split a CSV line honoring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_/\-.]+/g, '');
}

/** Find the index of the first header that matches any of the candidate keys. */
function findCol(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normHeader);
  for (const cand of candidates) {
    const k = normHeader(cand);
    const idx = normalized.indexOf(k);
    if (idx !== -1) return idx;
  }
  // Loose contains match as a last resort
  for (const cand of candidates) {
    const k = normHeader(cand);
    const idx = normalized.findIndex((h) => h.includes(k));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseRithmicDate(raw: string): Date | null {
  if (!raw) return null;
  const v = raw.trim().replace(/"/g, '');
  if (!v) return null;
  // Try native first
  const native = new Date(v);
  if (!isNaN(native.getTime())) return native;
  // Rithmic often uses YYYYMMDD HH:MM:SS or YYYY-MM-DD HH:MM:SS.mmm
  const m = v.match(
    /^(\d{4})[-/]?(\d{2})[-/]?(\d{2})[ T]?(\d{2}):?(\d{2}):?(\d{2})/,
  );
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    const dt = new Date(
      `${y}-${mo}-${d}T${h}:${mi}:${s}Z`,
    );
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

function parseSide(raw: string): 'buy' | 'sell' | null {
  const v = raw.toLowerCase().trim();
  if (!v) return null;
  if (v === 'b' || v === 'buy' || v === 'bot' || v === 'bought' || v.startsWith('buy')) {
    return 'buy';
  }
  if (v === 's' || v === 'sell' || v === 'sld' || v === 'sold' || v.startsWith('sell') || v.startsWith('shor')) {
    return 'sell';
  }
  return null;
}

function isFilledStatus(raw: string): boolean {
  if (!raw) return true; // some exports omit status; trust the row
  const v = raw.toLowerCase();
  return (
    v.includes('fill') ||
    v.includes('complete') ||
    v === 'done' ||
    v === 'executed'
  );
}

export interface RithmicParseResult {
  trades: RithmicTradeRow[];
  fillCount: number;
  unmatchedFills: number;
  warnings: string[];
}

export function parseRithmicCsv(
  text: string,
  ctx: { userId: string; tradingAccountId: string },
): RithmicParseResult {
  const warnings: string[] = [];
  // Normalize line endings, drop empty lines
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('Rithmic CSV must contain a header row and at least one fill.');
  }

  // Some Rithmic exports start with a title/blank line; auto-detect header row.
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const h = lines[i].toLowerCase();
    if (
      (h.includes('symbol') || h.includes('instrument')) &&
      (h.includes('qty') || h.includes('quantity'))
    ) {
      headerIdx = i;
      break;
    }
  }

  const headers = splitCsvLine(lines[headerIdx]).map((h) => h.replace(/"/g, ''));

  const colSymbol = findCol(headers, ['Symbol', 'Instrument', 'Ticker']);
  const colSide = findCol(headers, ['Buy/Sell', 'B/S', 'Side', 'BuySell', 'Action']);
  const colQty = findCol(headers, ['Filled Qty', 'Qty Filled', 'Qty', 'Quantity', 'Filled Quantity']);
  const colPrice = findCol(headers, [
    'Avg Fill Price',
    'Average Fill Price',
    'Fill Price',
    'Price',
    'Avg Price',
    'Limit Price',
  ]);
  const colTime = findCol(headers, [
    'Update Time',
    'Fill Time',
    'Closed Time',
    'Time',
    'Update Time (RDT)',
    'Timestamp',
    'Execution Time',
  ]);
  const colStatus = findCol(headers, ['Status', 'Order Status']);
  const colCommission = findCol(headers, ['Commission', 'Commissions', 'Total Commission', 'Fee', 'Fees']);
  const colOrderId = findCol(headers, ['Order Number', 'Order ID', 'OrderId', 'Order No']);
  const colAccount = findCol(headers, ['Account', 'Account Number', 'Acct']);

  const missing: string[] = [];
  if (colSymbol === -1) missing.push('Symbol');
  if (colSide === -1) missing.push('Buy/Sell');
  if (colQty === -1) missing.push('Qty');
  if (colPrice === -1) missing.push('Avg Fill Price');
  if (colTime === -1) missing.push('Update Time');
  if (missing.length > 0) {
    throw new Error(
      `This does not look like a Rithmic export. Missing column(s): ${missing.join(', ')}. ` +
        `Use R Trader Pro → Orders/History → Export to CSV.`,
    );
  }

  const fills: ParsedFill[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = splitCsvLine(lines[i]);
    if (row.length === 1 && row[0].trim() === '') continue;

    const status = colStatus !== -1 ? row[colStatus] : '';
    if (!isFilledStatus(status)) continue;

    const side = parseSide(row[colSide] || '');
    const qty = parseFloat((row[colQty] || '').replace(/[,]/g, ''));
    const price = parseFloat((row[colPrice] || '').replace(/[,]/g, ''));
    const time = parseRithmicDate(row[colTime] || '');
    const symbol = (row[colSymbol] || '').replace(/"/g, '').trim();

    if (!symbol || !side || !isFinite(qty) || qty <= 0 || !isFinite(price) || !time) {
      continue;
    }

    fills.push({
      account: colAccount !== -1 ? row[colAccount] : '',
      symbol,
      side,
      qty,
      price,
      time,
      commission: colCommission !== -1 ? parseFloat((row[colCommission] || '0').replace(/[,$]/g, '')) || 0 : 0,
      orderId: colOrderId !== -1 ? (row[colOrderId] || '').trim() : '',
    });
  }

  if (fills.length === 0) {
    throw new Error('No filled orders found in the file.');
  }

  // FIFO match per symbol
  fills.sort((a, b) => a.time.getTime() - b.time.getTime());
  const trades: RithmicTradeRow[] = [];
  const openQueues: Record<string, ParsedFill[]> = {};

  for (const fill of fills) {
    const key = fill.symbol;
    const queue = (openQueues[key] = openQueues[key] || []);
    const opposite = queue[0]?.side !== fill.side && queue.length > 0;

    if (queue.length === 0 || !opposite) {
      // Open or add to existing same-direction position
      queue.push({ ...fill });
      continue;
    }

    // Close against opposing fills FIFO
    let remaining = fill.qty;
    let exitCommission = fill.commission;
    while (remaining > 0 && queue.length > 0 && queue[0].side !== fill.side) {
      const entry = queue[0];
      const matchedQty = Math.min(entry.qty, remaining);
      const entryShare = matchedQty / entry.qty;
      const entryCommissionShare = entry.commission * entryShare;
      const exitCommissionShare =
        exitCommission * (matchedQty / fill.qty);

      const isLong = entry.side === 'buy';
      const pnl =
        (isLong ? fill.price - entry.price : entry.price - fill.price) * matchedQty;

      trades.push({
        user_id: ctx.userId,
        trading_account_id: ctx.tradingAccountId,
        symbol: entry.symbol,
        trade_type: isLong ? 'long' : 'short',
        entry_price: entry.price,
        exit_price: fill.price,
        quantity: matchedQty,
        entry_date: entry.time.toISOString(),
        exit_date: fill.time.toISOString(),
        pnl: +(pnl - entryCommissionShare - exitCommissionShare).toFixed(2),
        commission: +(entryCommissionShare + exitCommissionShare).toFixed(2),
        status: 'closed',
        source: 'rithmic',
        external_id: `rithmic:${entry.orderId || entry.time.getTime()}-${fill.orderId || fill.time.getTime()}-${matchedQty}`,
        notes: `Imported from Rithmic. Entry order ${entry.orderId || 'n/a'} → Exit order ${fill.orderId || 'n/a'}.`,
      });

      entry.qty -= matchedQty;
      entry.commission -= entryCommissionShare;
      remaining -= matchedQty;
      if (entry.qty <= 1e-9) queue.shift();
    }

    if (remaining > 1e-9) {
      // Flipped position — push remaining as a new open in fill's direction
      queue.push({
        ...fill,
        qty: remaining,
        commission: exitCommission * (remaining / fill.qty),
      });
    }
  }

  const unmatchedFills = Object.values(openQueues).reduce(
    (acc, q) => acc + q.length,
    0,
  );
  if (unmatchedFills > 0) {
    warnings.push(
      `${unmatchedFills} fill(s) remain open (no closing fill in the file). Only round-trip trades are imported.`,
    );
  }

  return { trades, fillCount: fills.length, unmatchedFills, warnings };
}
