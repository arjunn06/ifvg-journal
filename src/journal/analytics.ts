// Pure functions over trades. Nothing here touches the network or the DOM, so every figure on a
// screen is computed from the rows the screen shows (a total is never typed in beside its parts).

import type { Account, Strategy, Trade, TradeMistake, Transaction } from './types';
import { sessionLabel } from './types';
import { money } from './format';

export type Period = 'today' | '7d' | '30d' | '90d' | 'ytd' | 'all';
export const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'ytd', label: 'YTD' },
  { key: 'all', label: 'All' },
];

const DAY = 86400000;
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function periodStart(p: Period, now = new Date()): number | null {
  const s = startOfDay(now).getTime();
  switch (p) {
    case 'today': return s;
    case '7d': return s - 6 * DAY;
    case '30d': return s - 29 * DAY;
    case '90d': return s - 89 * DAY;
    case 'ytd': return new Date(now.getFullYear(), 0, 1).getTime();
    default: return null;
  }
}

/** The previous window of equal length, for "vs prior" figures. Null for All time. */
export function priorWindow(p: Period, now = new Date()): [number, number] | null {
  const s = periodStart(p, now);
  if (s == null) return null;
  const end = startOfDay(now).getTime() + DAY;
  const len = end - s;
  return [s - len, s];
}

export const isClosed = (t: Trade) => t.status === 'closed' && t.pnl != null;
export const closeTime = (t: Trade) => new Date(t.exit_date ?? t.entry_date).getTime();
export const pnlOf = (t: Trade) => t.pnl ?? 0;
export const rOf = (t: Trade): number | null =>
  t.pnl != null && t.risk_amount && t.risk_amount > 0 ? t.pnl / t.risk_amount : null;

export function inPeriod(trades: Trade[], p: Period, now = new Date()) {
  const s = periodStart(p, now);
  if (s == null) return trades;
  return trades.filter((t) => closeTime(t) >= s);
}
export const inWindow = (trades: Trade[], [a, b]: [number, number]) =>
  trades.filter((t) => closeTime(t) >= a && closeTime(t) < b);

export interface Summary {
  count: number;
  open: number;
  wins: number;
  losses: number;
  flat: number;
  net: number;
  grossWin: number;
  grossLoss: number; // positive number
  winRate: number | null; // % of decided (win+loss) trades
  profitFactor: number | null;
  avgWin: number | null;
  avgLoss: number | null; // positive number
  payoff: number | null;
  expectancy: number | null; // $ per closed trade
  avgR: number | null;
  totalR: number;
  rCount: number;
  best: number | null;
  worst: number | null;
  maxDrawdown: number; // positive $
  streak: { kind: 'W' | 'L' | null; n: number };
  longestWin: number;
  longestLoss: number;
  fees: number;
}

export function summarize(all: Trade[]): Summary {
  const closed = all.filter(isClosed).sort((a, b) => closeTime(a) - closeTime(b));
  let wins = 0, losses = 0, flat = 0, grossWin = 0, grossLoss = 0;
  let totalR = 0, rCount = 0, fees = 0;
  let best: number | null = null, worst: number | null = null;
  let cum = 0, peak = 0, maxDd = 0;
  let run = 0, runKind: 'W' | 'L' | null = null, longestWin = 0, longestLoss = 0;
  for (const t of closed) {
    const p = pnlOf(t);
    cum += p;
    peak = Math.max(peak, cum);
    maxDd = Math.max(maxDd, peak - cum);
    fees += (t.commission ?? 0) + (t.swap ?? 0);
    best = best == null ? p : Math.max(best, p);
    worst = worst == null ? p : Math.min(worst, p);
    const r = rOf(t);
    if (r != null) { totalR += r; rCount++; }
    const kind: 'W' | 'L' | null = p > 0 ? 'W' : p < 0 ? 'L' : null;
    if (p > 0) { wins++; grossWin += p; } else if (p < 0) { losses++; grossLoss += -p; } else flat++;
    if (kind && kind === runKind) run++; else { runKind = kind; run = kind ? 1 : 0; }
    if (kind === 'W') longestWin = Math.max(longestWin, run);
    if (kind === 'L') longestLoss = Math.max(longestLoss, run);
  }
  const decided = wins + losses;
  const net = grossWin - grossLoss;
  return {
    count: closed.length,
    open: all.filter((t) => t.status === 'open').length,
    wins, losses, flat, net, grossWin, grossLoss,
    winRate: decided ? (wins / decided) * 100 : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    avgWin: wins ? grossWin / wins : null,
    avgLoss: losses ? grossLoss / losses : null,
    payoff: wins && losses ? grossWin / wins / (grossLoss / losses) : null,
    expectancy: closed.length ? net / closed.length : null,
    avgR: rCount ? totalR / rCount : null,
    totalR, rCount, best, worst,
    maxDrawdown: maxDd,
    streak: { kind: runKind, n: run },
    longestWin, longestLoss, fees,
  };
}

export interface EquityPoint { t: number; v: number; pnl: number; id: string; dd: number }

/** Running balance after each closed trade, starting from `start`. dd is the drop from the running peak. */
export function equityCurve(all: Trade[], start = 0): EquityPoint[] {
  const closed = all.filter(isClosed).sort((a, b) => closeTime(a) - closeTime(b));
  let v = start, peak = start;
  return closed.map((t) => {
    v += pnlOf(t);
    peak = Math.max(peak, v);
    return { t: closeTime(t), v, pnl: pnlOf(t), id: t.id, dd: peak - v };
  });
}

// ---------- breakdowns ----------

export interface Row {
  key: string;
  label: string;
  count: number;
  wins: number;
  losses: number;
  net: number;
  winRate: number | null;
  expectancy: number | null;
  avgR: number | null;
  profitFactor: number | null;
}

export function breakdown<K extends string>(
  trades: Trade[],
  keyOf: (t: Trade) => K | null,
  labelOf: (k: K) => string = (k) => k,
): Row[] {
  const groups = new Map<K, Trade[]>();
  for (const t of trades.filter(isClosed)) {
    const k = keyOf(t);
    if (k == null) continue;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(t);
  }
  return [...groups.entries()].map(([k, ts]) => {
    const s = summarize(ts);
    return {
      key: k, label: labelOf(k), count: s.count, wins: s.wins, losses: s.losses, net: s.net,
      winRate: s.winRate, expectancy: s.expectancy, avgR: s.avgR, profitFactor: s.profitFactor,
    };
  });
}

export const bySession = (t: Trade[]) => breakdown(t, (x) => x.session, sessionLabel);
export const bySymbol = (t: Trade[]) => breakdown(t, (x) => x.symbol).sort((a, b) => b.count - a.count);
export const bySide = (t: Trade[]) => breakdown(t, (x) => x.trade_type, (k) => (k === 'long' ? 'Long' : 'Short'));
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const byWeekday = (t: Trade[]) =>
  breakdown(t, (x) => String(new Date(x.entry_date).getDay()), (k) => WEEKDAYS[+k]);
export function byStrategy(t: Trade[], strategies: Strategy[]) {
  const name = (id: string) => strategies.find((s) => s.id === id)?.name ?? 'Unassigned';
  return breakdown(t, (x) => x.strategy_id ?? 'none', (k) => (k === 'none' ? 'Unassigned' : name(k)));
}
export const byEmotion = (t: Trade[]) => breakdown(t, (x) => x.emotions || null, (k) => k[0].toUpperCase() + k.slice(1));

// ---------- calendar ----------

export interface Day { date: string; pnl: number; count: number; wins: number; losses: number; trades: Trade[] }

const p2 = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export function dailyMap(all: Trade[]): Map<string, Day> {
  const m = new Map<string, Day>();
  for (const t of all.filter(isClosed)) {
    const k = dayKey(new Date(t.exit_date ?? t.entry_date));
    const d = m.get(k) ?? { date: k, pnl: 0, count: 0, wins: 0, losses: 0, trades: [] };
    d.pnl += pnlOf(t); d.count++; d.trades.push(t);
    if (pnlOf(t) > 0) d.wins++; else if (pnlOf(t) < 0) d.losses++;
    m.set(k, d);
  }
  return m;
}

export interface Cell { date: Date; key: string; inMonth: boolean; day: Day | null }
export interface Week { cells: Cell[]; pnl: number; count: number }

/** Weeks Monday to Sunday covering the month; the weekly total sits with its row. */
export function monthGrid(year: number, month: number, daily: Map<string, Day>): Week[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  const last = new Date(year, month + 1, 0);
  const total = Math.ceil((lead + last.getDate()) / 7) * 7;
  const weeks: Week[] = [];
  for (let i = 0; i < total; i += 7) {
    const cells: Cell[] = [];
    let pnl = 0, count = 0;
    for (let j = 0; j < 7; j++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i + j);
      const key = dayKey(date);
      const inMonth = date.getMonth() === month;
      const day = daily.get(key) ?? null;
      if (inMonth && day) { pnl += day.pnl; count += day.count; }
      cells.push({ date, key, inMonth, day });
    }
    weeks.push({ cells, pnl, count });
  }
  return weeks;
}

// ---------- distributions ----------

export interface Bin { lo: number | null; hi: number | null; label: string; count: number }

/** R-multiple histogram: 1R bins from −3R to +4R with open tails. */
export function rHistogram(all: Trade[]): Bin[] {
  const edges = [-3, -2, -1, 0, 1, 2, 3, 4];
  const bins: Bin[] = [{ lo: null, hi: edges[0], label: `<${edges[0]}R`.replace('-', '−'), count: 0 }];
  for (let i = 0; i < edges.length - 1; i++) {
    const f = (n: number) => (n < 0 ? `−${-n}` : n > 0 ? `+${n}` : '0');
    bins.push({ lo: edges[i], hi: edges[i + 1], label: `${f(edges[i])}…${f(edges[i + 1])}`, count: 0 });
  }
  bins.push({ lo: edges[edges.length - 1], hi: null, label: `≥+${edges[edges.length - 1]}R`, count: 0 });
  for (const t of all.filter(isClosed)) {
    const r = rOf(t);
    if (r == null) continue;
    const b = bins.find((x) => (x.lo == null || r >= x.lo) && (x.hi == null || r < x.hi));
    if (b) b.count++;
  }
  return bins;
}

export const CONFLUENCE_TIERS = [
  { key: 'low', label: 'Below 50%', lo: 0, hi: 50 },
  { key: 'mid', label: '50–74%', lo: 50, hi: 75 },
  { key: 'high', label: '75–89%', lo: 75, hi: 90 },
  { key: 'top', label: '90% and up', lo: 90, hi: 101 },
];

/** Does a fuller checklist earn more? Trades grouped by the confluence score they were taken at. */
export function byConfluence(all: Trade[]): Row[] {
  const rows = breakdown(
    all.filter((t) => t.confluence_score != null),
    (t) => CONFLUENCE_TIERS.find((x) => t.confluence_score! >= x.lo && t.confluence_score! < x.hi)?.key ?? null,
    (k) => CONFLUENCE_TIERS.find((x) => x.key === k)!.label,
  );
  return CONFLUENCE_TIERS.map((x) => rows.find((r) => r.key === x.key)).filter(Boolean) as Row[];
}

export interface MistakeRow { tag: string; count: number; cost: number }

/** What each mistake tag cost: the sum of P&L on losing trades carrying it. A trade with two tags counts under both. */
export function mistakeCosts(all: Trade[], mistakes: TradeMistake[]): MistakeRow[] {
  const byId = new Map(all.filter(isClosed).map((t) => [t.id, t]));
  const m = new Map<string, MistakeRow>();
  for (const x of mistakes) {
    const t = byId.get(x.trade_id);
    if (!t) continue;
    const row = m.get(x.mistake_tag) ?? { tag: x.mistake_tag, count: 0, cost: 0 };
    row.count++;
    if (pnlOf(t) < 0) row.cost += pnlOf(t);
    m.set(x.mistake_tag, row);
  }
  return [...m.values()].sort((a, b) => a.cost - b.cost);
}

/** Share of closed trades with no mistake tag. */
export function planAdherence(all: Trade[], mistakes: TradeMistake[]) {
  const closed = all.filter(isClosed);
  if (!closed.length) return null;
  const flagged = new Set(mistakes.map((m) => m.trade_id));
  const clean = closed.filter((t) => !flagged.has(t.id));
  return { clean: clean.length, total: closed.length, pct: (clean.length / closed.length) * 100, cleanNet: clean.reduce((s, t) => s + pnlOf(t), 0) };
}

// ---------- accounts ----------

const ADDS = ['deposit', 'payout'];
export function transactionNet(txs: Transaction[], accountId: string) {
  return txs
    .filter((x) => x.trading_account_id === accountId)
    .reduce((s, x) => (ADDS.includes(x.transaction_type) ? s + x.amount : x.transaction_type === 'withdrawal' ? s - x.amount : s), 0);
}

export function balanceAdjustmentNet(txs: Transaction[], accountId: string) {
  return txs.filter((x) => x.trading_account_id === accountId && x.transaction_type === 'balance_adjustment').reduce((sum, x) => sum + x.amount, 0);
}

export function accountEquity(a: Account, trades: Trade[], txs: Transaction[]) {
  const pnl = trades.filter((t) => t.trading_account_id === a.id && isClosed(t)).reduce((s, t) => s + pnlOf(t), 0);
  return a.initial_balance + pnl + transactionNet(txs, a.id) + balanceAdjustmentNet(txs, a.id);
}

export interface PropStatus {
  equity: number;
  profit: number;
  target: number | null;
  targetPct: number | null;
  floor: number | null; // equity may not fall below this
  bufferToFloor: number | null;
  dailyPnl: number;
  dailyLimit: number | null;
  tradingDays: number;
  minDays: number | null;
}

export function propStatus(a: Account, trades: Trade[], txs: Transaction[], now = new Date()): PropStatus {
  const mine = trades.filter((t) => t.trading_account_id === a.id && isClosed(t));
  const equity = accountEquity(a, trades, txs);
  const profit = mine.reduce((s, t) => s + pnlOf(t), 0);
  const today = dayKey(now);
  const dailyPnl = mine.filter((t) => dayKey(new Date(t.exit_date ?? t.entry_date)) === today).reduce((s, t) => s + pnlOf(t), 0);
  let floor: number | null = null;
  if (a.max_loss_limit) {
    if (a.trailing_drawdown_enabled) {
      const peak = Math.max(a.initial_balance, ...equityCurve(mine, a.initial_balance).map((p) => p.v));
      floor = peak - a.max_loss_limit;
    } else floor = a.initial_balance - a.max_loss_limit;
  }
  const days = new Set(mine.map((t) => dayKey(new Date(t.exit_date ?? t.entry_date)))).size;
  return {
    equity, profit,
    target: a.profit_target,
    targetPct: a.profit_target ? Math.max(0, (profit / a.profit_target) * 100) : null,
    floor,
    bufferToFloor: floor != null ? equity - floor : null,
    dailyPnl, dailyLimit: a.daily_loss_limit,
    tradingDays: days, minDays: a.minimum_trading_days,
  };
}

// ---------- the one finding ----------

export interface Finding { text: string; tone: 'pos' | 'neg' | 'flat' }

/** The single most useful fact in the current view, written from the numbers. */
export function topFinding(
  trades: Trade[],
  strategies: Strategy[],
  mistakes: TradeMistake[],
  currency = 'USD',
): Finding | null {
  const closed = trades.filter(isClosed);
  if (closed.length < 8) return null;
  const sessions = bySession(closed).filter((r) => r.count >= 4);
  const costs = mistakeCosts(closed, mistakes);
  const conf = byConfluence(closed).filter((r) => r.count >= 4);
  const strats = byStrategy(closed, strategies).filter((r) => r.count >= 4 && r.key !== 'none');

  const worstMistake = costs[0];
  if (worstMistake && worstMistake.cost < 0 && Math.abs(worstMistake.cost) > Math.abs(summarize(closed).net) * 0.25) {
    return {
      tone: 'neg',
      text: `${worstMistake.tag} cost ${money(worstMistake.cost, currency, { decimals: 0 }).replace('\u2212', '')} across ${worstMistake.count} trade${worstMistake.count === 1 ? '' : 's'} in this view.`,
    };
  }
  if (conf.length >= 2) {
    const hi = conf[conf.length - 1], lo = conf[0];
    if (hi.expectancy != null && lo.expectancy != null && hi.expectancy > lo.expectancy)
      return { tone: 'pos', text: `Trades taken at ${hi.label.toLowerCase()} confluence average ${money(hi.expectancy, currency, { sign: true, decimals: 0 })} a trade; at ${lo.label.toLowerCase()}, ${money(lo.expectancy, currency, { sign: true, decimals: 0 })}.` };
  }
  if (sessions.length >= 2) {
    const best = [...sessions].sort((a, b) => b.net - a.net)[0];
    return { tone: 'pos', text: `${best.label} is your edge: ${best.count} trades, ${best.winRate != null ? Math.round(best.winRate) : 0}% won.` };
  }
  if (strats.length) {
    const best = [...strats].sort((a, b) => b.net - a.net)[0];
    return { tone: 'pos', text: `${best.label} leads this view with ${best.count} trades.` };
  }
  return null;
}
