// One account: how it stands against its own limits, and what it has cost.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Pencil, Plus, Power, Scale, Trash2 } from 'lucide-react';
import { useJournal } from '../../JournalProvider';
import { equityCurve, isClosed, rOf, summarize, transactionNet } from '../../analytics';
import { dec2, int, isoDate, money, pct, timeHM } from '../../format';
import { sessionLabel } from '../../types';
import type { Account } from '../../types';
import { ConfirmDialog, Empty, Kpis, PageHeader, Panel, PnL, Signed } from '../../ui/kit';
import { LineChart } from '../../ui/charts';
import { removeAccount, setAccountActive } from './api';
import { Amount } from './Funding';
import { TransactionDialog } from './TransactionDialog';
import { BalanceAdjustmentDialog } from './BalanceAdjustmentDialog';
import { TypePill } from './bits';
import { DemoReadOnly, accountRow, cashTotals, kindLong, txLabel, txOf } from './model';

export function AccountDetail({ account: a, onEdit, onDemo }: { account: Account; onEdit: () => void; onDemo: () => void }) {
  const nav = useNavigate();
  const J = useJournal();
  const [confirm, setConfirm] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const index = J.accounts.findIndex((x) => x.id === a.id);
  const cur = a.currency;
  const mine = useMemo(() => J.trades.filter((t) => t.trading_account_id === a.id), [J.trades, a.id]);
  const txs = useMemo(() => txOf(J.transactions, a.id).sort((x, y) => +new Date(y.transaction_date) - +new Date(x.transaction_date)), [J.transactions, a.id]);
  const row = useMemo(() => accountRow(a, index, J.trades, J.transactions), [a, index, J.trades, J.transactions]);
  const s = useMemo(() => summarize(mine), [mine]);
  const cash = useMemo(() => cashTotals(txs), [txs]);
  const equityEffect = transactionNet(J.transactions, a.id);
  const prop = row.prop;
  const stratName = (id: string | null) => J.strategies.find((x) => x.id === id)?.name ?? '—';

  const curve = useMemo(() => {
    const c = equityCurve(mine, a.initial_balance);
    if (!c.length) return [];
    const start = new Date(a.start_date ?? a.created_at).getTime();
    const t0 = start < c[0].t ? start : c[0].t - 86400000;
    return [{ t: t0, v: a.initial_balance, label: 'Start', note: 'Initial balance' }, ...c.map((p) => ({ t: p.t, v: p.v, note: `${p.pnl >= 0 ? '+' : '−'}${money(Math.abs(p.pnl), cur)} on the trade` }))];
  }, [mine, a, cur]);

  const recent = useMemo(() => [...mine].sort((x, y) => +new Date(y.entry_date) - +new Date(x.entry_date)).slice(0, 6), [mine]);
  const started = isoDate(a.start_date ?? a.created_at);
  const sub = [kindLong(a), a.broker, `started ${started}`].filter(Boolean).join(' · ');

  const toggleActive = async () => {
    if (J.isDemo) { onDemo(); return; }
    setFailure(null);
    try { await setAccountActive(J, a.id, !a.is_active); await J.refresh(); }
    catch (e) { if (e instanceof DemoReadOnly) onDemo(); else setFailure(e instanceof Error ? e.message : 'Could not change the status.'); }
  };
  const doDelete = async () => {
    if (busy) return;
    if (J.isDemo) { setConfirm(false); onDemo(); return; }
    setBusy(true); setFailure(null);
    try {
      await removeAccount(J, a.id);
      nav('/accounts', { replace: true });
      await J.refresh();
    } catch (e) {
      if (e instanceof DemoReadOnly) { setConfirm(false); onDemo(); } else setFailure(e instanceof Error ? e.message : 'Could not delete the account.');
    } finally { setBusy(false); }
  };

  const floorBreached = !!prop && prop.bufferToFloor != null && prop.bufferToFloor <= 0;
  const dailyBreached = !!prop && prop.dailyLimit != null && -prop.dailyPnl >= prop.dailyLimit;
  const targetHit = !!prop && prop.target != null && prop.profit >= prop.target;
  const dayLabel = (d: number) => `${d} ${d === 1 ? 'day' : 'days'}`;

  const dollars = (v: number) => money(v, cur, { decimals: 0 });

  return (
    <>
      <button className="j-link ac-back" onClick={() => nav('/accounts')}><ArrowLeft /> All accounts</button>
      <PageHeader
        title={a.name}
        sub={sub}
        actions={<>
          <button className="j-btn" onClick={() => setBalanceOpen(true)}><Scale /> <span className="lbl">Adjust balance</span></button>
          <button className="j-btn" onClick={onEdit}><Pencil /> <span className="lbl">Edit</span></button>
          <button className="j-btn" onClick={toggleActive}><Power /> <span className="lbl">{a.is_active ? 'Deactivate' : 'Activate'}</span></button>
          <button className="j-btn danger" onClick={() => { setFailure(null); setConfirm(true); }}><Trash2 /> <span className="lbl">Delete</span></button>
        </>}
      />
      {failure && !confirm && <div className="j-error" role="alert"><span>{failure}</span></div>}
      {!a.is_active && <div className="j-notice" role="status"><span>This account is inactive. Its history stays here; it is hidden from the account switcher and from totals across all accounts.</span><button className="j-link" onClick={toggleActive}>Activate</button></div>}

      <Kpis items={[
        { label: 'Equity', lead: true, value: money(row.equity, cur), note: <>from {money(a.initial_balance, cur, { decimals: 0 })} at start</> },
        { label: 'Result since start', tone: row.result < 0 ? 'neg' : 'flat', value: money(row.result, cur, { sign: true, decimals: 0 }), note: `${int(s.count)} closed ${s.count === 1 ? 'trade' : 'trades'}` },
        { label: 'Win rate', value: pct(s.winRate), note: `${s.wins} won · ${s.losses} lost` },
        { label: 'Profit factor', value: s.profitFactor == null ? '—' : dec2(s.profitFactor), note: s.avgWin != null && s.avgLoss != null ? `avg ${money(s.avgWin, cur, { decimals: 0 })} / ${money(-s.avgLoss, cur, { decimals: 0 })}` : 'needs a win and a loss' },
        { label: 'Max drawdown', value: dollars(-s.maxDrawdown), note: `${pct((s.maxDrawdown / a.initial_balance) * 100, 1)} of starting balance` },
      ]} />

      <div className="j-grid">
        <Panel className="j-span-8" title="Equity" meta={`Balance after each closed trade, from ${money(a.initial_balance, cur, { decimals: 0 })}`}>
          <LineChart ariaLabel={`Equity of ${a.name} over time`} currency={cur} height={288} points={curve}
            refs={prop ? [
              ...(prop.target ? [{ value: a.initial_balance + prop.target, label: `Target ${dollars(a.initial_balance + prop.target)}`, tone: 'pos' as const }] : []),
              ...(prop.floor != null ? [{ value: prop.floor, label: `Floor ${dollars(prop.floor)}`, tone: 'neg' as const }] : []),
            ] : a.equity_goal ? [{ value: a.equity_goal, label: `Goal ${dollars(a.equity_goal)}`, tone: 'pos' as const }] : []} />
        </Panel>

        {prop ? (
          <Panel className="j-span-4" title="Evaluation rules" meta={a.trailing_drawdown_enabled ? 'Trailing drawdown' : 'Static drawdown'}>
            <div style={{ display: 'grid', gap: 20 }}>
              {prop.target != null && (
                <div>
                  <div className="ac-line"><span>Profit target</span><span className="j-num">{money(prop.profit, cur, { sign: true, decimals: 0 })} <span className="j-dim">of {dollars(prop.target)}</span></span></div>
                  <div className="j-track"><i style={{ width: `${Math.min(100, prop.targetPct ?? 0)}%` }} /></div>
                  <div className="j-track-labels"><span>{dollars(0)}</span><span className="j-num">{targetHit ? 'Target reached' : pct(prop.targetPct, 0)}</span><span>{dollars(prop.target)}</span></div>
                </div>
              )}
              {prop.floor != null && a.max_loss_limit != null && (
                <div>
                  <div className="ac-line">
                    <span>{floorBreached ? 'Floor breached' : `Room above the ${a.trailing_drawdown_enabled ? 'trailing ' : ''}floor`}</span>
                    <span className="j-num">
                      {floorBreached
                        ? <span className="j-neg">{dollars(-(prop.bufferToFloor ?? 0))} below</span>
                        : <>{dollars(prop.bufferToFloor ?? 0)} <span className="j-dim">of {dollars(a.max_loss_limit)}</span></>}
                    </span>
                  </div>
                  <div className={`j-track ${floorBreached ? 'neg' : 'accent'}`}><i style={{ width: `${floorBreached ? 100 : row.roomPct ?? 0}%` }} /></div>
                  <div className="j-track-labels"><span>Floor {dollars(prop.floor)}</span><span>Equity {dollars(prop.equity)}</span></div>
                  <p className="j-meta" style={{ marginTop: 6 }}>
                    {a.trailing_drawdown_enabled ? `The floor trails your highest equity, ${dollars(prop.floor + a.max_loss_limit)}.` : `The floor stays at ${dollars(a.initial_balance)} minus the ${dollars(a.max_loss_limit)} limit.`}
                  </p>
                </div>
              )}
              {prop.dailyLimit != null && (
                <div>
                  <div className="ac-line">
                    <span>{dailyBreached ? 'Daily limit reached today' : 'Today against the daily limit'}</span>
                    <span className="j-num"><span className={dailyBreached ? 'j-neg' : ''}>{money(prop.dailyPnl, cur, { sign: true, decimals: 0 })}</span> <span className="j-dim">of −{dollars(prop.dailyLimit)}</span></span>
                  </div>
                  <div className={`j-track ${prop.dailyPnl < 0 ? 'neg' : ''}`}><i style={{ width: `${prop.dailyPnl < 0 ? Math.min(100, (-prop.dailyPnl / prop.dailyLimit) * 100) : 0}%` }} /></div>
                  <div className="j-track-labels"><span>{dollars(0)}</span><span>{money(-prop.dailyLimit, cur, { decimals: 0 })}</span></div>
                </div>
              )}
              {prop.minDays != null && (
                <div className="ac-line">
                  <span>Trading days</span>
                  <span className="j-num">{prop.tradingDays} <span className="j-dim">of {prop.minDays} required{prop.tradingDays >= prop.minDays ? ', met' : `, ${dayLabel(prop.minDays - prop.tradingDays)} to go`}</span></span>
                </div>
              )}
              {prop.target == null && prop.floor == null && prop.dailyLimit == null && prop.minDays == null && <Empty>No rules set. Edit the account to add the firm's limits.</Empty>}
            </div>
          </Panel>
        ) : (
          <Panel className="j-span-4 col" title="Account" meta={a.is_active ? 'Active' : 'Inactive'}>
            {a.equity_goal != null && a.equity_goal > a.initial_balance && row.goalPct != null && (
              <div style={{ marginBottom: 20 }}>
                <div className="ac-line"><span>Equity goal</span><span className="j-num">{dollars(row.equity)} <span className="j-dim">of {dollars(a.equity_goal)}</span></span></div>
                <div className="j-track"><i style={{ width: `${Math.min(100, row.goalPct)}%` }} /></div>
                <div className="j-track-labels"><span>{dollars(a.initial_balance)}</span><span className="j-num">{pct(row.goalPct, 0)}</span><span>{dollars(a.equity_goal)}</span></div>
              </div>
            )}
            <dl className="j-kv">
              <dt>Type</dt><dd>{kindLong(a)}</dd>
              <dt>Broker</dt><dd>{a.broker || <span className="j-dim">—</span>}</dd>
              <dt>Currency</dt><dd className="j-num">{a.currency}</dd>
              <dt>Started</dt><dd className="j-num">{started}</dd>
              <dt>Trades</dt><dd className="j-num">{int(mine.length)} <span className="j-dim">({int(s.open)} open)</span></dd>
            </dl>
          </Panel>
        )}
      </div>

      <div className="j-grid">
        <Panel className="j-span-8" title="Recent trades" meta={mine.length > 6 ? `6 of ${int(mine.length)}` : undefined}
          action={<button className="j-link" onClick={() => { J.setScope(a.id); nav('/trades'); }}>Open journal <ArrowRight /></button>}>
          {recent.length ? (
            <>
              <div className="j-table-wrap j-table-m">
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
                        <td className="n"><PnL v={t.pnl} currency={cur} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="j-list-m">
                {recent.map((t) => (
                  <button key={t.id} className="ac-mrow" onClick={() => nav(`/trades/${t.id}`)}>
                    <span className={`j-side ${t.trade_type}`} style={{ marginRight: 0 }}>{t.trade_type === 'long' ? 'L' : 'S'}</span>
                    <span className="grow"><span className="t">{t.symbol}</span><span className="s"><span className="j-mono">{isoDate(t.entry_date)}</span> · {stratName(t.strategy_id)}</span></span>
                    <span className="ac-right">
                      {t.status === 'open' ? <span className="j-pill warn">Open</span> : <PnL v={t.pnl} currency={cur} />}
                      {isClosed(t) && <span className="s j-num"><Signed v={rOf(t)} digits={2} suffix="R" /></span>}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : <Empty>No trades logged on this account yet.</Empty>}
        </Panel>

        <Panel className="j-span-4 col" title="Funding" meta={`${int(txs.length)} ${txs.length === 1 ? 'entry' : 'entries'}`}
          action={<button className="j-link" onClick={() => nav(`/accounts?tab=funding&account=${a.id}`)}>All funding <ArrowRight /></button>}>
          <dl className="j-kv" style={{ marginBottom: 12 }}>
            <dt>Starting balance</dt><dd className="j-num">{money(a.initial_balance, cur)}</dd>
            <dt>Trading result</dt><dd><PnL v={row.result} currency={cur} /></dd>
            <dt>Cash in and out</dt><dd><PnL v={equityEffect} currency={cur} /></dd>
            <dt>Equity</dt><dd className="j-num" style={{ color: 'var(--text)' }}>{money(row.equity, cur)}</dd>
            <dt>Fees paid, not in equity</dt><dd className="j-num">{money(cash.fees, cur)}</dd>
            <dt>Result after fees</dt><dd><PnL v={row.result - cash.fees} currency={cur} /></dd>
            <dt>Fees against result</dt><dd className="j-num">{row.result > 0 ? pct((cash.fees / row.result) * 100, 1) : <span className="j-dim">—</span>}</dd>
          </dl>
          {txs.slice(0, 3).map((x) => (
            <div key={x.id} className="j-row" style={{ borderTop: '1px solid var(--rule)' }}>
              <span className="grow"><span className="t">{x.description || txLabel(x.transaction_type)}</span><span className="s" style={{ display: 'block' }}><span className="j-mono">{isoDate(x.transaction_date)}</span> · <TypePill type={x.transaction_type} /></span></span>
              <Amount tx={x} currency={cur} />
            </div>
          ))}
          {!txs.length && <div className="j-meta" style={{ borderTop: '1px solid var(--rule)', paddingTop: 12 }}>No deposits, withdrawals, payouts or fees recorded for this account.</div>}
          <div className="pin"><button className="j-btn" style={{ width: '100%' }} onClick={() => setTxOpen(true)}><Plus /> Add transaction</button></div>
        </Panel>

        <TransactionDialog open={txOpen} onClose={() => setTxOpen(false)} defaultAccount={a.id} onSaved={() => setTxOpen(false)} />
      </div>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={doDelete} confirmLabel={busy ? 'Deleting' : 'Delete account'}
        title={`Delete ${a.name}?`}
        body={<>
          <span>This deletes {a.name} and all {int(mine.length)} {mine.length === 1 ? 'trade' : 'trades'} logged on it, and its {int(txs.length)} funding {txs.length === 1 ? 'entry' : 'entries'}. It cannot be undone. </span>
          <span>To keep the history and only hide the account, deactivate it instead.</span>
          {failure && <span className="j-err" role="alert" style={{ display: 'block', marginTop: 8 }}>{failure}</span>}
        </>} />
      <BalanceAdjustmentDialog open={balanceOpen} onClose={() => setBalanceOpen(false)} accountId={a.id} accountName={a.name} currency={cur} currentBalance={row.equity} onDemo={onDemo} />
    </>
  );
}
