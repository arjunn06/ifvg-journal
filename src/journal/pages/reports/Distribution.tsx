import { useMemo } from 'react';
import * as A from '../../analytics';
import { dec2, money, shortDate } from '../../format';
import type { Trade } from '../../types';
import { DailyBars, LineChart } from '../../ui/charts';
import { RHistogram } from './RHistogram';
import { Empty, Panel, PnL, Signed } from '../../ui/kit';
import { Note } from './shared';

export function Distribution({ trades, s, currency, startBalance, periodLabel }: { trades: Trade[]; s: A.Summary; currency: string; startBalance: number; periodLabel: string }) {
  const bins = useMemo(() => A.rHistogram(trades), [trades]);
  const days = useMemo(() => [...A.dailyMap(trades).values()], [trades]);
  const curve = useMemo(() => A.equityCurve(trades, 0), [trades]);
  const inBins = bins.reduce((x, b) => x + b.count, 0);
  const worstDay = days.length ? days.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null;
  const bestDay = days.length ? days.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
  const losingDay = worstDay && worstDay.pnl < 0 ? worstDay : null;
  const winningDay = bestDay && bestDay.pnl > 0 ? bestDay : null;
  const dayLabel = (d: A.Day | null) => (d ? shortDate(d.date.replace(/-/g, '/')) : null);
  const sample = (x: number) => `${x} trade${x === 1 ? '' : 's'}`;
  const rWins = trades.filter((t) => A.isClosed(t) && A.pnlOf(t) > 0 && A.rOf(t) != null).map((t) => A.rOf(t)!);
  const rLoss = trades.filter((t) => A.isClosed(t) && A.pnlOf(t) < 0 && A.rOf(t) != null).map((t) => A.rOf(t)!);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const ddPct = startBalance ? (s.maxDrawdown / startBalance) * 100 : null;

  return (
    <>
      <div className="j-grid">
        <Panel className="j-span-7" title="Result of each trade in R" meta={`${sample(inBins)}${inBins < s.count ? ` of ${s.count} have a risk amount` : ''}`}>
          {inBins ? (
            <>
              <RHistogram bins={bins} height={232} />
              <Note>R is the trade&apos;s result divided by the amount it risked. Bars left of zero are losses.</Note>
            </>
          ) : <Empty>No closed trade in this period has a risk amount, so there is no R to plot.</Empty>}
        </Panel>
        <Panel className="j-span-5" title="Size of wins and losses" meta={sample(s.count)}>
          <dl className="j-kv rp-kv">
            <dt>Average win</dt><dd><PnL v={s.avgWin} currency={currency} /></dd>
            <dt>Average loss</dt><dd><PnL v={s.avgLoss == null ? null : -s.avgLoss} currency={currency} /></dd>
            <dt>Payoff</dt><dd className="j-num">{s.payoff == null ? '—' : dec2(s.payoff)} <span className="j-dim">avg win / avg loss</span></dd>
            <dt>Average win in R</dt><dd><Signed v={mean(rWins)} digits={2} suffix="R" /></dd>
            <dt>Average loss in R</dt><dd><Signed v={mean(rLoss)} digits={2} suffix="R" /></dd>
            <dt>Best trade</dt><dd><PnL v={s.best} currency={currency} /></dd>
            <dt>Worst trade</dt><dd><PnL v={s.worst} currency={currency} /></dd>
            <dt>Largest winning day</dt><dd>{winningDay ? <><PnL v={winningDay.pnl} currency={currency} /> <span className="j-dim j-num">{dayLabel(winningDay)}</span></> : <span className="j-dim">—</span>}</dd>
            <dt>Largest losing day</dt><dd>{losingDay ? <><PnL v={losingDay.pnl} currency={currency} /> <span className="j-dim j-num">{dayLabel(losingDay)}</span></> : <span className="j-dim">—</span>}</dd>
          </dl>
        </Panel>
      </div>

      <div className="j-grid">
        <Panel className="j-span-12" title="Result per day" meta={`${days.length} trading day${days.length === 1 ? '' : 's'} · ${periodLabel}`}>
          <DailyBars days={days} currency={currency} height={240} />
        </Panel>
      </div>

      <div className="j-grid">
        <Panel className="j-span-12" title="Drawdown"
          meta={s.count ? `Max drawdown ${money(-s.maxDrawdown, currency)}${ddPct != null ? ` · ${dec2(ddPct)}% of starting balance` : ''} · ${periodLabel}` : periodLabel}>
          <LineChart ariaLabel="Drawdown from the running peak" currency={currency} height={240} zeroBase
            points={curve.map((p) => ({ t: p.t, v: -p.dd }))} format={(v) => money(v, currency)} />
        </Panel>
      </div>
    </>
  );
}
