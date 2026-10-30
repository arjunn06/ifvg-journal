// The R ladder from charts.tsx with one fix: when the trade exits on its stop (the most common loss) the
// "Exit" label no longer prints on top of the "Stop" label; it moves under the axis instead.

import type { Trade } from '../types';
import { rMult } from '../format';
import { useWidth } from './charts';

export function TradeLadder({ trade }: { trade: Trade }) {
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
  const near = (a: number, b: number) => Math.abs(x(a) - x(b)) < 70;
  // Exit label goes above the axis unless something is already printed there; then below the tick labels.
  const exitBelow = xR != null && (near(xR, -1) || near(xR, 0) || (tR != null && near(xR, tR)));
  const H = exitBelow ? 90 : 72;
  const marks: { r: number; label: string; sub: string; color: string }[] = [
    { r: -1, label: 'Stop', sub: '−1R', color: 'var(--negative)' },
    { r: 0, label: 'Entry', sub: '0', color: 'var(--text)' },
  ];
  if (tR != null) marks.push({ r: tR, label: 'Target', sub: rMult(tR, 1), color: 'var(--dim)' });
  return (
    <div ref={ref} className="j-chart j-ladder" style={{ height: H }} role="img" aria-label="Where the trade exited against its stop and target">
      <svg width={W} height={H}>
        <line className="base" x1={padX} x2={W - padX} y1={axisY} y2={axisY} />
        {xR != null && <rect x={Math.min(x(0), x(xR))} y={axisY - 3} width={Math.abs(x(xR) - x(0))} height={6} fill={xR >= 0 ? 'var(--positive)' : 'var(--negative)'} opacity={0.9} />}
        {marks.map((m) => (
          <g key={m.label}>
            <line x1={x(m.r)} x2={x(m.r)} y1={axisY - 10} y2={axisY + 10} stroke={m.color} strokeWidth={1.5} />
            <text x={x(m.r)} y={axisY - 16} textAnchor="middle" style={{ fill: m.color }}>{m.label}</text>
            <text x={x(m.r)} y={axisY + 26} textAnchor="middle">{m.sub}</text>
          </g>
        ))}
        {xR != null && (
          <g>
            <circle cx={x(xR)} cy={axisY} r={5} fill="var(--ground)" stroke="var(--text)" strokeWidth={2} />
            <text x={Math.min(Math.max(x(xR), 44), W - 44)} y={exitBelow ? axisY + 46 : axisY - 16} textAnchor="middle" style={{ fill: 'var(--text)' }}>{`Exit ${rMult(xR, 2)}`}</text>
          </g>
        )}
      </svg>
    </div>
  );
}
