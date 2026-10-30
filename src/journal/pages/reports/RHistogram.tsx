// R-multiple histogram with the axis labelled at the bin edges (−3 … +4), so it stays legible at phone width.
// Same conventions as ui/charts.tsx: SVG, 1px faint grid, no y-axis line, tooltip as bare text, loss bins in the loss colour.

import { useState } from 'react';
import type { Bin } from '../../analytics';
import { niceTicks, useWidth } from '../../ui/charts';

const edge = (n: number) => (n < 0 ? `−${-n}` : n > 0 ? `+${n}` : '0');

export function RHistogram({ bins, height = 232 }: { bins: Bin[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 32, padR = 4, padT = 10, padB = 26;
  const W = Math.max(w, 260), iw = W - padL - padR, ih = height - padT - padB;
  const max = Math.max(1, ...bins.map((b) => b.count));
  const { ticks, hi } = niceTicks(0, max, 3);
  const y = (v: number) => padT + ih - (v / hi) * ih;
  const slot = iw / bins.length, bw = Math.max(2, slot - 4);
  const edges = bins.slice(0, -1).map((b) => b.hi as number);
  const h = hover != null ? bins[hover] : null;
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
        {bins.map((b, i) => (
          <g key={b.label}>
            <rect x={padL + slot * i + 2} y={y(b.count)} width={bw} height={Math.max(0, y(0) - y(b.count))}
              fill={b.hi != null && b.hi <= 0 ? 'var(--negative)' : 'var(--positive)'} opacity={hover == null || hover === i ? 1 : 0.55} />
            <rect x={padL + slot * i} y={padT} width={slot} height={ih} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
          </g>
        ))}
        {edges.map((e, i) => <text key={e} x={padL + slot * (i + 1)} y={height - 6} textAnchor="middle">{edge(e)}</text>)}
      </svg>
      {h && (
        <div className="j-tip" style={{ left: padL + slot * hover! + slot / 2, top: y(h.count) }}>
          <span>{h.label}</span><b>{h.count} trade{h.count === 1 ? '' : 's'}</b>
        </div>
      )}
    </div>
  );
}
