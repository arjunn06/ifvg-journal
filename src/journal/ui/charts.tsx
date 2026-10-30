// SVG charts drawn to the system's rules: straight segments, 1px faint horizontal grid, no y-axis line,
// round ticks above the maximum, one hue per chart, a tooltip that is bare text.

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { money, shortDate, signed, rMult } from '../format';
import type { Bin, Day } from '../analytics';
import type { Trade } from '../types';
import { rOf } from '../analytics';

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function niceTicks(min: number, max: number, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const step0 = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const n = step0 / mag;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return { ticks, lo, hi };
}

export const axisFmt = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1_000_000 ? `${+(a / 1_000_000).toFixed(1)}M` : a >= 1000 ? `${+(a / 1000).toFixed(a % 1000 === 0 ? 0 : 1)}k` : `${a}`;
  return v < 0 ? `−${s}` : s;
};

interface Tip { x: number; y: number; title: string; value: string; note?: string }
function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div className="j-tip" style={{ left: tip.x, top: tip.y }}>
      <span>{tip.title}</span>
      <b>{tip.value}</b>
      {tip.note && <span>{tip.note}</span>}
    </div>
  );
}

// ---------- line ----------

export interface LinePoint { t: number; v: number; label?: string; note?: string }
export interface Ref { value: number; label: string; tone?: 'neg' | 'pos' | 'muted' }

export function LineChart({
  points, height = 260, refs = [], currency = 'USD', format, annotation, zeroBase = false, ariaLabel,
}: {
  points: LinePoint[];
  height?: number;
  refs?: Ref[];
  currency?: string;
  format?: (v: number) => string;
  annotation?: { t: number; label: string } | null;
  zeroBase?: boolean;
  ariaLabel: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const fmt = format ?? ((v: number) => money(v, currency));
  const padL = 48, padR = 12, padT = 12, padB = 26;
  const W = Math.max(w, 280), iw = W - padL - padR, ih = height - padT - padB;

  const geo = useMemo(() => {
    if (!points.length) return null;
    const vs = points.map((p) => p.v).concat(refs.map((r) => r.value));
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (zeroBase) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const pad = (hi - lo) * 0.06 || 1;
    const { ticks, lo: yLo, hi: yHi } = niceTicks(lo - (zeroBase ? 0 : pad), hi + (zeroBase ? 0 : pad), 4);
    const t0 = points[0].t, t1 = points[points.length - 1].t;
    const x = (t: number) => padL + (t1 === t0 ? iw : ((t - t0) / (t1 - t0)) * iw);
    const y = (v: number) => padT + ih - ((v - yLo) / (yHi - yLo || 1)) * ih;
    const xt: number[] = [];
    const n = Math.max(2, Math.min(6, Math.floor(iw / 110)));
    for (let i = 0; i < n; i++) xt.push(t0 + ((t1 - t0) * i) / (n - 1));
    return { ticks, x, y, xt, yLo, yHi };
  }, [points, refs, iw, ih, zeroBase]);

  const onMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!geo) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left + padL;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => { const d = Math.abs(geo.x(p.t) - px); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  }, [geo, points]);

  if (!points.length || !geo) {
    return (
      <div ref={ref} className="j-chart" style={{ height }}>
        <svg width={W} height={height} role="img" aria-label={ariaLabel}>
          <line className="base" x1={padL} x2={W - padR} y1={padT + ih} y2={padT + ih} />
          <text x={padL} y={padT + ih - 10}>No closed trades in this view</text>
        </svg>
      </div>
    );
  }
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${geo.x(p.t).toFixed(1)},${geo.y(p.v).toFixed(1)}`).join(' ');
  const hp = hover != null ? points[hover] : null;
  const last = points[points.length - 1];
  return (
    <div ref={ref} className="j-chart" style={{ height }}>
      <svg width={W} height={height} role="img" aria-label={ariaLabel}>
        {geo.ticks.map((tk) => (
          <g key={tk}>
            <line className="grid" x1={padL} x2={W - padR} y1={geo.y(tk)} y2={geo.y(tk)} />
            <text x={padL - 10} y={geo.y(tk) + 4} textAnchor="end">{axisFmt(tk)}</text>
          </g>
        ))}
        {zeroBase && <line className="base" x1={padL} x2={W - padR} y1={geo.y(0)} y2={geo.y(0)} />}
        {geo.xt.map((t, i) => (
          <text key={i} x={Math.min(Math.max(geo.x(t), padL + 18), W - padR - 18)} y={height - 6} textAnchor={i === 0 ? 'start' : i === geo.xt.length - 1 ? 'end' : 'middle'}
            style={i === 0 ? { transform: `translateX(${Math.max(0, padL - geo.x(t))}px)` } : undefined}>{shortDate(new Date(t))}</text>
        ))}
        {refs.map((r) => (
          <g key={r.label}>
            <line className="ref" x1={padL} x2={W - padR} y1={geo.y(r.value)} y2={geo.y(r.value)} style={r.tone === 'neg' ? { stroke: 'var(--negative)' } : r.tone === 'pos' ? { stroke: 'var(--positive)' } : undefined} />
            <text x={W - padR} y={geo.y(r.value) - 6} textAnchor="end" style={r.tone === 'neg' ? { fill: 'var(--negative)' } : undefined}>{r.label}</text>
          </g>
        ))}
        {annotation && (() => {
          const x = geo.x(annotation.t);
          const right = x > W * 0.7;
          return (
            <g>
              <line x1={x} x2={x} y1={padT} y2={padT + ih} stroke="var(--text-2)" strokeWidth={1} opacity={0.5} />
              <text x={right ? x - 6 : x + 6} y={padT + 10} textAnchor={right ? 'end' : 'start'} style={{ fill: 'var(--text-2)' }}>{annotation.label}</text>
            </g>
          );
        })()}
        <path d={d} fill="none" stroke="var(--sig)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={geo.x(last.t)} cy={geo.y(last.v)} r={3.5} fill="var(--sig)" />
        {hp && (
          <g>
            <line x1={geo.x(hp.t)} x2={geo.x(hp.t)} y1={padT} y2={padT + ih} stroke="var(--dim)" strokeWidth={1} strokeDasharray="2 3" />
            <circle cx={geo.x(hp.t)} cy={geo.y(hp.v)} r={4} fill="var(--ground)" stroke="var(--sig)" strokeWidth={2} />
          </g>
        )}
        <rect x={padL} y={padT} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      <Tooltip tip={hp ? { x: geo.x(hp.t), y: geo.y(hp.v), title: hp.label ?? shortDate(new Date(hp.t)), value: fmt(hp.v), note: hp.note } : null} />
    </div>
  );
}

// ---------- daily bars ----------

export function DailyBars({ days, height = 260, currency = 'USD' }: { days: Day[]; height?: number; currency?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 48, padR = 12, padT = 12, padB = 26;
  const W = Math.max(w, 280), iw = W - padL - padR, ih = height - padT - padB;
  const rows = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const vs = rows.map((r) => r.pnl);
  const { ticks, lo, hi } = niceTicks(Math.min(0, ...vs), Math.max(0, ...vs), 4);
  const y = (v: number) => padT + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const slot = rows.length ? iw / rows.length : iw;
  const bw = Math.max(2, Math.min(28, slot - 3));
  const labelEvery = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(iw / 90))));
  const h = hover != null ? rows[hover] : null;
  return (
    <div ref={ref} className="j-chart" style={{ height }}>
      <svg width={W} height={height} role="img" aria-label="Net result per trading day">
        {ticks.map((tk) => (
          <g key={tk}>
            <line className="grid" x1={padL} x2={W - padR} y1={y(tk)} y2={y(tk)} />
            <text x={padL - 10} y={y(tk) + 4} textAnchor="end">{axisFmt(tk)}</text>
          </g>
        ))}
        <line className="base" x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} />
        {rows.map((r, i) => {
          const cx = padL + slot * i + slot / 2;
          const top = Math.min(y(0), y(r.pnl)), bh = Math.max(1, Math.abs(y(r.pnl) - y(0)));
          return (
            <g key={r.date}>
              <rect x={cx - bw / 2} y={top} width={bw} height={bh} fill={r.pnl >= 0 ? 'var(--positive)' : 'var(--negative)'} opacity={hover == null || hover === i ? 1 : 0.55} />
              {i % labelEvery === 0 && <text x={cx} y={height - 6} textAnchor="middle">{shortDate(r.date.replace(/-/g, '/'))}</text>}
              <rect x={cx - slot / 2} y={padT} width={slot} height={ih} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
            </g>
          );
        })}
        {!rows.length && <text x={padL} y={y(0) - 10}>No closed trades in this view</text>}
      </svg>
      <Tooltip tip={h ? { x: padL + slot * hover! + slot / 2, y: y(Math.max(h.pnl, 0)), title: shortDate(h.date.replace(/-/g, '/')), value: money(h.pnl, currency, { sign: true }), note: `${h.count} trade${h.count === 1 ? '' : 's'}` } : null} />
    </div>
  );
}

// ---------- histogram ----------

export function Histogram({ bins, height = 200 }: { bins: Bin[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 32, padR = 4, padT = 10, padB = 26;
  const W = Math.max(w, 260), iw = W - padL - padR, ih = height - padT - padB;
  const max = Math.max(1, ...bins.map((b) => b.count));
  const { ticks, hi } = niceTicks(0, max, 3);
  const y = (v: number) => padT + ih - (v / hi) * ih;
  const slot = iw / bins.length, bw = slot - 4;
  return (
    <div ref={ref} className="j-chart" style={{ height }}>
      <svg width={W} height={height} role="img" aria-label="Distribution of trade results in R">
        {ticks.map((tk) => (
          <g key={tk}>
            <line className="grid" x1={padL} x2={W - padR} y1={y(tk)} y2={y(tk)} />
            <text x={padL - 8} y={y(tk) + 4} textAnchor="end">{tk}</text>
          </g>
        ))}
        <line className="base" x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} />
        {bins.map((b, i) => {
          const x = padL + slot * i + 2;
          const neg = b.hi != null && b.hi <= 0;
          return (
            <g key={b.label}>
              <rect x={x} y={y(b.count)} width={bw} height={Math.max(0, y(0) - y(b.count))} fill={neg ? 'var(--negative)' : 'var(--positive)'} opacity={hover == null || hover === i ? 1 : 0.55} />
              <text x={x + bw / 2} y={height - 6} textAnchor="middle" style={{ fontSize: slot < 44 ? 9 : 11 }}>{slot < 44 ? b.label.replace('…', '') : b.label}</text>
              <rect x={x - 2} y={padT} width={slot} height={ih} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={hover != null ? { x: padL + slot * hover + slot / 2, y: y(bins[hover].count), title: bins[hover].label, value: `${bins[hover].count} trade${bins[hover].count === 1 ? '' : 's'}` } : null} />
    </div>
  );
}

// ---------- trade ladder: stop, entry, target and exit on one R axis ----------

export function RLadder({ trade }: { trade: Trade }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const W = Math.max(w, 260);
  const risk = trade.stop_loss != null ? Math.abs(trade.entry_price - trade.stop_loss) : null;
  if (!risk) return <div ref={ref} className="j-meta">No stop recorded, so there is no R scale for this trade.</div>;
  const dir = trade.trade_type === 'long' ? 1 : -1;
  const toR = (p: number) => ((p - trade.entry_price) * dir) / risk;
  const tR = trade.take_profit != null ? toR(trade.take_profit) : null;
  const xR = trade.exit_price != null ? toR(trade.exit_price) : null;
  const lo = Math.min(-1, xR ?? -1) - 0.4, hi = Math.max(tR ?? 2, xR ?? 2, 2) + 0.4;
  const padX = 14;
  const x = (r: number) => padX + ((r - lo) / (hi - lo)) * (W - padX * 2);
  const axisY = 36;
  const marks: { r: number; label: string; sub: string; color: string; above?: boolean }[] = [
    { r: -1, label: 'Stop', sub: '−1R', color: 'var(--negative)' },
    { r: 0, label: 'Entry', sub: '0', color: 'var(--text)' },
  ];
  if (tR != null) marks.push({ r: tR, label: 'Target', sub: rMult(tR, 1), color: 'var(--dim)' });
  return (
    <div ref={ref} className="j-chart j-ladder" role="img" aria-label="Where the trade exited against its stop and target">
      <svg width={W} height={72}>
        <line className="base" x1={padX} x2={W - padX} y1={axisY} y2={axisY} />
        {xR != null && (
          <rect x={Math.min(x(0), x(xR))} y={axisY - 3} width={Math.abs(x(xR) - x(0))} height={6} fill={xR >= 0 ? 'var(--positive)' : 'var(--negative)'} opacity={0.9} />
        )}
        {marks.map((m) => (
          <g key={m.label}>
            <line x1={x(m.r)} x2={x(m.r)} y1={axisY - 10} y2={axisY + 10} stroke={m.color} strokeWidth={1.5} />
            <text x={x(m.r)} y={axisY - 16} textAnchor="middle" style={{ fill: m.color === 'var(--dim)' ? 'var(--dim)' : m.color }}>{m.label}</text>
            <text x={x(m.r)} y={axisY + 26} textAnchor="middle">{m.sub}</text>
          </g>
        ))}
        {xR != null && (
          <g>
            <circle cx={x(xR)} cy={axisY} r={5} fill="var(--ground)" stroke="var(--text)" strokeWidth={2} />
            <text x={x(xR)} y={axisY - 16 - (Math.abs(x(xR) - x(0)) < 40 || (tR != null && Math.abs(x(xR) - x(tR)) < 40) ? 14 : 0)} textAnchor="middle" style={{ fill: 'var(--text)' }}>{`Exit ${rMult(xR, 2)}`}</text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ---------- matrix (heat) ----------

export function Matrix({
  rows, cols, cell, ariaLabel,
}: {
  rows: string[];
  cols: string[];
  cell: (r: number, c: number) => { net: number; count: number } | null;
  ariaLabel: string;
}): ReactNode {
  let max = 1;
  rows.forEach((_, r) => cols.forEach((__, c) => { const v = cell(r, c); if (v) max = Math.max(max, Math.abs(v.net)); }));
  return (
    <div role="table" aria-label={ariaLabel} style={{ display: 'grid', gridTemplateColumns: `112px repeat(${cols.length}, minmax(0, 1fr))`, gap: 4 }}>
      <div />
      {cols.map((c) => <div key={c} className="j-meta" style={{ textAlign: 'center', padding: '2px 0' }}>{c}</div>)}
      {rows.map((r, ri) => (
        <div key={r} style={{ display: 'contents' }} role="row">
          <div className="j-meta" style={{ alignSelf: 'center' }}>{r}</div>
          {cols.map((c, ci) => {
            const v = cell(ri, ci);
            const k = v ? Math.min(1, Math.abs(v.net) / max) : 0;
            return (
              <div key={c} title={v ? `${r} · ${c}: ${signed(v.net, 0)} over ${v.count} trades` : `${r} · ${c}: no trades`}
                style={{
                  minHeight: 44, borderRadius: 4, padding: '6px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                  background: v ? `color-mix(in srgb, ${v.net >= 0 ? 'var(--positive)' : 'var(--negative)'} ${Math.round(8 + k * 42)}%, var(--ground))` : 'var(--ground)',
                }}>
                {v ? (
                  <>
                    <span className="j-mono" style={{ fontSize: 12, fontWeight: 500 }}>{signed(v.net, 0)}</span>
                    <span className="j-meta" style={{ fontSize: 10 }}>{v.count}</span>
                  </>
                ) : <span className="j-meta">—</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export { rOf };
