// Weekday by session: net per cell with the trade count beneath, totals on the right and at the foot.
// Tint is the size of the result; fainter cells have under 5 trades; an outline marks the best cell with 5 or more.

import { signed } from '../../format';
import { useWidth } from '../../ui/charts';
import { MIN_N, type MCell, type MatrixData } from './stats';

const compact = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1000 ? `${+(a / 1000).toFixed(1)}k` : `${Math.round(a)}`;
  return v < 0 ? `−${s}` : v > 0 ? `+${s}` : s;
};

export function MatrixGrid({ data, ariaLabel }: { data: MatrixData; ariaLabel: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const narrow = w > 0 && w < 600;
  const fmt = (v: number) => (narrow ? compact(v) : signed(v, 0));
  const max = Math.max(1, ...data.cells.flat().map((c) => (c ? Math.abs(c.net) : 0)));
  const cols = data.cols.length;
  const tint = (c: MCell) => {
    const k = Math.min(1, Math.abs(c.net) / max);
    const strength = Math.round((8 + k * 42) * (c.count >= MIN_N ? 1 : 0.55));
    return `color-mix(in srgb, ${c.net >= 0 ? 'var(--positive)' : 'var(--negative)'} ${strength}%, var(--ground))`;
  };
  const Total = ({ c }: { c: MCell }) => (c.count ? <><span className="v">{fmt(c.net)}</span><span className="n">{c.count}</span></> : <span className="j-dim">—</span>);
  return (
    <div ref={ref} className="rp-matrix" role="table" aria-label={ariaLabel} style={{ gridTemplateColumns: `${narrow ? 48 : 96}px repeat(${cols}, minmax(0, 1fr)) ${narrow ? 56 : 88}px` }}>
      <div role="row" className="rp-mrow">
        <div role="columnheader" />
        {data.cols.map((c) => <div role="columnheader" key={c.key} className="rp-mh">{narrow ? c.short : c.label}</div>)}
        <div role="columnheader" className="rp-mh tot">All</div>
      </div>
      {data.rows.map((r, ri) => (
        <div role="row" className="rp-mrow" key={r.key}>
          <div role="rowheader" className="rp-mr">{r.label}</div>
          {data.cols.map((c, ci) => {
            const v = data.cells[ri][ci];
            const isBest = data.best?.[0] === ri && data.best?.[1] === ci;
            return (
              <div role="cell" key={c.key} className={`rp-mc ${isBest ? 'best' : ''} ${v ? '' : 'none'}`} style={v ? { background: tint(v) } : undefined}
                title={v ? `${r.label} · ${c.label}: ${signed(v.net, 2)} over ${v.count} trade${v.count === 1 ? '' : 's'}` : `${r.label} · ${c.label}: no trades`}>
                {v ? <><span className="v">{fmt(v.net)}</span><span className="n">{v.count}</span></> : <span className="j-dim">—</span>}
              </div>
            );
          })}
          <div role="cell" className="rp-mc tot"><Total c={data.rowTotals[ri]} /></div>
        </div>
      ))}
      <div role="row" className="rp-mrow">
        <div role="rowheader" className="rp-mr">All</div>
        {data.cols.map((c, ci) => <div role="cell" key={c.key} className="rp-mc tot"><Total c={data.colTotals[ci]} /></div>)}
        <div role="cell" className="rp-mc tot grand"><Total c={data.total} /></div>
      </div>
    </div>
  );
}
