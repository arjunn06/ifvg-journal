// Product fragments for the landing page: the app's own components, fed by the sample journal.
// Every root carries data-ui so the page's house rules stop at its edge and the product's own conventions apply inside.

import { useMemo, useState } from 'react';
import * as A from '../analytics';
import { SESSIONS } from '../types';
import { compact, dec2, int, money, monthLabel, pct, rMult, signed } from '../format';
import { Histogram, LineChart, Matrix } from '../ui/charts';
import { Kpis, Panel, PnL, RankList, Range } from '../ui/kit';
import { landingData } from './data';
import { useMedia } from './hooks';

const RANGES: { key: A.Period; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'All' },
];

// ---------- hero: the equity curve and the key figures ----------

export function HeroFragment() {
  const L = landingData();
  const [p, setP] = useState<A.Period>('all');
  const view = useMemo(() => A.inPeriod(L.trades, p, L.end), [L, p]);
  const s = useMemo(() => A.summarize(view), [view]);
  const curve = useMemo(() => A.equityCurve(view, 0), [view]);
  const adherence = useMemo(() => A.planAdherence(view, L.data.mistakes), [view, L]);
  const narrow = useMedia('(max-width: 860px)');
  return (
    <div data-ui className="lp-frag lp-hero-frag">
      <Kpis items={[
        { label: 'Net result', lead: true, value: money(s.net, 'USD', { sign: true }), note: `${int(s.count)} closed trades` },
        { label: 'Win rate', value: pct(s.winRate), note: `${s.wins} won · ${s.losses} lost` },
        { label: 'Profit factor', value: s.profitFactor == null ? '—' : dec2(s.profitFactor), note: s.avgWin != null && s.avgLoss != null ? `avg ${money(s.avgWin, 'USD', { decimals: 0 })} / ${money(-s.avgLoss, 'USD', { decimals: 0 })}` : undefined },
        { label: 'Expectancy', value: rMult(s.avgR), unit: 'per trade', note: s.expectancy != null ? `${money(s.expectancy, 'USD', { sign: true, decimals: 0 })} a trade` : undefined },
        { label: 'Max drawdown', value: money(-s.maxDrawdown, 'USD', { decimals: 0 }) },
        { label: 'Plan followed', value: adherence ? pct(adherence.pct, 0) : '—', note: adherence ? `${adherence.clean} of ${adherence.total} trades clean` : undefined },
      ]} />
      <Panel title="Equity" meta="Sample journal, all accounts" action={<Range value={p} onChange={setP} options={RANGES} />}>
        <div className="lp-chart">
          <LineChart ariaLabel="Equity curve of the sample journal" height={narrow ? 250 : 340}
            points={curve.map((x) => ({ t: x.t, v: x.v, note: `${signed(x.pnl, 2)} on the trade` }))} />
          <span className="lp-curtain" aria-hidden="true" />
        </div>
      </Panel>
    </div>
  );
}

// ---------- the checklist with a live score, against what each tier paid ----------

export function ChecklistDemo() {
  const L = landingData();
  const items = L.data.confluenceItems;
  const total = items.reduce((a, c) => a + (c.weight ?? 1), 0);
  const [on, setOn] = useState<Set<string>>(() => new Set(['cf-bias', 'cf-liq', 'cf-mss', 'cf-ifvg', 'cf-kill', 'cf-news', 'cf-rr']));
  const score = Math.round((items.filter((c) => on.has(c.id)).reduce((a, c) => a + (c.weight ?? 1), 0) / total) * 100);
  const tier = A.CONFLUENCE_TIERS.find((t) => score >= t.lo && score < t.hi)!;
  const row = L.tiers.find((r) => r.key === tier.key);
  const toggle = (id: string) => setOn((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <div data-ui className="lp-frag lp-demo">
      <div className="lp-demo-l">
        <div className="lp-score">
          <span className="lp-score-n j-num" aria-live="polite">{score}%</span>
          <span className="lp-score-t">checklist score<br /><span className="j-dim">{on.size} of {items.length} items present</span></span>
        </div>
        <div className="j-track" aria-hidden="true"><i style={{ width: `${score}%` }} /></div>
        <p className="lp-finding">
          {row
            ? <>Sample trades logged at <b>{tier.label.toLowerCase()}</b>: {row.count} trades, {Math.round(row.winRate ?? 0)}% won, <PnL v={row.expectancy} decimals={0} /> a trade.</>
            : <>No sample trades were logged at <b>{tier.label.toLowerCase()}</b>.</>}
        </p>
        <table aria-label="Result by checklist score">
          <thead>
            <tr><th>Score at entry</th><th className="n">Trades</th><th className="n">Won</th><th className="n lp-hide-s">Avg R</th><th className="n">Per trade</th></tr>
          </thead>
          <tbody>
            {L.tiers.map((r) => (
              <tr key={r.key} aria-selected={r.key === tier.key}>
                <td className="id">{r.label}</td>
                <td className="n">{r.count}</td>
                <td className="n">{r.winRate == null ? '—' : `${Math.round(r.winRate)}%`}</td>
                <td className="n lp-hide-s"><span className={(r.avgR ?? 0) < 0 ? 'j-neg' : 'j-pos'}>{rMult(r.avgR)}</span></td>
                <td className="n"><PnL v={r.expectancy} decimals={0} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="lp-demo-r" role="group" aria-label="Checklist">
        <div className="lp-legend" aria-hidden="true">Checklist, weight of each item</div>
        {items.map((c) => (
          <label key={c.id} className={`lp-item j-check ${on.has(c.id) ? 'on' : ''}`}>
            <input type="checkbox" checked={on.has(c.id)} onChange={() => toggle(c.id)} />
            <span className="lp-item-n">{c.name}</span>
            <span className="j-num lp-item-w">×{c.weight}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------- weekday by session, and the sessions ranked ----------

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const SHORT = ['Asia', 'London', 'NY AM', 'Lunch', 'NY PM'];

export function EdgeFragments() {
  const L = landingData();
  const narrow = useMedia('(max-width: 860px)');
  const cells = useMemo(() => {
    const m = new Map<string, { net: number; count: number }>();
    for (const t of L.closed) {
      const wd = new Date(t.entry_date).getDay();
      if (wd < 1 || wd > 5 || !t.session) continue;
      const k = `${wd - 1}:${t.session}`;
      const c = m.get(k) ?? { net: 0, count: 0 };
      c.net += A.pnlOf(t); c.count++;
      m.set(k, c);
    }
    return m;
  }, [L]);
  const max = Math.max(1, ...L.sessions.map((r) => Math.abs(r.net)));
  return (
    <div data-ui className="lp-frag lp-edge">
      <Panel className="lp-matrix" title="Net result by weekday and session" meta={`${int(L.closed.length)} sample trades`}>
        <Matrix ariaLabel="Net result by weekday and session"
          rows={WEEK}
          cols={narrow ? SHORT : SESSIONS.map((s) => s.label)}
          cell={(r, c) => cells.get(`${r}:${SESSIONS[c].key}`) ?? null} />
      </Panel>
      <Panel className="col" title="By session" meta="net · trades · won">
        <RankList rows={L.sessions.map((r) => ({
          key: r.key, label: r.label, share: Math.abs(r.net) / max,
          sub: `${r.count} · ${r.winRate == null ? '—' : Math.round(r.winRate)}%`,
          value: <PnL v={r.net} decimals={0} />,
        }))} />
        {L.sessions[0] && (
          <p className="lp-pin">
            <b>{L.sessions[0].label}</b> leads the sample: {L.sessions[0].count} trades, {Math.round(L.sessions[0].winRate ?? 0)}% won.
          </p>
        )}
      </Panel>
    </div>
  );
}

// ---------- what each mistake cost, and the result distribution ----------

export function MistakeFragments() {
  const L = landingData();
  const costs = L.costs.filter((c) => c.cost < 0).slice(0, 5);
  const max = Math.max(1, ...costs.map((c) => Math.abs(c.cost)));
  return (
    <div data-ui className="lp-frag lp-stack">
      <Panel title="What each mistake cost" meta="net result of the losing trades carrying the tag">
        <RankList rows={costs.map((c) => ({
          key: c.tag, label: c.tag, share: Math.abs(c.cost) / max,
          sub: `${c.count} trade${c.count === 1 ? '' : 's'}`,
          value: <PnL v={c.cost} decimals={0} />,
        }))} />
      </Panel>
      <Panel title="Result per trade" meta="in R, 1R is the amount you risked">
        <Histogram bins={L.bins} height={210} />
      </Panel>
    </div>
  );
}

// ---------- the evaluation: equity against its target and its floor, and the four rules ----------

export function PropFragment() {
  const L = landingData();
  const a = L.evalAccount, prop = L.prop;
  const narrow = useMedia('(max-width: 860px)');
  const curve = useMemo(() => A.equityCurve(L.evalTrades, a.initial_balance), [L, a]);
  const refs = [
    ...(prop.target ? [{ value: a.initial_balance + prop.target, label: `Target ${money(a.initial_balance + prop.target, 'USD', { decimals: 0 })}`, tone: 'pos' as const }] : []),
    ...(prop.floor != null ? [{ value: prop.floor, label: `Floor ${money(prop.floor, 'USD', { decimals: 0 })}`, tone: 'neg' as const }] : []),
  ];
  const buffer = prop.bufferToFloor ?? 0;
  return (
    <div data-ui className="lp-frag lp-prop">
      <Panel title="Equity against the rules" meta="50K evaluation, sample data">
        <LineChart ariaLabel="Evaluation equity with the profit target and the trailing drawdown floor" height={narrow ? 250 : 360}
          points={curve.map((x) => ({ t: x.t, v: x.v, note: `${signed(x.pnl, 2)} on the trade` }))} refs={refs} />
      </Panel>
      <Panel title="Evaluation rules" meta="50K evaluation">
        <div className="lp-rules">
          <div>
            <div className="lp-rule-h"><span>Profit target</span><span className="j-num">{money(prop.profit, 'USD', { sign: true, decimals: 0 })} <span className="j-dim">of {money(prop.target!, 'USD', { decimals: 0 })}</span></span></div>
            <div className="j-track"><i style={{ width: `${Math.min(100, prop.targetPct ?? 0)}%` }} /></div>
            <div className="j-track-labels"><span>{money(0, 'USD', { decimals: 0 })}</span><span className="j-num">{pct(prop.targetPct, 0)}</span><span>{money(prop.target!, 'USD', { decimals: 0 })}</span></div>
          </div>
          <div>
            <div className="lp-rule-h"><span>Room above the trailing floor</span><span className="j-num">{money(buffer, 'USD', { decimals: 0 })} <span className="j-dim">of {money(a.max_loss_limit!, 'USD', { decimals: 0 })}</span></span></div>
            <div className="j-track accent"><i style={{ width: `${Math.max(0, Math.min(100, (buffer / a.max_loss_limit!) * 100))}%` }} /></div>
            <div className="j-track-labels"><span>Floor {money(prop.floor!, 'USD', { decimals: 0 })}</span><span>Equity {money(prop.equity, 'USD', { decimals: 0 })}</span></div>
          </div>
          <div>
            <div className="lp-rule-h"><span>Today against the daily limit</span><span className="j-num">{money(prop.dailyPnl, 'USD', { sign: true, decimals: 0 })} <span className="j-dim">of −{money(prop.dailyLimit!, 'USD', { decimals: 0 })}</span></span></div>
            <div className={`j-track ${prop.dailyPnl < 0 ? 'neg' : ''}`}><i style={{ width: `${prop.dailyPnl < 0 ? Math.min(100, (-prop.dailyPnl / prop.dailyLimit!) * 100) : 0}%` }} /></div>
            <div className="j-track-labels"><span>{money(0, 'USD', { decimals: 0 })}</span><span>{money(-prop.dailyLimit!, 'USD', { decimals: 0 })}</span></div>
          </div>
          <div className="lp-rule-h"><span>Trading days</span><span className="j-num">{prop.tradingDays} <span className="j-dim">of {prop.minDays} required</span></span></div>
        </div>
      </Panel>
    </div>
  );
}

// ---------- the P&L calendar for one month ----------

const HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function calendarMonth() {
  const L = landingData();
  const e = L.end;
  const m = e.getDate() >= 14 ? new Date(e.getFullYear(), e.getMonth(), 1) : new Date(e.getFullYear(), e.getMonth() - 1, 1);
  const daily = A.dailyMap(L.trades);
  const weeks = A.monthGrid(m.getFullYear(), m.getMonth(), daily);
  const days = weeks.flatMap((w) => w.cells).filter((c) => c.inMonth && c.day).map((c) => c.day!);
  return { m, weeks, days };
}

export function CalendarFragment() {
  const narrow = useMedia('(max-width: 860px)');
  const { m, weeks, days } = useMemo(calendarMonth, []);
  const maxAbs = Math.max(1, ...days.map((d) => Math.abs(d.pnl)));
  const net = days.reduce((a, d) => a + d.pnl, 0);
  const green = days.filter((d) => d.pnl > 0).length;
  return (
    <div data-ui className="lp-frag">
      <Panel title={monthLabel(m)} meta={`${days.length} trading days, ${green} green · ${money(net, 'USD', { sign: true, decimals: 0 })}`}>
        <div className="j-cal" role="grid" aria-label={`Trading calendar for ${monthLabel(m)}`}>
          {HEAD.map((h) => <div key={h} className="j-cal-h" role="columnheader">{h}</div>)}
          <div className="j-cal-h wk" role="columnheader">Week</div>
          {weeks.map((w) => (
            <div key={w.cells[0].key} style={{ display: 'contents' }} role="row">
              {w.cells.map((c) => {
                const d = c.day;
                const k = d ? Math.min(1, Math.abs(d.pnl) / maxAbs) : 0;
                const has = d && c.inMonth;
                return (
                  <div key={c.key} role="gridcell" className={`j-day ${!c.inMonth ? 'out' : ''} ${has ? (d.pnl > 0 ? 'win' : d.pnl < 0 ? 'loss' : '') : ''}`}
                    style={{ ['--k' as string]: 0.35 + k * 0.65 }}>
                    <span className="d">{c.date.getDate()}</span>
                    {has ? (
                      <span>
                        <span className="v" style={{ display: 'block' }}>{narrow ? compact(d.pnl) : signed(d.pnl, 0)}</span>
                        <span className="c">{d.count} trade{d.count === 1 ? '' : 's'}</span>
                      </span>
                    ) : <span />}
                  </div>
                );
              })}
              <div className="j-week" role="gridcell">
                {w.count ? (<><b className={w.pnl < 0 ? 'j-neg' : ''}>{signed(w.pnl, 0)}</b><span>{w.count} trade{w.count === 1 ? '' : 's'}</span></>) : <span>—</span>}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
