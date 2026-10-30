// One place for every figure format: money 2 decimals, signs on changes, ISO dates in tables,
// a real minus (U+2212) so a column of signed figures lines up in the mono face.

const MINUS = '−';
const nf = (min: number, max = min) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });
const n0 = nf(0);
const n1 = nf(1);
const n2 = nf(2);

const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', AUD: 'A$', CAD: 'C$' };
export const currencySign = (c = 'USD') => SYMBOLS[c] ?? `${c} `;

export function money(v: number | null | undefined, currency = 'USD', opts: { sign?: boolean; decimals?: 0 | 2 } = {}) {
  if (v == null || Number.isNaN(v)) return '—';
  const f = opts.decimals === 0 ? n0 : n2;
  const body = f.format(Math.abs(v));
  const s = currencySign(currency);
  if (v < 0) return `${MINUS}${s}${body}`;
  if (opts.sign && v > 0) return `+${s}${body}`;
  return `${s}${body}`;
}

export function signed(v: number | null | undefined, decimals = 2, suffix = '') {
  if (v == null || Number.isNaN(v)) return '—';
  const f = nf(decimals);
  const body = f.format(Math.abs(v));
  if (v < 0) return `${MINUS}${body}${suffix}`;
  if (v > 0) return `+${body}${suffix}`;
  return `${body}${suffix}`;
}

export const pct = (v: number | null | undefined, decimals = 1) =>
  v == null || Number.isNaN(v) ? '—' : `${nf(decimals).format(v)}%`;

export const signedPct = (v: number | null | undefined, decimals = 1) => signed(v, decimals, '%');

export const rMult = (v: number | null | undefined, decimals = 2) =>
  v == null || Number.isNaN(v) ? '—' : signed(v, decimals, 'R');

export const int = (v: number) => n0.format(v);
export const dec1 = (v: number) => n1.format(v);
export const dec2 = (v: number) => n2.format(v);

export const price = (v: number | null | undefined) => {
  if (v == null || v === 0) return '—'; // quick-logged trades carry no prices
  const d = Math.abs(v) >= 1000 ? 2 : Math.abs(v) >= 10 ? 3 : 5;
  return nf(d).format(v);
};

export const tone = (v: number | null | undefined): 'pos' | 'neg' | 'flat' =>
  v == null || v === 0 ? 'flat' : v > 0 ? 'pos' : 'neg';

// Dates: stored as ISO timestamps, shown in the viewer's local zone.
const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
export const timeHM = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
export const dayLabel = (d: Date | string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d));
export const monthLabel = (d: Date | string) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(d));
export const shortDate = (d: Date | string) =>
  new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(new Date(d));

export function duration(from: string, to: string | null) {
  if (!to) return '—';
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 0) return '—';
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${pad(m % 60)}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function relativeDay(d: string | Date) {
  const x = new Date(d);
  const now = new Date();
  const a = new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((b - a) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return isoDate(x);
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '·';

/** +1.2k / −830: a signed figure short enough for a narrow cell. */
export function compact(v: number) {
  const a = Math.abs(v);
  const body = a >= 1000 ? `${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `${Math.round(a)}`;
  return v < 0 ? `${MINUS}${body}` : v > 0 ? `+${body}` : body;
}

/** Position size; quick-logged trades have none. */
export const qty = (v: number | null | undefined) => (v == null || v === 0 ? '—' : String(v));
