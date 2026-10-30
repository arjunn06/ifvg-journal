// Pure helpers for the Reports screen. Everything is computed from the trades handed in, so a total is
// always the sum of the rows beside it (rows with no value for a field fall into an explicit remainder row).

import * as A from '../../analytics';
import { SESSIONS, sessionLabel } from '../../types';
import type { Account, ConfluenceItem, Strategy, Trade, TradeConfluence, TradeMistake } from '../../types';
import { isoDate } from '../../format';

export const MIN_N = 5;

export type Row = A.Row;
const empty = (key: string, label: string): Row => ({ key, label, count: 0, wins: 0, losses: 0, net: 0, winRate: null, expectancy: null, avgR: null, profitFactor: null });
const byNetDesc = (a: Row, b: Row) => b.net - a.net;

/** All five sessions in clock order (zero rows kept), then trades logged with no session. */
export function sessionRows(trades: Trade[]): Row[] {
  const rows = A.breakdown(trades, (t) => t.session ?? 'none', (k) => (k === 'none' ? 'No session' : sessionLabel(k)));
  const out = SESSIONS.map((s) => rows.find((r) => r.key === s.key) ?? empty(s.key, s.label));
  const none = rows.find((r) => r.key === 'none');
  return none ? [...out, none] : out;
}

const DAY_ORDER = ['1', '2', '3', '4', '5', '6', '0'];
export const dayName = (k: string) => A.WEEKDAYS[+k];

/** Mon to Fri always; Sat and Sun only when a trade was opened then (Asia opens on Sunday evening). */
export function weekdayRows(trades: Trade[]): Row[] {
  const rows = A.breakdown(trades, (t) => String(new Date(t.entry_date).getDay()), dayName);
  return DAY_ORDER.map((k) => rows.find((r) => r.key === k) ?? empty(k, dayName(k)))
    .filter((r, i) => i < 5 || r.count > 0);
}

export const strategyRows = (trades: Trade[], strategies: Strategy[]) => A.byStrategy(trades, strategies).sort(byNetDesc);
export const symbolRows = (trades: Trade[]) => A.bySymbol(trades).sort(byNetDesc);
export function sideRows(trades: Trade[]): Row[] {
  const rows = A.bySide(trades);
  return [rows.find((r) => r.key === 'long') ?? empty('long', 'Long'), rows.find((r) => r.key === 'short') ?? empty('short', 'Short')];
}
export function emotionRows(trades: Trade[]): Row[] {
  const rows = A.breakdown(trades, (t) => t.emotions || 'none', (k) => (k === 'none' ? 'Not recorded' : k[0].toUpperCase() + k.slice(1)));
  const named = rows.filter((r) => r.key !== 'none').sort((a, b) => b.count - a.count);
  const none = rows.find((r) => r.key === 'none');
  return none ? [...named, none] : named;
}
export function tierRows(trades: Trade[]): Row[] {
  const rows = A.breakdown(trades,
    (t) => (t.confluence_score == null ? 'none' : A.CONFLUENCE_TIERS.find((x) => t.confluence_score! >= x.lo && t.confluence_score! < x.hi)?.key ?? 'none'),
    (k) => (k === 'none' ? 'Not scored' : A.CONFLUENCE_TIERS.find((x) => x.key === k)!.label));
  const out = A.CONFLUENCE_TIERS.map((x) => rows.find((r) => r.key === x.key)).filter(Boolean) as Row[];
  const none = rows.find((r) => r.key === 'none');
  return none ? [...out, none] : out;
}

/** Index of the best row by net: only rows with enough trades and a positive result qualify. */
export function bestIndex(rows: Row[]): number {
  let best = -1;
  rows.forEach((r, i) => { if (r.count >= MIN_N && r.net > 0 && (best < 0 || r.net > rows[best].net)) best = i; });
  return best;
}

// ---------- weekday x session ----------

export interface MCell { net: number; count: number }
export interface MatrixData {
  rows: { key: string; label: string }[];
  cols: { key: string; label: string; short: string }[];
  cells: (MCell | null)[][];
  rowTotals: MCell[];
  colTotals: MCell[];
  total: MCell;
  best: [number, number] | null;
}
const SHORT: Record<string, string> = { asia: 'Asia', london: 'London', 'new-york-am': 'NY AM', 'new-york-lunch': 'Lunch', 'new-york-pm': 'NY PM', none: 'None' };

export function matrixData(trades: Trade[]): MatrixData {
  const closed = trades.filter(A.isClosed);
  const dayKeys = DAY_ORDER.filter((k, i) => i < 5 || closed.some((t) => String(new Date(t.entry_date).getDay()) === k));
  const hasNone = closed.some((t) => !t.session);
  const cols = [...SESSIONS.map((s) => ({ key: s.key as string, label: s.label, short: SHORT[s.key] })), ...(hasNone ? [{ key: 'none', label: 'No session', short: 'None' }] : [])];
  const rows = dayKeys.map((k) => ({ key: k, label: dayName(k) }));
  const cells: (MCell | null)[][] = rows.map(() => cols.map(() => null));
  const rowTotals: MCell[] = rows.map(() => ({ net: 0, count: 0 }));
  const colTotals: MCell[] = cols.map(() => ({ net: 0, count: 0 }));
  const total: MCell = { net: 0, count: 0 };
  for (const t of closed) {
    const r = dayKeys.indexOf(String(new Date(t.entry_date).getDay()));
    const c = cols.findIndex((x) => x.key === (t.session ?? 'none'));
    if (r < 0 || c < 0) continue;
    const p = A.pnlOf(t);
    const cell = cells[r][c] ?? (cells[r][c] = { net: 0, count: 0 });
    cell.net += p; cell.count++;
    rowTotals[r].net += p; rowTotals[r].count++;
    colTotals[c].net += p; colTotals[c].count++;
    total.net += p; total.count++;
  }
  let best: [number, number] | null = null;
  cells.forEach((row, r) => row.forEach((x, c) => {
    if (x && x.count >= MIN_N && x.net > 0 && (!best || x.net > cells[best[0]][best[1]]!.net)) best = [r, c];
  }));
  return { rows, cols, cells, rowTotals, colTotals, total, best };
}

// ---------- checklist items ----------

export interface Split { n: number; winRate: number | null; avgR: number | null; expectancy: number | null; net: number }
export type Verdict = 'earns' | 'none' | 'worse' | 'few';
export interface ItemRow {
  id: string; name: string; category: string | null; weight: number | null;
  scored: number; present: Split; absent: Split; diffR: number | null; verdict: Verdict;
}
const split = (ts: Trade[]): Split => {
  const s = A.summarize(ts);
  return { n: s.count, winRate: s.winRate, avgR: s.avgR, expectancy: s.expectancy, net: s.net };
};
export const EDGE_R = 0.15;

/** For each checklist item: how the trades ticked with it did against the trades where it was missing. */
export function itemStats(trades: Trade[], items: ConfluenceItem[], links: TradeConfluence[]): ItemRow[] {
  const closed = new Map(trades.filter(A.isClosed).map((t) => [t.id, t]));
  const per = new Map<string, { yes: Trade[]; no: Trade[] }>();
  for (const l of links) {
    const t = closed.get(l.trade_id);
    if (!t) continue;
    const g = per.get(l.confluence_item_id) ?? { yes: [], no: [] };
    (l.is_present ? g.yes : g.no).push(t);
    per.set(l.confluence_item_id, g);
  }
  const rows: ItemRow[] = [];
  for (const it of items) {
    const g = per.get(it.id);
    if (!g) continue;
    const present = split(g.yes), absent = split(g.no);
    const diffR = present.avgR != null && absent.avgR != null ? present.avgR - absent.avgR : null;
    const judged = present.n >= MIN_N && absent.n >= MIN_N && diffR != null;
    const verdict: Verdict = !judged ? 'few' : diffR! >= EDGE_R ? 'earns' : diffR! <= -EDGE_R ? 'worse' : 'none';
    rows.push({ id: it.id, name: it.name, category: it.category, weight: it.weight, scored: g.yes.length + g.no.length, present, absent, diffR, verdict });
  }
  const rank = (r: ItemRow) => (r.verdict === 'few' ? 1 : 0);
  return rows.sort((a, b) => rank(a) - rank(b) || (b.diffR ?? -99) - (a.diffR ?? -99));
}

// ---------- mistakes ----------

export interface MistakeLine { tag: string; count: number; cost: number; avg: number; share: number | null }
export function mistakeLines(trades: Trade[], mistakes: TradeMistake[]) {
  const closed = trades.filter(A.isClosed);
  const grossLoss = closed.reduce((x, t) => x + Math.max(0, -A.pnlOf(t)), 0);
  const lines: MistakeLine[] = A.mistakeCosts(closed, mistakes).map((m) => ({
    tag: m.tag, count: m.count, cost: m.cost, avg: m.count ? m.cost / m.count : 0, share: grossLoss > 0 ? (-m.cost / grossLoss) * 100 : null,
  }));
  const flagged = new Set(mistakes.map((m) => m.trade_id));
  const tagged = closed.filter((t) => flagged.has(t.id));
  const distinctCost = tagged.reduce((x, t) => x + Math.min(0, A.pnlOf(t)), 0);
  return {
    lines, grossLoss,
    distinct: { count: tagged.length, cost: distinctCost, avg: tagged.length ? distinctCost / tagged.length : 0, share: grossLoss > 0 ? (-distinctCost / grossLoss) * 100 : null },
  };
}

export function cleanFlagged(trades: Trade[], mistakes: TradeMistake[]) {
  const flagged = new Set(mistakes.map((m) => m.trade_id));
  const closed = trades.filter(A.isClosed);
  return { clean: A.summarize(closed.filter((t) => !flagged.has(t.id))), flagged: A.summarize(closed.filter((t) => flagged.has(t.id))) };
}

// ---------- periods ----------

export type Span = 'weeks' | 'months';
export interface PeriodRow {
  key: string; label: string; sub: string | null; start: number; end: number; partial: boolean;
  trades: Trade[]; s: A.Summary; days: A.Day[]; bestDay: A.Day | null; worstDay: A.Day | null; planPct: number | null;
}
const mmdd = (d: Date) => isoDate(d).slice(5);
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });

/** The last 12 weeks (Mon to Sun) or calendar months, newest first. Trades are placed by close time. */
export function buildPeriods(trades: Trade[], mistakes: TradeMistake[], span: Span, now = new Date()): PeriodRow[] {
  const today = A.startOfDay(now);
  const out: PeriodRow[] = [];
  for (let i = 0; i < 12; i++) {
    let start: Date, end: Date, label: string;
    if (span === 'weeks') {
      const lead = (today.getDay() + 6) % 7;
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - lead - 7 * i);
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
      label = `${isoDate(start)} → ${start.getFullYear() === last.getFullYear() ? mmdd(last) : isoDate(last)}`;
    } else {
      start = new Date(today.getFullYear(), today.getMonth() - i, 1);
      end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      label = MONTH.format(start);
    }
    const ts = A.inWindow(trades.filter(A.isClosed), [start.getTime(), end.getTime()]);
    const days = [...A.dailyMap(ts).values()].sort((a, b) => a.date.localeCompare(b.date));
    const byPnl = [...days].sort((a, b) => b.pnl - a.pnl);
    const partial = now.getTime() < end.getTime();
    out.push({
      key: isoDate(start), label, sub: partial ? (span === 'weeks' ? 'in progress' : 'to date') : null,
      start: start.getTime(), end: end.getTime(), partial, trades: ts, s: A.summarize(ts), days,
      bestDay: byPnl[0] ?? null, worstDay: byPnl[byPnl.length - 1] ?? null,
      planPct: A.planAdherence(ts, mistakes)?.pct ?? null,
    });
  }
  return out;
}

// ---------- CSV ----------

const csvCell = (v: string | number | null | undefined) => {
  if (v == null) return '""';
  if (typeof v === 'number') return `"${v}"`;
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; // spreadsheet formula guard on text only
  return `"${safe.replace(/"/g, '""')}"`;
};

export function tradesCsv(trades: Trade[], accounts: Account[], strategies: Strategy[], mistakes: TradeMistake[]): string {
  const head = ['Trade ID', 'Account', 'Symbol', 'Side', 'Setup', 'Session', 'Status', 'Opened', 'Closed', 'Quantity', 'Entry', 'Exit', 'Stop', 'Target', 'P&L', 'R', 'Risk', 'Commission', 'Checklist score', 'Emotion', 'Mistakes'];
  const tags = new Map<string, string[]>();
  for (const m of mistakes) (tags.get(m.trade_id) ?? tags.set(m.trade_id, []).get(m.trade_id)!).push(m.mistake_tag);
  const sorted = [...trades].sort((a, b) => +new Date(a.entry_date) - +new Date(b.entry_date));
  const body = sorted.map((t) => {
    const r = A.rOf(t);
    return [
      t.id, accounts.find((a) => a.id === t.trading_account_id)?.name ?? '', t.symbol, t.trade_type,
      strategies.find((s) => s.id === t.strategy_id)?.name ?? '', t.session ? sessionLabel(t.session) : '', t.status,
      t.entry_date, t.exit_date, t.quantity, t.entry_price, t.exit_price, t.stop_loss, t.take_profit, t.pnl,
      r == null ? null : Math.round(r * 100) / 100, t.risk_amount, t.commission, t.confluence_score, t.emotions, (tags.get(t.id) ?? []).join('; '),
    ].map(csvCell).join(',');
  });
  return '﻿' + [head.map(csvCell).join(','), ...body].join('\r\n') + '\r\n';
}

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** What follows a result: win rate on the trade after a win and after a loss, in closing order. */
export function afterResult(trades: Trade[]) {
  const seq = trades.filter(A.isClosed).sort((a, b) => A.closeTime(a) - A.closeTime(b));
  const acc = { W: { n: 0, wins: 0 }, L: { n: 0, wins: 0 } };
  for (let i = 1; i < seq.length; i++) {
    const prev = A.pnlOf(seq[i - 1]);
    const k = prev > 0 ? 'W' : prev < 0 ? 'L' : null;
    const next = A.pnlOf(seq[i]);
    if (!k || next === 0) continue; // win rate counts decided trades only, as everywhere else
    acc[k].n++;
    if (next > 0) acc[k].wins++;
  }
  const rate = (x: { n: number; wins: number }) => (x.n ? (x.wins / x.n) * 100 : null);
  return { afterWin: { n: acc.W.n, rate: rate(acc.W) }, afterLoss: { n: acc.L.n, rate: rate(acc.L) } };
}
