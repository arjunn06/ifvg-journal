import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { money, signed, tone } from '../format';
import { PERIODS, type Period } from '../analytics';

/** The IFVG mark: three candles and the imbalance between the first and the third. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="4" y="16" width="5" height="8" fill="#fff" />
      <line x1="6.5" y1="13" x2="6.5" y2="27" stroke="#fff" strokeWidth="1.2" />
      <rect x="11.5" y="8" width="5" height="11" fill="#fff" />
      <line x1="14" y1="4" x2="14" y2="22" stroke="#fff" strokeWidth="1.2" />
      <rect x="19" y="3" width="5" height="9" fill="#fff" />
      <line x1="21.5" y1="1" x2="21.5" y2="14" stroke="#fff" strokeWidth="1.2" />
      <rect x="4" y="12" width="20" height="4" fill="var(--sig)" />
    </svg>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="j-title-row">
      <div style={{ minWidth: 0 }}>
        <h1>{title}</h1>
        {sub && <p className="j-sub">{sub}</p>}
      </div>
      {actions && <div className="j-actions">{actions}</div>}
    </div>
  );
}

export function Panel({
  title, meta, action, children, className = '', style,
}: { title?: ReactNode; meta?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`j-panel ${className}`} style={style}>
      {(title || meta || action) && (
        <header>
          {title && <h2>{title}</h2>}
          <span style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
            {meta && <span className="j-meta">{meta}</span>}
            {action}
          </span>
        </header>
      )}
      {children}
    </section>
  );
}

export interface KpiDef { label: string; value: ReactNode; unit?: string; note?: ReactNode; lead?: boolean; tone?: 'pos' | 'neg' | 'flat' }
export function Kpis({ items }: { items: KpiDef[] }) {
  return (
    <div className={`j-kpis ${items[0]?.lead ? 'has-lead' : ''}`} role="group" aria-label="Key figures"
      style={items[0]?.lead ? ({ '--cols': `minmax(0, 1.5fr) repeat(${items.length - 1}, minmax(0, 1fr))` } as React.CSSProperties) : undefined}>
      {items.map((k) => (
        <div key={k.label} className={`j-kpi ${k.lead ? 'lead' : ''}`}>
          <div className="j-kpi-label">{k.label}</div>
          <div className={`j-kpi-value ${k.tone === 'neg' ? 'j-neg' : ''}`}>{k.value}{k.unit && <small>{k.unit}</small>}</div>
          {k.note && <div className="j-kpi-note">{k.note}</div>}
        </div>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, label, inline }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; count?: number }[]; label: string; inline?: boolean }) {
  return (
    <div className={`j-tabs ${inline ? 'tight' : ''}`} role="tablist" aria-label={label}>
      {items.map((i) => (
        <button key={i.key} role="tab" className="j-tab" aria-selected={value === i.key} onClick={() => onChange(i.key)}>
          {i.label}{i.count != null && <span className="j-count">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Range({ value, onChange, options = PERIODS }: { value: Period; onChange: (p: Period) => void; options?: { key: Period; label: string }[] }) {
  return (
    <div className="j-range" role="group" aria-label="Period">
      {options.map((o) => (
        <button key={o.key} aria-pressed={value === o.key} onClick={() => onChange(o.key)}>{o.label}</button>
      ))}
    </div>
  );
}

/** A signed figure; negative results take the loss colour, positive stay in ink unless `colour` is set. */
export function PnL({ v, currency = 'USD', decimals = 2, colour = true }: { v: number | null | undefined; currency?: string; decimals?: 0 | 2; colour?: boolean }) {
  if (v == null) return <span className="j-dim">—</span>;
  const t = tone(v);
  return <span className={`j-num ${colour ? (t === 'neg' ? 'j-neg' : t === 'pos' ? 'j-pos' : '') : ''}`}>{money(v, currency, { sign: true, decimals })}</span>;
}

export function Signed({ v, digits = 2, suffix = '' }: { v: number | null | undefined; digits?: number; suffix?: string }) {
  if (v == null) return <span className="j-dim">—</span>;
  const t = tone(v);
  return <span className={`j-num ${t === 'neg' ? 'j-neg' : t === 'pos' ? 'j-pos' : ''}`}>{signed(v, digits, suffix)}</span>;
}

export function Pill({ kind, children }: { kind?: 'pos' | 'neg' | 'warn'; children: ReactNode }) {
  return <span className={`j-pill ${kind ?? ''}`}>{children}</span>;
}

const HUES = [205, 155, 38, 350, 95, 185];
export function hueFor(i: number) { return HUES[i % HUES.length]; }
export function Avatar({ name, hue }: { name: string; hue: number }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  return <span className="j-avatar" style={{ background: `hsl(${hue} 32% 20%)`, color: `hsl(${hue} 62% 76%)` }} aria-hidden="true">{ini}</span>;
}

export function Empty({ children }: { children: ReactNode }) { return <div className="j-empty">{children}</div>; }

export function Skel({ w = 80, h = 14 }: { w?: number | string; h?: number }) {
  return <span className="j-skel" style={{ width: w, height: h }} aria-hidden="true" />;
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="j-error" role="alert">
      <span>{message}</span>
      {onRetry && <button className="j-link" style={{ marginLeft: 'auto', color: 'inherit', textDecoration: 'underline' }} onClick={onRetry}>Retry</button>}
    </div>
  );
}

/** Closes on Escape and outside press. */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  return { open, setOpen, ref };
}

export function Dialog({
  open, onClose, title, children, footer, wide,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="j-app" style={{ display: 'block', minHeight: 0, background: 'none' }}>
      <div className="j-scrim" onClick={onClose} />
      <div className="j-dialog" role="dialog" aria-modal="true" aria-labelledby={id} style={wide ? { width: 'min(760px, calc(100vw - 32px))' } : undefined}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id={id}>{title}</h2>
          <button className="j-icon-btn" onClick={onClose} aria-label="Close"><X /></button>
        </header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, body, confirmLabel = 'Delete',
}: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmLabel?: string }) {
  return (
    <Dialog open={open} onClose={onClose} title={title}
      footer={<><button className="j-btn" onClick={onClose}>Cancel</button><button className="j-btn danger" onClick={onConfirm}>{confirmLabel}</button></>}>
      <p style={{ color: 'var(--text-2)' }}>{body}</p>
    </Dialog>
  );
}

/** A thin ranked bar list: label, figures at the right, a 2px proportional bar underneath. */
export function RankList({
  rows,
}: { rows: { key: string; label: ReactNode; value: ReactNode; sub?: ReactNode; share: number }[] }) {
  if (!rows.length) return <Empty>Nothing to rank in this view.</Empty>;
  return (
    <div className="j-rank">
      {rows.map((r, i) => (
        <div key={r.key} className={`j-rank-row ${i === 0 ? 'top' : ''}`}>
          <span className="nm">{r.label}</span>
          <span className="sm j-num">{r.sub}</span>
          <span className="j-num" style={{ minWidth: 72, textAlign: 'right' }}>{r.value}</span>
          <span className="bar"><i style={{ width: `${Math.max(2, Math.min(100, r.share * 100))}%` }} /></span>
        </div>
      ))}
    </div>
  );
}
