// Pure helpers for the trade form: defaults, parsing, auto-calculation, validation, draft storage.
// Nothing here touches React or the network.

import type { Account, ConfluenceItem, Side, Trade, TradeMistake, TradeConfluence } from '../../types';
import { isoDate, timeHM } from '../../format';

// ---------- constants ----------

/** Dollars per point for the futures the form can price on its own. */
export const POINT_VALUE: Record<string, number> = {
  NQ: 20, MNQ: 2, ES: 50, MES: 5, GC: 100, MGC: 10, CL: 1000, YM: 5, MYM: 0.5, RTY: 50, M2K: 5,
};

export const EMOTIONS = [
  'confident', 'nervous', 'excited', 'fearful', 'greedy', 'patient', 'impatient',
  'calm', 'stressed', 'doubtful', 'focused', 'distracted', 'frustrated',
];

export const DEFAULT_MISTAKES = ['FOMO entry', 'Moved stop loss', 'Cut winner early', 'Oversized', 'Revenge trade', 'Ignored the plan'];

export const MAX_SHOTS = 5;
export const MAX_SHOT_BYTES = 5 * 1024 * 1024;

export type Severity = 'low' | 'medium' | 'high';

/** A screenshot is either already stored (url) or a new file waiting for upload (file + a local preview url). */
export interface Shot { id: string; url: string; file?: File }

export interface MistakeEntry { tag: string; severity: Severity; note: string }

export interface FormState {
  account: string;
  symbol: string;
  side: Side | '';
  status: 'open' | 'closed';
  session: string;
  strategy: string;
  entryDate: string; entryTime: string;
  exitDate: string; exitTime: string;
  entry: string; exit: string; size: string; stop: string; target: string;
  commission: string; swap: string; risk: string; result: string;
  conf: Record<string, boolean>;
  emotion: string;
  mistakes: MistakeEntry[];
  notes: string;
  shots: Shot[];
}

export type FieldKey =
  | 'account' | 'symbol' | 'side' | 'entry' | 'exit' | 'size' | 'entryDate' | 'entryTime' | 'exitDate' | 'exitTime' | 'result';

// ---------- numbers ----------

export const num = (s: string): number | null => {
  if (s == null || s.trim() === '') return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
export const toStr = (v: number | null | undefined) => (v == null ? '' : String(v));

/** Point value for a symbol, tolerating contract months and continuous suffixes (NQZ5, NQ1!, MNQ 12-25). */
export function pointValue(symbol: string): number | null {
  const s = symbol.trim().toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^(MNQ|MES|MGC|MYM|M2K|NQ|ES|GC|CL|YM|RTY)(?:[FGHJKMNQUVXZ]\d{1,2}|\d{1,2}!?|!)?(?:\d{1,2}-\d{2,4})?$/);
  return m ? POINT_VALUE[m[1]] : null;
}
export const baseSymbol = (symbol: string): string | null => {
  const s = symbol.trim().toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^(MNQ|MES|MGC|MYM|M2K|NQ|ES|GC|CL|YM|RTY)/);
  return m && pointValue(symbol) != null ? m[1] : null;
};

/** Gross result from the prices. Fees are kept apart, as the journal stores them apart. */
export function autoResult(f: Pick<FormState, 'symbol' | 'side' | 'entry' | 'exit' | 'size'>): number | null {
  const pv = pointValue(f.symbol); const e = num(f.entry), x = num(f.exit), q = num(f.size);
  if (pv == null || !f.side || e == null || x == null || q == null || q <= 0) return null;
  return round((f.side === 'long' ? 1 : -1) * (x - e) * q * pv);
}
export function autoRisk(f: Pick<FormState, 'symbol' | 'entry' | 'stop' | 'size'>): number | null {
  const pv = pointValue(f.symbol); const e = num(f.entry), s = num(f.stop), q = num(f.size);
  if (pv == null || e == null || s == null || q == null || q <= 0 || e === s) return null;
  return round(Math.abs(e - s) * q * pv);
}
export function plannedRR(f: Pick<FormState, 'entry' | 'stop' | 'target'>): number | null {
  const e = num(f.entry), s = num(f.stop), t = num(f.target);
  if (e == null || s == null || t == null || e === s) return null;
  return Math.abs(t - e) / Math.abs(e - s);
}

/** Weighted share of the checklist present, rounded: exactly how demo.ts scores a trade. */
export function confluenceScore(items: ConfluenceItem[], conf: Record<string, boolean>) {
  const total = items.reduce((s, c) => s + (c.weight ?? 1), 0);
  const have = items.filter((c) => conf[c.id]);
  const got = have.reduce((s, c) => s + (c.weight ?? 1), 0);
  return { count: have.length, of: items.length, pct: total > 0 ? Math.round((got / total) * 100) : 0 };
}

// ---------- dates ----------

export const toIso = (date: string, time: string) => new Date(`${date}T${time || '00:00'}`);
const valid = (d: Date) => !Number.isNaN(d.getTime());

// ---------- defaults and loading ----------

export function blankState(accountId: string): FormState {
  const now = new Date();
  return {
    account: accountId, symbol: '', side: '', status: 'open', session: '', strategy: '',
    entryDate: isoDate(now), entryTime: timeHM(now), exitDate: '', exitTime: '',
    entry: '', exit: '', size: '', stop: '', target: '', commission: '', swap: '', risk: '', result: '',
    conf: {}, emotion: '', mistakes: [], notes: '', shots: [],
  };
}

export function stateFromTrade(t: Trade, conf: TradeConfluence[], mistakes: TradeMistake[]): FormState {
  const c: Record<string, boolean> = {};
  for (const r of conf) if (r.trade_id === t.id) c[r.confluence_item_id] = r.is_present;
  return {
    account: t.trading_account_id, symbol: t.symbol, side: t.trade_type, status: t.status === 'closed' ? 'closed' : 'open',
    session: t.session ?? '', strategy: t.strategy_id ?? '',
    entryDate: isoDate(t.entry_date), entryTime: timeHM(t.entry_date),
    exitDate: t.exit_date ? isoDate(t.exit_date) : '', exitTime: t.exit_date ? timeHM(t.exit_date) : '',
    entry: toStr(t.entry_price), exit: toStr(t.exit_price), size: toStr(t.quantity), stop: toStr(t.stop_loss), target: toStr(t.take_profit),
    commission: toStr(t.commission), swap: toStr(t.swap), risk: toStr(t.risk_amount), result: toStr(t.pnl),
    conf: c, emotion: t.emotions ?? '',
    mistakes: mistakes.filter((m) => m.trade_id === t.id).map((m) => ({ tag: m.mistake_tag, severity: m.severity ?? 'medium', note: m.description ?? '' })),
    notes: t.notes ?? '',
    shots: (t.screenshots ?? []).map((u, i) => ({ id: `old-${i}`, url: u })),
  };
}

export function defaultAccount(accounts: Account[], scope: string): string {
  const scoped = accounts.find((a) => a.id === scope);
  if (scoped) return scoped.id;
  return (accounts.find((a) => a.is_active) ?? accounts[0])?.id ?? '';
}

// ---------- validation ----------

export type Errors = Partial<Record<FieldKey, string>>;

export function validate(f: FormState): Errors {
  const e: Errors = {};
  if (!f.account) e.account = 'Choose the account this trade belongs to.';
  if (!f.symbol.trim()) e.symbol = 'Enter the instrument, for example NQ or EURUSD.';
  if (!f.side) e.side = 'Choose long or short.';
  const en = num(f.entry);
  if (en == null || en <= 0) e.entry = 'Enter the entry price.';
  const q = num(f.size);
  if (q == null || q <= 0) e.size = 'Enter a size above zero.';
  if (!f.entryDate) e.entryDate = 'Enter the entry date.';
  else if (!valid(toIso(f.entryDate, f.entryTime))) e.entryDate = 'That date is not valid.';
  if (!f.entryTime) e.entryTime = 'Enter the entry time.';
  if (f.status === 'closed') {
    const x = num(f.exit);
    if (x == null || x <= 0) e.exit = 'Enter the exit price for a closed trade.';
    if (!f.exitDate) e.exitDate = 'Enter the exit date.';
    else if (!f.exitTime) e.exitTime = 'Enter the exit time.';
    else if (!e.entryDate && !e.entryTime && toIso(f.exitDate, f.exitTime) <= toIso(f.entryDate, f.entryTime)) e.exitDate = 'Exit must come after the entry.';
    if (num(f.result) == null && autoResult(f) == null) e.result = 'Enter the result so the trade counts in your numbers.';
  }
  return e;
}

/** Soft checks that never block saving. */
export function sideWarnings(f: FormState): { stop?: string; target?: string } {
  const e = num(f.entry), s = num(f.stop), t = num(f.target);
  const w: { stop?: string; target?: string } = {};
  if (!f.side || e == null) return w;
  if (s != null && (f.side === 'long' ? s >= e : s <= e)) w.stop = `A stop for a ${f.side} sits ${f.side === 'long' ? 'below' : 'above'} the entry.`;
  if (t != null && (f.side === 'long' ? t <= e : t >= e)) w.target = `A target for a ${f.side} sits ${f.side === 'long' ? 'above' : 'below'} the entry.`;
  return w;
}

// ---------- drafts ----------

const draftKey = (uid: string | null) => `ifvg-trade-draft:${uid ?? 'anon'}`;

/** What a draft keeps: everything except files that are not uploaded yet. */
const forDraft = (f: FormState) => ({ ...f, shots: f.shots.filter((s) => !s.file) });

export function readDraft(uid: string | null): FormState | null {
  try {
    const raw = localStorage.getItem(draftKey(uid));
    if (!raw) return null;
    const d = JSON.parse(raw) as FormState;
    if (!d || typeof d !== 'object' || typeof d.symbol !== 'string') return null;
    return { ...blankState(d.account ?? ''), ...d, shots: Array.isArray(d.shots) ? d.shots : [], mistakes: Array.isArray(d.mistakes) ? d.mistakes : [], conf: d.conf ?? {} };
  } catch { return null; }
}
export function writeDraft(uid: string | null, f: FormState) {
  try { localStorage.setItem(draftKey(uid), JSON.stringify(forDraft(f))); } catch { /* storage blocked or full */ }
}
export function clearDraft(uid: string | null) {
  try { localStorage.removeItem(draftKey(uid)); } catch { /* storage blocked */ }
}

/** A stable string of the parts that matter, to tell whether the form has changed since it was loaded. */
export const fingerprint = (f: FormState) =>
  JSON.stringify({ ...f, shots: f.shots.map((s) => s.id) });
