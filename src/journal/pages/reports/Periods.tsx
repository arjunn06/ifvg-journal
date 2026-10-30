import { Fragment, useEffect, useMemo, useState } from 'react';
import * as A from '../../analytics';
import { dec2, money, pct, rMult, shortDate, signed } from '../../format';
import type { Strategy, TradeMistake } from '../../types';
import { LineChart } from '../../ui/charts';
import { Empty, Panel, PnL, Signed, Tabs } from '../../ui/kit';
import { Note, winPct } from './shared';
import type { PeriodRow, Span } from './stats';

const r2 = (v: number) => Math.round(v * 100) / 100;
const dayShort = (d: A.Day) => d.date.slice(5);
const noun = (span: Span) => (span === 'weeks' ? 'week' : 'month');

/** Change in net between two displayed rows; undefined when either period has no trades to compare. */
function netChange(row: PeriodRow, prev: PeriodRow | undefined) {
  if (!prev || !row.s.count || !prev.s.count) return null;
  return r2(row.s.net) - r2(prev.s.net);
}

function Detail({ row, currency, strategies, mistakes }: { row: PeriodRow; currency: string; strategies: Strategy[]; mistakes: TradeMistake[] }) {
  const curve = useMemo(() => A.equityCurve(row.trades, 0), [row]);
  const closed = row.trades.filter(A.isClosed);
  const best = closed.length ? closed.reduce((a, b) => (A.pnlOf(b) > A.pnlOf(a) ? b : a)) : null;
  const worst = closed.length ? closed.reduce((a, b) => (A.pnlOf(b) < A.pnlOf(a) ? b : a)) : null;
  const costs = A.mistakeCosts(closed, mistakes);
  const top = costs[0] && costs[0].cost < 0 ? costs[0] : null;
  const name = (id: string | null) => strategies.find((x) => x.id === id)?.name;
  const line = (t: typeof best) => t && (
    <span className="j-num">{t.symbol} {t.trade_type} · {shortDate(t.exit_date ?? t.entry_date)} · <PnL v={t.pnl} currency={currency} /> <span className="j-dim">{rMult(A.rOf(t))}{name(t.strategy_id) ? ` · ${name(t.strategy_id)}` : ''}</span></span>
  );
  if (!closed.length) return <div className="rp-detail-in"><Empty>No closed trades in this {row.label}.</Empty></div>;
  return (
    <div className="rp-detail-in">
      <div>
        <div className="j-meta rp-cap">Running result within the period, {closed.length} trade{closed.length === 1 ? '' : 's'}</div>
        <LineChart ariaLabel={`Result through ${row.label}`} currency={currency} height={168} zeroBase points={curve.map((p) => ({ t: p.t, v: p.v, note: `${signed(p.pnl, 2)} on the trade` }))} />
      </div>
      <dl className="j-kv rp-kv">
        <dt>Best trade</dt><dd>{line(best)}</dd>
        <dt>Worst trade</dt><dd>{line(worst)}</dd>
        <dt>Top mistake</dt><dd>{top ? <span className="j-num">{top.tag} · {top.count} trade{top.count === 1 ? '' : 's'} · <PnL v={top.cost} currency={currency} /></span> : <span className="j-dim">{costs.length ? 'No loss carries a mistake tag' : 'No mistake tags'}</span>}</dd>
      </dl>
    </div>
  );
}

function Compare({ a, b, currency }: { a: PeriodRow; b: PeriodRow; currency: string }) {
  // a is the older period and the baseline of every change.
  const m = (row: PeriodRow) => ({
    net: row.s.count ? r2(row.s.net) : null, count: row.s.count, win: row.s.winRate == null ? null : r2(row.s.winRate * 10) / 10, avgR: row.s.avgR == null ? null : r2(row.s.avgR),
    exp: row.s.expectancy == null ? null : r2(row.s.expectancy), pf: row.s.profitFactor == null ? null : r2(row.s.profitFactor), plan: row.planPct == null ? null : r2(row.planPct * 10) / 10,
    best: row.bestDay ? r2(row.bestDay.pnl) : null, worst: row.worstDay ? r2(row.worstDay.pnl) : null,
  });
  const x = m(a), y = m(b);
  const d = (u: number | null, v: number | null) => (u == null || v == null ? null : r2(v - u));
  const rows: { k: string; a: React.ReactNode; b: React.ReactNode; change: React.ReactNode; plain: string }[] = [
    { k: 'Net result', a: <PnL v={x.net} currency={currency} />, b: <PnL v={y.net} currency={currency} />, change: <PnL v={d(x.net, y.net)} currency={currency} />, plain: '' },
    { k: 'Trades', a: x.count, b: y.count, change: <span className="j-num">{signed(y.count - x.count, 0)}</span>, plain: '' },
    { k: 'Win rate', a: x.win == null ? '—' : pct(x.win, 1), b: y.win == null ? '—' : pct(y.win, 1), change: <span className="j-num">{d(x.win, y.win) == null ? '—' : signed(d(x.win, y.win), 1, ' pts')}</span>, plain: '' },
    { k: 'Average R', a: rMult(x.avgR), b: rMult(y.avgR), change: <Signed v={d(x.avgR, y.avgR)} digits={2} suffix="R" />, plain: '' },
    { k: 'Expectancy a trade', a: <PnL v={x.exp} currency={currency} />, b: <PnL v={y.exp} currency={currency} />, change: <PnL v={d(x.exp, y.exp)} currency={currency} />, plain: '' },
    { k: 'Profit factor', a: x.pf == null ? '—' : dec2(x.pf), b: y.pf == null ? '—' : dec2(y.pf), change: <span className="j-num">{d(x.pf, y.pf) == null ? '—' : signed(d(x.pf, y.pf), 2)}</span>, plain: '' },
    { k: 'Plan followed', a: x.plan == null ? '—' : pct(x.plan, 1), b: y.plan == null ? '—' : pct(y.plan, 1), change: <span className="j-num">{d(x.plan, y.plan) == null ? '—' : signed(d(x.plan, y.plan), 1, ' pts')}</span>, plain: '' },
    { k: 'Best day', a: <PnL v={x.best} currency={currency} />, b: <PnL v={y.best} currency={currency} />, change: <PnL v={d(x.best, y.best)} currency={currency} />, plain: '' },
    { k: 'Worst day', a: <PnL v={x.worst} currency={currency} />, b: <PnL v={y.worst} currency={currency} />, change: <PnL v={d(x.worst, y.worst)} currency={currency} />, plain: '' },
  ];
  return (
    <div className="rp-compare">
      <div className="j-table-wrap j-table-m">
        <table className="rp-t" aria-label="Two periods side by side">
          <thead><tr><th className="id">Figure</th><th className="n">{a.label}<span className="j-sub">baseline</span></th><th className="n">{b.label}<span className="j-sub">newer</span></th><th className="n">Change vs {a.label}</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.k}><td className="id">{r.k}</td><td className="n">{r.a}</td><td className="n">{r.b}</td><td className="n">{r.change}</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="j-list-m rp-list" role="list" aria-label="Two periods side by side">
        {rows.map((r) => (
          <div key={r.k} role="listitem" className="j-row">
            <span className="grow"><span className="t">{r.k}</span><span className="s j-num" style={{ display: 'block' }}>{r.a} → {r.b}</span></span>
            {r.change}
          </div>
        ))}
        <p className="j-meta">Changes are against {a.label}.</p>
      </div>
    </div>
  );
}

export function Periods({ rows, span, setSpan, currency, strategies, mistakes }: {
  rows: PeriodRow[]; span: Span; setSpan: (s: Span) => void; currency: string; strategies: Strategy[]; mistakes: TradeMistake[];
}) {
  const firstWith = rows.find((r) => r.s.count)?.key ?? null;
  const [sel, setSel] = useState<string | null>(firstWith);
  const [compare, setCompare] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => { setSel(firstWith); setPicked([]); }, [span]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickedRows = picked.map((k) => rows.find((r) => r.key === k)!).filter(Boolean).sort((p, q) => p.start - q.start);
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k].slice(-2)));
  const act = (k: string) => (compare ? toggle(k) : setSel(sel === k ? null : k));
  const prevOf = (i: number) => rows[i + 1];
  const n = noun(span);
  const cols = 9 + (compare ? 1 : 0);
  const withTrades = rows.filter((r) => r.s.count);

  return (
    <>
      {compare && (
        <div className="j-grid">
          <Panel className="j-span-12" title="Compare" meta={pickedRows.length === 2 ? `Changes are against ${pickedRows[0].label}, the earlier ${n}` : 'Tick two rows below'}
            action={<button className="j-link" onClick={() => { setCompare(false); setPicked([]); }}>Done</button>}>
            {pickedRows.length === 2 ? <Compare a={pickedRows[0]} b={pickedRows[1]} currency={currency} />
              : <p className="rp-hint">{pickedRows.length ? `${pickedRows[0].label} ticked. Tick one more ${n} to put them side by side.` : `Tick two ${n}s in the table to put them side by side.`}</p>}
          </Panel>
        </div>
      )}

      <div className="j-grid">
        <Panel className="j-span-12"
          title={<Tabs<Span> inline label="Period length" value={span} onChange={setSpan} items={[{ key: 'weeks', label: 'Weeks' }, { key: 'months', label: 'Months' }]} />}
                    action={<button className="j-btn sm" aria-pressed={compare} onClick={() => { setCompare(!compare); setPicked([]); }}>{compare ? 'Stop comparing' : 'Compare'}</button>}>
          <div className="j-table-wrap j-table-m">
            <table className="rp-t" aria-label={`Last 12 ${n}s`}>
              <thead>
                <tr>
                  {compare && <th style={{ width: 28 }}><span className="rp-vh">Compare</span></th>}
                  <th className="id">{span === 'weeks' ? 'Week (Mon–Sun)' : 'Month'}</th>
                  <th className="n">Trades</th><th className="n">Win %</th><th className="n">Avg R</th><th className="n">Net</th>
                  <th className="n">vs previous {n}</th><th className="n">Best day</th><th className="n">Worst day</th><th className="n">Plan followed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const ch = netChange(r, prevOf(i));
                  const on = compare ? picked.includes(r.key) : sel === r.key;
                  return (
                    <Fragment key={r.key}>
                      <tr className={`j-click ${r.s.count ? '' : 'zero'}`} aria-selected={on} tabIndex={0} onClick={() => act(r.key)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(r.key); } }}>
                        {compare && <td><input type="checkbox" className="rp-box" checked={picked.includes(r.key)} onChange={() => toggle(r.key)} onClick={(e) => e.stopPropagation()} aria-label={`Compare ${r.label}`} /></td>}
                        <td className="id two"><span className="j-mono">{r.label}</span>{r.sub && <span className="j-sub">{r.sub}</span>}</td>
                        <td className="n">{r.s.count}</td>
                        <td className="n">{r.s.count ? winPct(r.s.winRate) : '—'}</td>
                        <td className="n">{r.s.count ? <Signed v={r.s.avgR} digits={2} suffix="R" /> : '—'}</td>
                        <td className="n">{r.s.count ? <PnL v={r.s.net} currency={currency} /> : '—'}</td>
                        <td className="n">{ch == null ? '—' : <PnL v={ch} currency={currency} />}</td>
                        <td className="n two">{r.bestDay ? <><PnL v={r.bestDay.pnl} currency={currency} /><span className="j-sub j-num">{dayShort(r.bestDay)}</span></> : '—'}</td>
                        <td className="n two">{r.worstDay ? <><PnL v={r.worstDay.pnl} currency={currency} /><span className="j-sub j-num">{dayShort(r.worstDay)}</span></> : '—'}</td>
                        <td className="n">{r.planPct == null ? '—' : pct(r.planPct, 0)}</td>
                      </tr>
                      {!compare && sel === r.key && (
                        <tr className="rp-detail"><td colSpan={cols}><Detail row={r} currency={currency} strategies={strategies} mistakes={mistakes} /></td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="j-list-m rp-list" role="list" aria-label={`Last 12 ${n}s`}>
            {rows.map((r, i) => {
              const ch = netChange(r, prevOf(i));
              const on = compare ? picked.includes(r.key) : sel === r.key;
              return (
                <Fragment key={r.key}>
                  <div role="listitem" className={`j-row rp-pick ${on ? 'on' : ''}`} onClick={() => act(r.key)} tabIndex={0} aria-selected={on}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(r.key); } }}>
                    {compare && <input type="checkbox" className="rp-box" checked={picked.includes(r.key)} onChange={() => toggle(r.key)} onClick={(e) => e.stopPropagation()} aria-label={`Compare ${r.label}`} />}
                    <span className="grow">
                      <span className="t j-num">{r.label}</span>
                      <span className="s j-num" style={{ display: 'block' }}>{r.s.count ? `${r.s.count} trades · ${winPct(r.s.winRate)} won · ${rMult(r.s.avgR)}${r.planPct != null ? ` · plan ${pct(r.planPct, 0)}` : ''}` : 'no trades'}{r.sub ? ` · ${r.sub}` : ''}</span>
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      {r.s.count ? <PnL v={r.s.net} currency={currency} /> : <span className="j-dim">—</span>}
                      <span className="s j-num" style={{ display: 'block' }}>{ch == null ? '—' : <><PnL v={ch} currency={currency} /> vs prev</>}</span>
                    </span>
                  </div>
                  {!compare && sel === r.key && <div className="rp-detail-m"><Detail row={r} currency={currency} strategies={strategies} mistakes={mistakes} /></div>}
                </Fragment>
              );
            })}
          </div>
          <Note>
            {withTrades.length} of {rows.length} {n}s have trades, placed by close date. {span === 'weeks' ? 'Weeks run Monday to Sunday and the current week is partial.' : 'The current month is partial.'} “vs previous {n}” is this {n}&apos;s net minus the {n} below it in the table; it is a dash when either {n} has no trades. Select a row for its result, best and worst trade and top mistake.
          </Note>
        </Panel>
      </div>
    </>
  );
}
