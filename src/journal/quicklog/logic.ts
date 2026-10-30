// Quick log: pure helpers. A quick log records what a trader can answer in a few taps (pair, side, result,
// state of mind, what cost the loss) and leaves prices and size empty (NULL in the database, shown as a dash).

import type { SessionKey, Trade, TradeMistake } from '../types';
import { isClosed, pnlOf } from '../analytics';

export interface Mood { label: string; emoji: string; emotion: string; hue: number }

/** Seven stops on the pleasant / unpleasant scale; `emotion` is the word stored on the trade (same vocabulary as the full form). */
export const MOODS: Mood[] = [
  { label: 'Very unpleasant', emoji: '😫', emotion: 'stressed', hue: 350 },
  { label: 'Unpleasant', emoji: '😟', emotion: 'fearful', hue: 18 },
  { label: 'Slightly unpleasant', emoji: '😕', emotion: 'doubtful', hue: 42 },
  { label: 'Neutral', emoji: '😐', emotion: 'calm', hue: 200 },
  { label: 'Slightly pleasant', emoji: '🙂', emotion: 'focused', hue: 188 },
  { label: 'Pleasant', emoji: '😌', emotion: 'confident', hue: 170 },
  { label: 'Very pleasant', emoji: '🤩', emotion: 'excited', hue: 150 },
];
export const moodAt = (v: number) => MOODS[Math.min(MOODS.length - 1, Math.floor((v / 100) * MOODS.length))];

export type Result = 'win' | 'loss' | 'flat';

export interface Reason { key: string; emoji: string; label: string; hint: string; tag: string | null; severity: 'low' | 'medium' | 'high' }
/** What cost the loss. `tag` is the mistake tag written to the journal; null means "not a mistake". */
export const LOSS_REASONS: Reason[] = [
  { key: 'fomo', emoji: '🏃', label: 'FOMO', hint: 'Chased it', tag: 'FOMO entry', severity: 'medium' },
  { key: 'size', emoji: '🐘', label: 'Oversized', hint: 'Too big for the account', tag: 'Oversized', severity: 'high' },
  { key: 'greed', emoji: '🤑', label: 'Greed', hint: 'Wanted more', tag: 'Greed', severity: 'medium' },
  { key: 'tilt', emoji: '😤', label: 'Tilt', hint: 'Revenge after a loss', tag: 'Revenge trade', severity: 'high' },
  { key: 'stop', emoji: '🎯', label: 'Moved my stop', hint: 'Gave it more room', tag: 'Moved stop loss', severity: 'medium' },
  { key: 'plan', emoji: '📵', label: 'Ignored the plan', hint: 'No setup, took it anyway', tag: 'Ignored the plan', severity: 'high' },
  { key: 'early', emoji: '⏱️', label: 'Too early', hint: 'Entered before confirmation', tag: 'Impatient entry', severity: 'low' },
  { key: 'clean', emoji: '⚙️', label: 'Mechanical loss', hint: 'Followed the plan. It just lost', tag: null, severity: 'low' },
];

export const WIN_NOTES = [
  { key: 'patient', emoji: '🧘', label: 'Waited for it' },
  { key: 'plan', emoji: '📋', label: 'Followed the plan' },
  { key: 'runner', emoji: '🏃', label: 'Let it run' },
  { key: 'lucky', emoji: '🍀', label: 'Got a bit lucky' },
];

export const R_CHIPS: Record<Result, number[]> = { win: [1, 2, 3, 5], loss: [-0.5, -1, -1.5, -2], flat: [] };

/** Which trading session is open now, from New York time (the sessions are defined in ET). */
export function sessionNow(d = new Date()): SessionKey | null {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value) % 24 + Number(parts.find((p) => p.type === 'minute')?.value) / 60;
  if (h >= 20 || h < 0.5) return 'asia';
  if (h >= 2 && h < 5) return 'london';
  if (h >= 8.5 && h < 11) return 'new-york-am';
  if (h >= 12 && h < 13.5) return 'new-york-lunch';
  if (h >= 13.5 && h < 16) return 'new-york-pm';
  return null;
}

/** The size the trader usually risks on an account: the median risk of its last 20 closed trades. */
export function usualRisk(trades: Trade[], accountId: string): number | null {
  const r = trades.filter((t) => t.trading_account_id === accountId && isClosed(t) && t.risk_amount && t.risk_amount > 0)
    .sort((a, b) => +new Date(b.entry_date) - +new Date(a.entry_date)).slice(0, 20).map((t) => t.risk_amount!).sort((a, b) => a - b);
  if (!r.length) return null;
  const m = Math.floor(r.length / 2);
  const med = r.length % 2 ? r[m] : (r[m - 1] + r[m]) / 2;
  return med >= 50 ? Math.round(med) : Math.round(med * 100) / 100;
}

export function recentSymbols(trades: Trade[], limit = 6): string[] {
  const c = new Map<string, number>();
  for (const t of trades.slice(0, 120)) c.set(t.symbol, (c.get(t.symbol) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([s]) => s);
}

/** One sentence of feedback shown after saving, written from the journal's own history. */
export function afterNote(args: {
  result: Result; trades: Trade[]; mistakes: TradeMistake[]; accountId: string; tags: string[]; clean: boolean; pnl: number; currency: string;
}): string {
  const { result, trades, mistakes, accountId, tags, clean } = args;
  const mine = trades.filter((t) => t.trading_account_id === accountId && isClosed(t)).sort((a, b) => +new Date(b.entry_date) - +new Date(a.entry_date));
  if (result === 'win') {
    let run = 1;
    for (const t of mine) { if (pnlOf(t) > 0) run++; else break; }
    return run >= 3 ? `Win number ${run} in a row 🔥 Keep the process the same.` : 'Logged. A win you wrote down is a win you can repeat.';
  }
  if (result === 'flat') return 'Scratched and logged. Protecting capital is a skill too.';
  if (clean) {
    const losses = mine.filter((t) => pnlOf(t) < 0).slice(0, 12);
    const flagged = new Set(mistakes.map((m) => m.trade_id));
    const cleanLosses = losses.filter((t) => !flagged.has(t.id)).length + 1;
    return `A clean loss. ${cleanLosses} of your last ${losses.length + 1} losses followed the plan. That's the cost of doing business.`;
  }
  const tag = tags[0];
  if (tag) {
    const since = Date.now() - 30 * 86400000;
    const ids = new Set(mine.filter((t) => +new Date(t.entry_date) >= since).map((t) => t.id));
    const n = mistakes.filter((m) => m.mistake_tag === tag && ids.has(m.trade_id)).length + 1;
    return n === 1 ? `First “${tag}” in 30 days. Name it now, and it loses its grip.` : `That's “${tag}” number ${n} in 30 days. It's a pattern worth a rule.`;
  }
  return 'Logged. Next one: check the plan before you click.';
}
