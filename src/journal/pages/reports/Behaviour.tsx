import { useMemo } from 'react';
import { money, pct, rMult, signed } from '../../format';
import * as A from '../../analytics';
import type { ConfluenceItem, Trade, TradeConfluence, TradeMistake } from '../../types';
import { Empty, Panel, PnL, Signed } from '../../ui/kit';
import { BreakdownTable, SmallSample, Note, winPct } from './shared';
import { MIN_N, afterResult, cleanFlagged, emotionRows, itemStats, mistakeLines, tierRows, EDGE_R, type ItemRow, type Verdict } from './stats';

const VERDICT: Record<Verdict, string> = { earns: 'Earns its place', none: 'No clear edge', worse: 'Did better without', few: 'Too few to judge' };

const Split = ({ n, wr, r }: { n: number; wr: number | null; r: number | null }) => (
  <>
    <td className="n">{n ? winPct(wr) : '—'}</td>
    <td className="n">{n ? <Signed v={r} digits={2} suffix="R" /> : '—'}</td>
  </>
);

function Items({ rows }: { rows: ItemRow[] }) {
  const earns = rows.filter((r) => r.verdict === 'earns').length;
  const judged = rows.filter((r) => r.verdict !== 'few').length;
  const top = rows.find((r) => r.verdict === 'earns');
  return (
    <>
      <div className="j-table-wrap j-table-m">
        <table className="rp-t" aria-label="Checklist items against result">
          <thead>
            <tr>
              <th className="id">Checklist item</th>
              <th className="n">Ticked</th>
              <th className="n">Win % ticked</th>
              <th className="n">Win % missing</th>
              <th className="n">Avg R ticked</th>
              <th className="n">Avg R missing</th>
              <th className="n">Difference</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.verdict === 'earns' ? 'best' : r.verdict === 'few' ? 'zero' : ''}>
                <td className="id two">{r.name}<span className="j-sub">{r.category ?? 'No category'}{r.weight != null ? ` · weight ${r.weight}` : ''}</span></td>
                <td className="n two"><span>{r.present.n}</span><span className="j-sub">{pct((r.present.n / r.scored) * 100, 0)} of {r.scored}</span></td>
                <td className="n two"><span>{r.present.n ? winPct(r.present.winRate) : '—'}</span><span className="j-sub">{r.present.n} trades</span></td>
                <td className="n two"><span>{r.absent.n ? winPct(r.absent.winRate) : '—'}</span><span className="j-sub">{r.absent.n} trades</span></td>
                <td className="n">{r.present.n ? <Signed v={r.present.avgR} digits={2} suffix="R" /> : '—'}</td>
                <td className="n">{r.absent.n ? <Signed v={r.absent.avgR} digits={2} suffix="R" /> : '—'}</td>
                <td className="n">{r.diffR == null ? '—' : <Signed v={r.diffR} digits={2} suffix="R" />}</td>
                <td className="rp-verdict">{VERDICT[r.verdict]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="j-list-m rp-list" role="list" aria-label="Checklist items against result">
        {rows.map((r) => (
          <div key={r.id} role="listitem" className={`j-row ${r.verdict === 'earns' ? 'best' : ''}`}>
            <span className="grow">
              <span className="t">{r.name}</span>
              <span className="s j-num" style={{ display: 'block' }}>ticked {r.present.n} · {winPct(r.present.winRate)} won · {rMult(r.present.avgR)}</span>
              <span className="s j-num" style={{ display: 'block' }}>missing {r.absent.n} · {winPct(r.absent.winRate)} won · {rMult(r.absent.avgR)}</span>
              <span className="s" style={{ display: 'block' }}>{VERDICT[r.verdict]}</span>
            </span>
            <span style={{ textAlign: 'right' }}>{r.diffR == null ? <span className="j-dim">—</span> : <Signed v={r.diffR} digits={2} suffix="R" />}</span>
          </div>
        ))}
      </div>
      <Note>
        {judged ? `${earns} of ${judged} items judged earn their place` : 'No item has 5 trades both ticked and missing yet, so none can be judged'}
        {top ? `; ${top.name} leads at ${signed(top.diffR!, 2, 'R')} a trade when ticked.` : '.'}{' '}
        Average R of the trades with the item ticked, minus those with it missing, over trades where the item was scored. An item counts as earning its place at {signed(EDGE_R, 2, 'R')} or more with {MIN_N}+ trades on each side.
      </Note>
    </>
  );
}

export function Behaviour({ trades, s, currency, mistakes, items, links, periodLabel }: {
  trades: Trade[]; s: A.Summary; currency: string; mistakes: TradeMistake[]; items: ConfluenceItem[]; links: TradeConfluence[]; periodLabel: string;
}) {
  const adh = useMemo(() => A.planAdherence(trades, mistakes), [trades, mistakes]);
  const cf = useMemo(() => cleanFlagged(trades, mistakes), [trades, mistakes]);
  const ml = useMemo(() => mistakeLines(trades, mistakes), [trades, mistakes]);
  const emo = useMemo(() => emotionRows(trades), [trades]);
  const tiers = useMemo(() => tierRows(trades), [trades]);
  const after = useMemo(() => afterResult(trades), [trades]);
  const itemRows = useMemo(() => itemStats(trades, items, links), [trades, items, links]);
  const sample = (x: number) => `${x} trade${x === 1 ? '' : 's'}`;
  const per = (x: A.Summary) => (x.count ? x.net / x.count : null);
  const scored = tiers.filter((r) => r.key !== 'none' && r.count);
  const gap = per(cf.clean) != null && per(cf.flagged) != null ? per(cf.clean)! - per(cf.flagged)! : null;
  const streak = s.streak.kind ? `${s.streak.n} ${s.streak.kind === 'W' ? (s.streak.n === 1 ? 'win' : 'wins') : (s.streak.n === 1 ? 'loss' : 'losses')}` : '—';

  return (
    <>
      <div className="j-grid">
        <Panel className="j-span-8 rp-half" title="Plan followed" meta={`${sample(s.count)} · flagged = any mistake tag`}>
          {adh ? (
            <div className="rp-plan">
              <div>
                <div className="rp-big j-num">{pct(adh.pct, 0)}</div>
                <div className="j-meta">{adh.clean} of {adh.total} trades had no mistake tag</div>
                <div className="j-track rp-track" aria-hidden="true"><i style={{ width: `${adh.pct}%` }} /></div>
              </div>
              {([['Clean trades', cf.clean], ['Flagged trades', cf.flagged]] as const).map(([name, x]) => (
                <div key={name} className="rp-side">
                  <div className="j-meta">{name}</div>
                  <div className="rp-fig"><PnL v={x.count ? x.net : null} currency={currency} /></div>
                  <div className="j-meta j-num">{sample(x.count)} · {winPct(x.winRate)} won</div>
                  <div className="j-meta j-num">{x.count ? `${money(per(x)!, currency, { sign: true })} a trade` : 'no trades'}</div>
                </div>
              ))}
            </div>
          ) : <Empty>No closed trades in this period.</Empty>}
          {gap != null && (
            <Note>
              Clean trades average {money(per(cf.clean), currency, { sign: true })} against {money(per(cf.flagged), currency, { sign: true })} for flagged ones, a gap of {money(Math.abs(gap), currency)} a trade. The two nets add up to {money(s.net, currency, { sign: true })}, the net for {periodLabel}.
            </Note>
          )}
        </Panel>
        <Panel className="j-span-4 rp-half" title="Streaks and what follows" meta={periodLabel}>
          <dl className="j-kv">
            <dt>Longest winning streak</dt><dd className="j-num">{s.longestWin} trade{s.longestWin === 1 ? '' : 's'}</dd>
            <dt>Longest losing streak</dt><dd className="j-num">{s.longestLoss} trade{s.longestLoss === 1 ? '' : 's'}</dd>
            <dt>Current streak</dt><dd className="j-num">{streak}</dd>
            <dt>Win rate after a win</dt><dd className="j-num">{winPct(after.afterWin.rate)} <span className="j-dim">of {after.afterWin.n}</span></dd>
            <dt>Win rate after a loss</dt><dd className="j-num">{winPct(after.afterLoss.rate)} <span className="j-dim">of {after.afterLoss.n}</span></dd>
          </dl>
          <Note>Streaks run through closed trades in the order they closed; a break-even trade ends one.</Note>
        </Panel>
      </div>

      <div className="j-grid">
        <Panel className="j-span-12" title="Which checklist items earn their place" meta="Average R, ticked vs missing">
          {itemRows.length ? <Items rows={itemRows} /> : <Empty>Tick checklist items when you log trades to see which ones matter.</Empty>}
        </Panel>
      </div>

      <div className="j-grid">
        <Panel className="j-span-7 rp-half" title="What each mistake cost" meta="Losing trades with the tag">
          {ml.lines.length ? (
            <>
              <div className="j-table-wrap j-table-m">
                <table className="rp-t" aria-label="Cost of each mistake tag">
                  <thead><tr><th className="id">Mistake</th><th className="n">Trades</th><th className="n">Cost</th><th className="n">Per tagged trade</th><th className="n">Share of all losses</th></tr></thead>
                  <tbody>
                    {ml.lines.map((l, i) => (
                      <tr key={l.tag} className={i === 0 && l.cost < 0 ? 'best' : ''}>
                        <td className="id">{l.tag}{l.count < MIN_N && <SmallSample />}</td>
                        <td className="n">{l.count}</td>
                        <td className="n">{l.cost ? <PnL v={l.cost} currency={currency} /> : <span className="j-num">{money(0, currency)}</span>}</td>
                        <td className="n">{l.cost ? <PnL v={l.avg} currency={currency} /> : '—'}</td>
                        <td className="n">{l.share != null && l.cost ? pct(l.share, 1) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="id">Distinct tagged trades</td>
                      <td className="n">{ml.distinct.count}</td>
                      <td className="n"><PnL v={ml.distinct.cost} currency={currency} /></td>
                      <td className="n"><PnL v={ml.distinct.cost ? ml.distinct.avg : null} currency={currency} /></td>
                      <td className="n">{ml.distinct.share != null ? pct(ml.distinct.share, 1) : '—'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="j-list-m rp-list" role="list" aria-label="Cost of each mistake tag">
                {ml.lines.map((l, i) => (
                  <div key={l.tag} role="listitem" className={`j-row ${i === 0 && l.cost < 0 ? 'best' : ''}`}>
                    <span className="grow"><span className="t">{l.tag}</span><span className="s j-num" style={{ display: 'block' }}>{l.count} trade{l.count === 1 ? '' : 's'} · {l.share != null && l.cost ? `${pct(l.share, 1)} of losses` : 'no loss'}</span></span>
                    <PnL v={l.cost} currency={currency} />
                  </div>
                ))}
                <div className="j-row foot"><span className="grow"><span className="t">Distinct tagged trades</span><span className="s j-num" style={{ display: 'block' }}>{ml.distinct.count} trades · {ml.distinct.share != null ? `${pct(ml.distinct.share, 1)} of losses` : '—'}</span></span><PnL v={ml.distinct.cost} currency={currency} /></div>
              </div>
              <Note>Gross losses in this view: {money(-ml.grossLoss, currency)}. A trade with two tags counts under each, so the rows can add up to more than the last line, which counts every tagged trade once.</Note>
            </>
          ) : <Empty>No trades carry a mistake tag in this period.</Empty>}
        </Panel>
        <Panel className="j-span-5 rp-half" title="Checklist score against result" meta={sample(s.count)}>
          {scored.length ? (
            <>
              <BreakdownTable label="Result by checklist score" idHeader="Score" rows={tiers.filter((r) => r.count || r.key !== 'none')} total={s} currency={currency} />
              {scored.length > 1 && scored[0].winRate != null && scored[scored.length - 1].winRate != null && (
                <Note>{scored[scored.length - 1].label} won {Math.round(scored[scored.length - 1].winRate!)}% of {scored[scored.length - 1].count} trades; {scored[0].label.toLowerCase()} won {Math.round(scored[0].winRate!)}% of {scored[0].count}.</Note>
              )}
            </>
          ) : <Empty>Score trades against your checklist to see this.</Empty>}
        </Panel>
      </div>

      <div className="j-grid">
        <Panel className="j-span-12" title="Results by emotion" meta={sample(s.count)}>
          {emo.some((r) => r.key !== 'none') ? <BreakdownTable label="Result by emotion" idHeader="Emotion" rows={emo} total={s} currency={currency} extra /> : <Empty>Record how you felt on a trade to see this.</Empty>}
        </Panel>
      </div>
    </>
  );
}
