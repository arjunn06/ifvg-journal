import { useMemo } from 'react';
import { dec2, money, pct, rMult } from '../../format';
import * as A from '../../analytics';
import type { Strategy, Trade } from '../../types';
import { Empty, Kpis, Panel, RankList } from '../../ui/kit';
import { MatrixGrid } from './MatrixGrid';
import { BreakdownTable, rankRows } from './shared';
import { matrixData, sessionRows, sideRows, strategyRows, symbolRows, weekdayRows } from './stats';

export function Edge({ trades, s, currency, strategies, periodLabel }: { trades: Trade[]; s: A.Summary; currency: string; strategies: Strategy[]; periodLabel: string }) {
  const m = useMemo(() => matrixData(trades), [trades]);
  const sessions = useMemo(() => sessionRows(trades), [trades]);
  const days = useMemo(() => weekdayRows(trades), [trades]);
  const setups = useMemo(() => strategyRows(trades, strategies), [trades, strategies]);
  const symbols = useMemo(() => rankRows(symbolRows(trades), currency), [trades, currency]);
  const sides = useMemo(() => rankRows(sideRows(trades), currency), [trades, currency]);
  const n = s.count;
  const sample = (x: number) => `${x} trade${x === 1 ? '' : 's'}`;

  return (
    <>
      <Kpis items={[
        { label: 'Net result', lead: true, tone: s.net < 0 ? 'neg' : 'flat', value: money(s.net, currency, { sign: true }), note: `${n} closed trades · ${periodLabel}` },
        { label: 'Win rate', value: pct(s.winRate, 1), note: `${s.wins} won · ${s.losses} lost · ${s.flat} flat` },
        { label: 'Profit factor', value: s.profitFactor == null ? '—' : dec2(s.profitFactor), note: s.profitFactor == null ? 'needs a loss' : `${money(s.grossWin, currency, { decimals: 0 })} won / ${money(s.grossLoss, currency, { decimals: 0 })} lost` },
        { label: 'Average R', value: rMult(s.avgR), tone: s.avgR != null && s.avgR < 0 ? 'neg' : 'flat', note: `${s.rCount} trades with risk set` },
        { label: 'Expectancy', value: s.expectancy == null ? '—' : money(s.expectancy, currency, { sign: true }), tone: s.expectancy != null && s.expectancy < 0 ? 'neg' : 'flat', unit: 'a trade', note: 'net / closed trades' },
        { label: 'Payoff', value: s.payoff == null ? '—' : dec2(s.payoff), note: s.avgWin != null && s.avgLoss != null ? `avg win ${money(s.avgWin, currency, { decimals: 0 })} / avg loss ${money(s.avgLoss, currency, { decimals: 0 })}` : 'needs a win and a loss' },
      ]} />

      <div className="j-grid">
        <Panel className="j-span-8" title="Weekday by session" meta={`${sample(m.total.count)} · net per cell, trades beneath`}>
          <MatrixGrid data={m} ariaLabel="Net result by weekday and session" />
          <p className="j-meta rp-note">
            {m.best
              ? `Outlined: ${m.rows[m.best[0]].label} ${m.cols[m.best[1]].label}, the best cell with 5+ trades. `
              : 'No cell has 5+ trades and a positive result yet. '}
            Fainter cells have under 5. Weekday is the day opened; cells are rounded to whole dollars.
          </p>
        </Panel>
        <div className="j-span-4 rp-half rp-stack">
          <Panel title="Long against short" meta={sample(n)}>{sides.length ? <RankList rows={sides} /> : <Empty>No closed trades.</Empty>}</Panel>
          <Panel title="By instrument" meta={sample(n)}>{symbols.length ? <RankList rows={symbols} /> : <Empty>No closed trades.</Empty>}</Panel>
        </div>
      </div>

      <div className="j-grid">
        <Panel className="j-span-6 rp-half" title="By session" meta={sample(n)}>
          <BreakdownTable label="Result by session" idHeader="Session" rows={sessions} total={s} currency={currency} />
        </Panel>
        <Panel className="j-span-6 rp-half" title="By weekday" meta={sample(n)}>
          <BreakdownTable label="Result by weekday" idHeader="Day opened" rows={days} total={s} currency={currency} />
        </Panel>
      </div>

      <div className="j-grid">
        <Panel className="j-span-12" title="By setup" meta={sample(n)}>
          <BreakdownTable label="Result by setup" idHeader="Setup" rows={setups} total={s} currency={currency} extra />
        </Panel>
      </div>
    </>
  );
}
