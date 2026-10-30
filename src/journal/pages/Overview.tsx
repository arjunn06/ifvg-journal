// Overview. The question this screen answers first: "Is my edge holding, and what is the account's room?"
// Biggest block: the equity curve. The one finding sits under the title, beside the action it drives.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { useJournal } from '../JournalProvider';
import { useQuickLog } from '../quicklog/QuickLog';
import {
  PERIODS, accountEquity, bySession, byConfluence, closeTime, dailyMap, equityCurve, inWindow, isClosed, mistakeCosts, pnlOf,
  periodStart, planAdherence, priorWindow, propStatus, rOf, summarize, topFinding,
} from '../analytics';
import { dec2, int, isoDate, money, pct, relativeDay, rMult, signed, timeHM } from '../format';
import { SESSIONS, sessionLabel } from '../types';
import { Avatar, Empty, ErrorBlock, Kpis, PageHeader, Panel, PnL, Range, RankList, Signed, Skel, Tabs, hueFor } from '../ui/kit';
import { DailyBars, LineChart } from '../ui/charts';

type ChartTab = 'equity' | 'daily' | 'drawdown';

function Loading() {
  return (
    <>
      <PageHeader title="Overview" sub={<Skel w={320} />} />
      <div className="j-kpis" style={{ '--cols': 'minmax(0,1.5fr) repeat(5, minmax(0,1fr))' } as React.CSSProperties}>
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className={`j-kpi ${i ? '' : 'lead'}`}><Skel w={70} h={12} /><div style={{ marginTop: 10 }}><Skel w={i ? 80 : 150} h={i ? 22 : 30} /></div></div>)}
      </div>
      <div className="j-grid"><div className="j-panel j-span-8" style={{ height: 340 }} /><div className="j-panel j-span-4" style={{ height: 340 }} /></div>
    </>
  );
}

export default function Overview() {
  const nav = useNavigate();
  const { open: openLog } = useQuickLog();
  const J = useJournal();
  const [tab, setTab] = useState<ChartTab>('equity');
  const { viewTrades, scopeTrades, scopeAccounts, period, setPeriod, strategies, mistakes, transactions, startBalance, loading, error, refresh, accounts, isDemo, setScope, scope } = J;
  const currency = scopeAccounts[0]?.currency ?? 'USD';

  const s = useMemo(() => summarize(viewTrades), [viewTrades]);
  const prior = useMemo(() => {
    const w = priorWindow(period);
    return w ? summarize(inWindow(scopeTrades, w)) : null;
  }, [scopeTrades, period]);
  const adherence = useMemo(() => planAdherence(viewTrades, mistakes), [viewTrades, mistakes]);
  const finding = useMemo(() => topFinding(viewTrades, strategies, mistakes, currency), [viewTrades, strategies, mistakes, currency]);
  const sessions = useMemo(() => {
    const rows = bySession(viewTrades);
    return SESSIONS.map((x) => rows.find((r) => r.key === x.key) ?? { key: x.key, label: x.label, count: 0, wins: 0, losses: 0, net: 0, winRate: null, expectancy: null, avgR: null, profitFactor: null })
      .sort((a, b) => b.net - a.net);
  }, [viewTrades]);
  const conf = useMemo(() => byConfluence(viewTrades), [viewTrades]);
  const costs = useMemo(() => mistakeCosts(viewTrades, mistakes).filter((m) => m.cost < 0), [viewTrades, mistakes]);
  const daily = useMemo(() => [...dailyMap(viewTrades).values()], [viewTrades]);

  const before = useMemo(() => {
    const st = periodStart(period);
    if (st == null) return 0;
    return scopeTrades.filter((t) => isClosed(t) && closeTime(t) < st).reduce((x, t) => x + pnlOf(t), 0);
  }, [scopeTrades, period]);
  const curve = useMemo(() => equityCurve(viewTrades, startBalance + before), [viewTrades, startBalance, before]);

  const single = scopeAccounts.length === 1 ? scopeAccounts[0] : null;
  const prop = single?.is_prop_firm ? propStatus(single, J.trades, transactions) : null;

  const worstDay = useMemo(() => {
    if (daily.length < 5) return null;
    const w = [...daily].sort((a, b) => a.pnl - b.pnl)[0];
    const avgAbs = daily.reduce((x, d) => x + Math.abs(d.pnl), 0) / daily.length;
    if (w.pnl >= 0 || Math.abs(w.pnl) < avgAbs * 2.2) return null;
    const last = w.trades.map(closeTime).sort((a, b) => b - a)[0];
    return { t: last, label: `Worst day ${money(w.pnl, currency, { decimals: 0 })}` };
  }, [daily, currency]);

  if (loading) return <Loading />;
  const periodLabel = PERIODS.find((p) => p.key === period)!.label;
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
  const scopeLabel = scope === 'all' ? `${scopeAccounts.length} accounts` : scopeAccounts[0]?.name;

  if (!J.trades.length) {
    return (
      <>
        <PageHeader title="Overview" sub={`${today} · ${scopeLabel ?? 'No accounts yet'}`} />
        <Panel title="Your journal is empty">
          <p style={{ color: 'var(--text-2)', maxWidth: '56ch', marginBottom: 16 }}>
            Log a trade the moment you close it: the setup, the checklist, what you felt. The numbers on this screen build themselves from those rows.
          </p>
          <div className="j-actions">
            <button className="j-btn primary" onClick={openLog}><Plus /> Log your first trade</button>
            {!accounts.length && <button className="j-btn" onClick={() => nav('/accounts')}>Add an account</button>}
          </div>
        </Panel>
      </>
    );
  }

  const netDelta = prior ? Math.round(s.net * 100) / 100 - Math.round(prior.net * 100) / 100 : null;
  const bestShare = Math.max(1, ...sessions.map((r) => Math.abs(r.net)));
  const costMax = Math.max(1, ...costs.map((c) => Math.abs(c.cost)));
  const todayTrades = J.scopeTrades.filter((t) => isoDate(t.entry_date) === isoDate(new Date()));
  const openTrades = J.scopeTrades.filter((t) => t.status === 'open');
  const todayNet = todayTrades.filter(isClosed).reduce((x, t) => x + pnlOf(t), 0);
  const recent = [...J.scopeTrades].sort((a, b) => +new Date(b.entry_date) - +new Date(a.entry_date)).slice(0, 6);
  const stratName = (id: string | null) => strategies.find((x) => x.id === id)?.name ?? '—';

  return (
    <>
      <PageHeader
        title="Overview"
        sub={finding ? <><b>{finding.text}</b> <span className="j-dim">· {today} · {scopeLabel} · {periodLabel}</span></> : `${today} · ${scopeLabel} · ${periodLabel}`}
        actions={<Range value={period} onChange={setPeriod} />}
      />
      {error && <ErrorBlock message={`Couldn't load your journal: ${error}`} onRetry={refresh} />}

      <Kpis items={[
        { label: 'Net result', lead: true, tone: s.net < 0 ? 'neg' : 'flat', value: money(s.net, currency, { sign: true }),
          note: netDelta != null ? <><b>{money(netDelta, currency, { sign: true })}</b> vs prior {periodLabel}</> : `${int(s.count)} closed trades` },
        { label: 'Win rate', value: pct(s.winRate), note: `${s.wins} won · ${s.losses} lost · ${s.flat} flat` },
        { label: 'Profit factor', value: s.profitFactor == null ? '—' : dec2(s.profitFactor), note: s.avgWin != null && s.avgLoss != null ? `avg ${money(s.avgWin, currency, { decimals: 0 })} / ${money(-s.avgLoss, currency, { decimals: 0 })}` : 'needs a win and a loss' },
        { label: 'Expectancy', value: rMult(s.avgR), unit: 'per trade', note: s.expectancy != null ? `${money(s.expectancy, currency, { sign: true, decimals: 0 })} a trade` : undefined },
        { label: 'Max drawdown', value: s.maxDrawdown ? money(-s.maxDrawdown, currency, { decimals: 0 }) : money(0, currency, { decimals: 0 }), note: startBalance ? `${pct((s.maxDrawdown / startBalance) * 100, 1)} of starting balance` : undefined },
        { label: 'Plan followed', value: adherence ? pct(adherence.pct, 0) : '—', note: adherence ? `${adherence.clean} of ${adherence.total} trades clean` : undefined },
      ]} />

      <div className="j-grid">
        <Panel
          className="j-span-8"
          title={<Tabs<ChartTab> inline label="Chart" value={tab} onChange={setTab} items={[{ key: 'equity', label: 'Equity' }, { key: 'daily', label: 'Daily result' }, { key: 'drawdown', label: 'Drawdown' }] as { key: ChartTab; label: string }[]} />}
          meta={tab === 'equity' ? `Balance after each closed trade · ${periodLabel}` : tab === 'daily' ? `${daily.length} trading days · ${periodLabel}` : `Drop from the running peak · ${periodLabel}`}
        >
          {tab === 'equity' && (
            <LineChart ariaLabel="Account equity over the selected period" currency={currency} height={280}
              points={curve.map((p) => ({ t: p.t, v: p.v, note: `${signed(p.pnl, 2)} on the trade` }))}
              annotation={worstDay}
              refs={prop && single ? [
                ...(prop.target ? [{ value: single.initial_balance + prop.target, label: `Target ${money(single.initial_balance + prop.target, currency, { decimals: 0 })}`, tone: 'pos' as const }] : []),
                ...(prop.floor != null ? [{ value: prop.floor, label: `Floor ${money(prop.floor, currency, { decimals: 0 })}`, tone: 'neg' as const }] : []),
              ] : []} />
          )}
          {tab === 'daily' && <DailyBars days={daily} currency={currency} height={280} />}
          {tab === 'drawdown' && (
            <LineChart ariaLabel="Drawdown from peak" currency={currency} height={280} zeroBase
              points={curve.map((p) => ({ t: p.t, v: -p.dd }))} format={(v) => money(v, currency)} />
          )}
        </Panel>

        {prop && single ? (
          <Panel className="j-span-4" title="Evaluation rules" meta={single.name}>
            <div style={{ display: 'grid', gap: 20 }}>
              {prop.target != null && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>Profit target</span>
                    <span className="j-num">{money(prop.profit, currency, { sign: true, decimals: 0 })} <span className="j-dim">of {money(prop.target, currency, { decimals: 0 })}</span></span>
                  </div>
                  <div className="j-track"><i style={{ width: `${Math.min(100, prop.targetPct ?? 0)}%` }} /></div>
                  <div className="j-track-labels"><span>{money(0, currency, { decimals: 0 })}</span><span className="j-num">{pct(prop.targetPct, 0)}</span><span>{money(prop.target, currency, { decimals: 0 })}</span></div>
                </div>
              )}
              {prop.floor != null && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>Room above the {single.trailing_drawdown_enabled ? 'trailing ' : ''}floor</span>
                    <span className="j-num">{money(prop.bufferToFloor, currency, { decimals: 0 })} <span className="j-dim">of {money(single.max_loss_limit!, currency, { decimals: 0 })}</span></span>
                  </div>
                  <div className="j-track accent"><i style={{ width: `${Math.max(0, Math.min(100, ((prop.bufferToFloor ?? 0) / single.max_loss_limit!) * 100))}%` }} /></div>
                  <div className="j-track-labels"><span>Floor {money(prop.floor, currency, { decimals: 0 })}</span><span>Equity {money(prop.equity, currency, { decimals: 0 })}</span></div>
                </div>
              )}
              {prop.dailyLimit != null && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>Today against the daily limit</span>
                    <span className="j-num">{money(prop.dailyPnl, currency, { sign: true, decimals: 0 })} <span className="j-dim">of −{money(prop.dailyLimit, currency, { decimals: 0 })}</span></span>
                  </div>
                  <div className={`j-track ${prop.dailyPnl < 0 ? 'neg' : ''}`}><i style={{ width: `${prop.dailyPnl < 0 ? Math.min(100, (-prop.dailyPnl / prop.dailyLimit) * 100) : 0}%` }} /></div>
                  <div className="j-track-labels"><span>{money(0, currency, { decimals: 0 })}</span><span>{money(-prop.dailyLimit, currency, { decimals: 0 })}</span></div>
                </div>
              )}
              {prop.minDays != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Trading days</span><span className="j-num">{prop.tradingDays} <span className="j-dim">of {prop.minDays} required</span></span>
                </div>
              )}
            </div>
          </Panel>
        ) : (
          <Panel className="j-span-4" title="Accounts" action={<button className="j-link" onClick={() => nav('/accounts')}>All accounts <ArrowRight /></button>}>
            <div className="j-rows">
              {scopeAccounts.map((a) => {
                const eq = accountEquity(a, J.trades, transactions);
                const net = eq - a.initial_balance;
                const ai = accounts.findIndex((x) => x.id === a.id);
                return (
                  <button key={a.id} className="j-row" style={{ background: 'none', border: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => setScope(a.id)}>
                    <Avatar name={a.name} hue={hueFor(ai)} />
                    <span className="grow"><span className="t">{a.name}</span><span className="s" style={{ display: 'block' }}>{a.is_prop_firm ? 'Prop evaluation' : a.account_type === 'paper' ? 'Paper' : 'Live'} · {a.broker}</span></span>
                    <span style={{ textAlign: 'right' }}>
                      <span className="j-num" style={{ display: 'block' }}>{money(eq, a.currency, { decimals: 0 })}</span>
                      <span className="s j-num"><Signed v={net} digits={0} /> since start</span>
                    </span>
                  </button>
                );
              })}
              {!scopeAccounts.length && <Empty>No active accounts.</Empty>}
            </div>
          </Panel>
        )}
      </div>

      <div className="j-grid">
        <Panel className="j-span-4" title="Sessions" meta={`Net result · ${periodLabel}`}>
          <RankList rows={sessions.map((r) => ({
            key: r.key, label: r.label, share: Math.abs(r.net) / bestShare,
            sub: r.count ? `${r.count} · ${r.winRate != null ? Math.round(r.winRate) + '%' : '—'}` : 'no trades',
            value: r.count ? <PnL v={r.net} currency={currency} decimals={0} /> : <span className="j-dim">—</span>,
          }))} />
        </Panel>

        <Panel className="j-span-4" title="Checklist against result" meta="Expectancy per trade">
          {conf.length ? (
            <RankList rows={conf.map((r) => ({
              key: r.key, label: r.label, share: Math.abs(r.expectancy ?? 0) / Math.max(1, ...conf.map((x) => Math.abs(x.expectancy ?? 0))),
              sub: `${r.count} trades · ${r.winRate != null ? Math.round(r.winRate) + '%' : '—'}`,
              value: <PnL v={r.expectancy} currency={currency} decimals={0} />,
            }))} />
          ) : <Empty>Score trades against your checklist to see this.</Empty>}
          {conf.length > 1 && conf[0].winRate != null && conf[conf.length - 1].winRate != null && (
            <p className="j-meta" style={{ marginTop: 12 }}>
              {conf[conf.length - 1].label} won {Math.round(conf[conf.length - 1].winRate!)}% of {conf[conf.length - 1].count} trades; {conf[0].label.toLowerCase()} won {Math.round(conf[0].winRate!)}% of {conf[0].count}.
            </p>
          )}
        </Panel>

        <Panel className="j-span-4" title="What mistakes cost" meta={`Losses on tagged trades · ${periodLabel}`}>
          {costs.length ? (
            <RankList rows={costs.slice(0, 5).map((c) => ({ key: c.tag, label: c.tag, share: Math.abs(c.cost) / costMax, sub: `${c.count} trade${c.count === 1 ? '' : 's'}`, value: <PnL v={c.cost} currency={currency} decimals={0} /> }))} />
          ) : <Empty>No losing trades carry a mistake tag in this view.</Empty>}
          {costs.length > 0 && (
            <p className="j-meta" style={{ marginTop: 12 }}>
              {costs.reduce((x, c) => x + c.count, 0)} tagged trades lost {money(costs.reduce((x, c) => x + c.cost, 0), currency, { decimals: 0 }).replace('\u2212', '')} in all; a trade with two tags counts under each.
            </p>
          )}
        </Panel>
      </div>

      <div className="j-grid">
        <Panel className="j-span-8" title="Recent trades" action={<button className="j-link" onClick={() => nav('/trades')}>Open journal <ArrowRight /></button>}>
          <div className="j-table-wrap">
            <table>
              <thead><tr><th>When</th><th>Instrument</th><th>Setup</th><th>Session</th><th className="n">Result</th><th className="n">P&amp;L</th></tr></thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id} className="j-click" tabIndex={0} onClick={() => nav(`/trades/${t.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/trades/${t.id}`)}>
                    <td className="two"><span className="j-mono">{isoDate(t.entry_date)}</span><span className="j-sub">{timeHM(t.entry_date)}</span></td>
                    <td className="id"><span className={`j-side ${t.trade_type}`}>{t.trade_type === 'long' ? 'L' : 'S'}</span>{t.symbol}</td>
                    <td className="mut j-trunc">{stratName(t.strategy_id)}</td>
                    <td className="mut">{sessionLabel(t.session)}</td>
                    <td className="n j-num">{t.status === 'open' ? <span className="j-pill warn">Open</span> : <Signed v={rOf(t)} digits={2} suffix="R" />}</td>
                    <td className="n"><PnL v={t.pnl} currency={currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="j-span-4 col" title="Today" meta={relativeDay(new Date())}>
          <dl className="j-kv" style={{ marginBottom: 16 }}>
            <dt>Closed</dt><dd className="j-num">{todayTrades.filter(isClosed).length} trades</dd>
            <dt>Result</dt><dd><PnL v={todayTrades.filter(isClosed).length ? todayNet : null} currency={currency} /></dd>
            <dt>Open positions</dt><dd className="j-num">{openTrades.length}</dd>
          </dl>
          {openTrades.map((t) => (
            <button key={t.id} className="j-row" style={{ width: '100%', background: 'none', border: 0, borderTop: '1px solid var(--rule)', color: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => nav(`/trades/${t.id}`)}>
              <span className={`j-side ${t.trade_type}`}>{t.trade_type === 'long' ? 'L' : 'S'}</span>
              <span className="grow"><span className="t">{t.symbol} × {t.quantity}</span><span className="s" style={{ display: 'block' }}>In at <span className="j-mono">{t.entry_price}</span> since {timeHM(t.entry_date)}</span></span>
              <span className="j-pill warn">Open</span>
            </button>
          ))}
          {todayTrades.filter(isClosed).slice(0, 4).map((t) => (
            <button key={t.id} className="j-row" style={{ width: '100%', background: 'none', border: 0, borderTop: '1px solid var(--rule)', color: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => nav(`/trades/${t.id}`)}>
              <span className={`j-side ${t.trade_type}`}>{t.trade_type === 'long' ? 'L' : 'S'}</span>
              <span className="grow"><span className="t">{t.symbol}</span><span className="s" style={{ display: 'block' }}>{timeHM(t.entry_date)} · {stratName(t.strategy_id)}</span></span>
              <span style={{ textAlign: 'right' }}><PnL v={t.pnl} currency={currency} /><span className="s j-num" style={{ display: 'block' }}><Signed v={rOf(t)} digits={2} suffix="R" /></span></span>
            </button>
          ))}
          {!openTrades.length && !todayTrades.length && <div className="j-meta" style={{ borderTop: '1px solid var(--rule)', paddingTop: 12 }}>Nothing logged today. Log a trade the moment you are in.</div>}
          <div className="pin"><button className="j-btn" style={{ width: '100%' }} onClick={openLog}><Plus /> Log trade</button></div>
        </Panel>
      </div>
    </>
  );
}
