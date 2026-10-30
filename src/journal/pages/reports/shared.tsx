import type { ReactNode } from 'react';
import * as A from '../../analytics';
import { dec2, money, pct, rMult } from '../../format';
import { PnL, Signed } from '../../ui/kit';
import { MIN_N, bestIndex, type Row } from './stats';

export const SmallSample = () => <span className="rp-small" title={`Fewer than ${MIN_N} trades: too few to rely on`}>small sample</span>;

export const winPct = (v: number | null) => (v == null ? '—' : pct(v, 0));

/** One table for every breakdown: identity widest, Trades, Win %, Avg R, Net; the best row in ink; totals from the same trades. */
export function BreakdownTable({ rows, total, currency, idHeader, label, extra }: {
  rows: Row[]; total: A.Summary; currency: string; idHeader: string; label: string; extra?: boolean;
}) {
  const best = bestIndex(rows);
  return (
    <>
      <div className="j-table-wrap j-table-m">
        <table className="rp-t" aria-label={label}>
          <thead><tr><th className="id">{idHeader}</th><th className="n">Trades</th><th className="n">Win %</th><th className="n">Avg R</th>{extra && <><th className="n">Profit factor</th><th className="n">Expectancy</th></>}<th className="n">Net</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className={i === best ? 'best' : r.count ? '' : 'zero'}>
                <td className="id">{r.label}{r.count > 0 && r.count < MIN_N && <SmallSample />}</td>
                <td className="n">{r.count}</td>
                <td className="n">{r.count ? winPct(r.winRate) : '—'}</td>
                <td className="n">{r.count ? <Signed v={r.avgR} digits={2} suffix="R" /> : '—'}</td>
                {extra && <><td className="n">{r.profitFactor == null ? '—' : dec2(r.profitFactor)}</td><td className="n">{r.count ? <PnL v={r.expectancy} currency={currency} /> : '—'}</td></>}
                <td className="n">{r.count ? <PnL v={r.net} currency={currency} /> : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="id">All trades</td>
              <td className="n">{total.count}</td>
              <td className="n">{winPct(total.winRate)}</td>
              <td className="n"><Signed v={total.avgR} digits={2} suffix="R" /></td>
              {extra && <><td className="n">{total.profitFactor == null ? '—' : dec2(total.profitFactor)}</td><td className="n"><PnL v={total.expectancy} currency={currency} /></td></>}
              <td className="n"><PnL v={total.net} currency={currency} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="j-list-m rp-list" role="list" aria-label={label}>
        {rows.map((r, i) => (
          <div key={r.key} role="listitem" className={`j-row ${i === best ? 'best' : ''}`}>
            <span className="grow">
              <span className="t">{r.label}{r.count > 0 && r.count < MIN_N && <SmallSample />}</span>
              <span className="s j-num" style={{ display: 'block' }}>{r.count ? `${r.count} trade${r.count === 1 ? '' : 's'} · ${winPct(r.winRate)} won · ${rMult(r.avgR)}` : 'no trades'}</span>
            </span>
            {r.count ? <PnL v={r.net} currency={currency} /> : <span className="j-dim">—</span>}
          </div>
        ))}
        <div className="j-row foot">
          <span className="grow"><span className="t">All trades</span><span className="s j-num" style={{ display: 'block' }}>{total.count} trades · {winPct(total.winRate)} won · {rMult(total.avgR)}</span></span>
          <PnL v={total.net} currency={currency} />
        </div>
      </div>
    </>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="j-meta rp-note">{children}</p>;
}

export const moneyOf = (v: number | null | undefined, currency: string, dec: 0 | 2 = 2) => money(v, currency, { sign: true, decimals: dec });

/** A short ranked list (RankList) for the narrow panels: qualified rows (5+ trades) first by net, then the small samples. */
export function rankRows(rows: Row[], currency: string) {
  const live = rows.filter((r) => r.count);
  const ordered = [...live.filter((r) => r.count >= MIN_N).sort((a, b) => b.net - a.net), ...live.filter((r) => r.count < MIN_N).sort((a, b) => b.net - a.net)];
  const max = Math.max(1, ...ordered.map((r) => Math.abs(r.net)));
  return ordered.map((r) => ({
    key: r.key, label: r.label, share: Math.abs(r.net) / max,
    sub: <>{r.count} trade{r.count === 1 ? '' : 's'} · {winPct(r.winRate)} won{r.count < MIN_N && <SmallSample />}</>,
    value: <PnL v={r.net} currency={currency} />,
  }));
}
