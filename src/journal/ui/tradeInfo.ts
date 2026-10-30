// Derived facts about one trade, shared by the Journal list, the inspector and the full trade page.
// Nothing here is stored: every figure is computed from the rows.

import { rOf } from '../analytics';
import type { ConfluenceItem, Trade, TradeConfluence, TradeMistake } from '../types';

export type Result = 'won' | 'lost' | 'flat' | 'open' | 'cancelled';

export const RESULTS: { key: Result; label: string }[] = [
  { key: 'won', label: 'Won' }, { key: 'lost', label: 'Lost' }, { key: 'flat', label: 'Flat' }, { key: 'open', label: 'Open' },
];

export function resultOf(t: Trade): Result {
  if (t.status === 'open') return 'open';
  if (t.status === 'cancelled') return 'cancelled';
  if (t.pnl == null || t.pnl === 0) return 'flat';
  return t.pnl > 0 ? 'won' : 'lost';
}

export const resultLabel = (r: Result) => (r === 'won' ? 'Won' : r === 'lost' ? 'Lost' : r === 'flat' ? 'Flat' : r === 'open' ? 'Open' : 'Cancelled');
export const resultKind = (r: Result): 'pos' | 'neg' | 'warn' | undefined => (r === 'won' ? 'pos' : r === 'lost' ? 'neg' : r === 'open' ? 'warn' : undefined);

export interface ChecklistRow { item: ConfluenceItem; present: boolean }
export interface Checklist { rows: ChecklistRow[]; present: number; total: number; score: number | null }

/** Every active confluence item against this trade; an item with no row for the trade counts as missing. */
export function checklistFor(trade: Trade, items: ConfluenceItem[], links: TradeConfluence[]): Checklist {
  const mine = links.filter((l) => l.trade_id === trade.id);
  if (!mine.length) return { rows: [], present: 0, total: 0, score: trade.confluence_score };
  const byItem = new Map(mine.map((l) => [l.confluence_item_id, l.is_present]));
  const rows = items.filter((i) => i.is_active || byItem.has(i.id)).map((item) => ({ item, present: byItem.get(item.id) === true }));
  const w = (r: ChecklistRow) => r.item.weight ?? 1;
  const total = rows.reduce((s, r) => s + w(r), 0);
  const got = rows.filter((r) => r.present).reduce((s, r) => s + w(r), 0);
  return { rows, present: rows.filter((r) => r.present).length, total: rows.length, score: total ? Math.round((got / total) * 100) : trade.confluence_score };
}

export const mistakesFor = (trade: Trade, all: TradeMistake[]) => all.filter((m) => m.trade_id === trade.id);

export const byEntryDesc = (a: Trade, b: Trade) => +new Date(b.entry_date) - +new Date(a.entry_date);

export const sideWord = (t: Trade) => (t.trade_type === 'long' ? 'long' : 'short');
export { rOf };
