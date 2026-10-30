// Accounts. The question: "How is each account doing against its own limits, and what has it cost me?"
// Routes: /accounts (list), /accounts/:id (one account), /accounts?tab=funding (money movements).

import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useJournal } from '../JournalProvider';
import { int, money } from '../format';
import { Avatar, Empty, ErrorBlock, Kpis, PageHeader, Panel, PnL, Skel, Tabs, hueFor } from '../ui/kit';
import { MiniTrack, StatusMark, TypePill, currencyOf, mixedCurrency } from './accounts/bits';
import { AccountDetail } from './accounts/Detail';
import { AccountDialog } from './accounts/AccountDialog';
import { Funding, fundingSummary } from './accounts/Funding';
import { accountRow, cashTotals, kindLabel, type AccountRow } from './accounts/model';
import './Accounts.css';

type Tab = 'accounts' | 'funding';

function Loading() {
  return (
    <>
      <PageHeader title="Accounts" sub={<Skel w={380} />} />
      <div className="j-kpis" style={{ '--cols': 'minmax(0,1.5fr) repeat(4, minmax(0,1fr))' } as React.CSSProperties}>
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className={`j-kpi ${i ? '' : 'lead'}`}><Skel w={70} h={12} /><div style={{ marginTop: 10 }}><Skel w={i ? 80 : 150} h={i ? 22 : 30} /></div></div>)}
      </div>
      <div className="j-panel" style={{ height: 300 }} />
    </>
  );
}

function Progress({ r }: { r: AccountRow }) {
  const a = r.account;
  if (r.prop) {
    const p = r.prop;
    const targetPct = p.targetPct ?? 0;
    const room = p.bufferToFloor;
    return (
      <div className="ac-prog">
        {p.target != null && (
          <div><MiniTrack pct={targetPct} label={`${Math.round(targetPct)}% of the profit target`} /><span className="j-num">{Math.round(targetPct)}%</span><span className="j-dim"> to target</span></div>
        )}
        {room != null && a.max_loss_limit != null && (
          <div>
            <MiniTrack pct={r.roomPct ?? 0} tone={room <= 0 ? 'neg' : (r.roomPct ?? 0) < 25 ? 'warn' : 'sig'} label={`${Math.round(r.roomPct ?? 0)}% of the loss limit left`} />
            <span className={`j-num ${room <= 0 ? 'j-neg' : ''}`}>{money(Math.max(0, room), a.currency, { decimals: 0 })}</span><span className="j-dim">{room <= 0 ? ' floor breached' : ' room to floor'}</span>
          </div>
        )}
        {p.target == null && room == null && <span className="j-dim">No limits set</span>}
      </div>
    );
  }
  if (r.goalPct != null && a.equity_goal != null) {
    return (
      <div className="ac-prog">
        <div><MiniTrack pct={r.goalPct} label={`${Math.round(r.goalPct)}% of the equity goal`} /><span className="j-num">{Math.round(r.goalPct)}%</span><span className="j-dim"> to goal</span></div>
        <div><span className="j-dim">Goal </span><span className="j-num">{money(a.equity_goal, a.currency, { decimals: 0 })}</span></div>
      </div>
    );
  }
  return <span className="j-dim">—</span>;
}

export default function Accounts() {
  const nav = useNavigate();
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const J = useJournal();
  const [dialog, setDialog] = useState<'add' | 'edit' | null>(null);
  const [txOpen, setTxOpen] = useState(false);
  const [demoNote, setDemoNote] = useState(false);

  const tab: Tab = sp.get('tab') === 'funding' ? 'funding' : 'accounts';
  const setTab = (t: Tab) => { const n = new URLSearchParams(); if (t === 'funding') n.set('tab', 'funding'); setSp(n, { replace: true }); };

  const rows = useMemo<AccountRow[]>(() => {
    const list = J.scope === 'all' ? J.accounts : J.scopeAccounts;
    return list
      .map((a) => accountRow(a, J.accounts.findIndex((x) => x.id === a.id), J.trades, J.transactions))
      .sort((x, y) => Number(y.account.is_active) - Number(x.account.is_active) || +new Date(x.account.created_at) - +new Date(y.account.created_at));
  }, [J.scope, J.accounts, J.scopeAccounts, J.trades, J.transactions]);

  const shownIds = useMemo(() => new Set(rows.map((r) => r.account.id)), [rows]);
  const shownTx = useMemo(() => J.transactions.filter((x) => x.trading_account_id && shownIds.has(x.trading_account_id)), [J.transactions, shownIds]);

  if (J.loading) return <Loading />;

  const demoBanner = demoNote && (
    <div className="j-notice" role="status">
      <span>Sample data is read-only for this action. Sign in to add, change or delete your own accounts and funding.</span>
      <button className="j-link" onClick={() => setDemoNote(false)}>Dismiss</button>
    </div>
  );
  const onDemo = () => { setDemoNote(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // ----- one account -----
  if (id) {
    const account = J.accounts.find((a) => a.id === id);
    if (!account) {
      return (
        <div className="ac-page">
          <PageHeader title="Account not found" sub="It may have been deleted, or the link is out of date." actions={<button className="j-btn" onClick={() => nav('/accounts')}>All accounts</button>} />
          {J.error && <ErrorBlock message={`Couldn't load your journal: ${J.error}`} onRetry={J.refresh} />}
        </div>
      );
    }
    return (
      <div className="ac-page">
        {demoBanner}
        <AccountDetail account={account} onEdit={() => setDialog('edit')} onDemo={onDemo} />
        <AccountDialog open={dialog === 'edit'} onClose={() => setDialog(null)} account={account} onSaved={() => setDialog(null)} onDemo={onDemo} />
      </div>
    );
  }

  // ----- list and funding -----
  const cur = currencyOf(rows.map((r) => r.account));
  const mixed = mixedCurrency(rows.map((r) => r.account));
  const equity = rows.reduce((s, r) => s + r.equity, 0);
  const result = rows.reduce((s, r) => s + r.result, 0);
  const cash = cashTotals(shownTx);
  const paper = rows.filter((r) => r.account.account_type !== 'live' && !r.account.is_prop_firm);
  const paperEquity = paper.reduce((s, r) => s + r.equity, 0);
  const paperResult = paper.reduce((s, r) => s + r.result, 0);
  const empty = !J.accounts.length;
  const single = J.scope !== 'all' && J.scopeAccounts.length === 1 ? J.scopeAccounts[0] : null;
  const showFunding = !empty && tab === 'funding';

  const sub = showFunding
    ? fundingSummary(J.transactions, J.accounts[0]?.currency ?? 'USD')
    : empty
      ? 'Add the accounts you trade, then log what they cost and what they pay.'
      : `${rows.length === 1 ? 'This account holds' : `${rows.length} accounts hold`} ${money(equity, cur, { decimals: 0 })}. Trading has ${result >= 0 ? 'made' : 'lost'} ${money(Math.abs(result), cur, { decimals: 0 })} since the start; fees have cost ${money(cash.fees, cur, { decimals: 0 })}.`;

  const action = empty ? null : showFunding
    ? (J.transactions.length ? <button className="j-btn primary" onClick={() => setTxOpen(true)}><Plus /> Add transaction</button> : null)
    : <button className="j-btn primary" onClick={() => setDialog('add')}><Plus /> Add account</button>;

  return (
    <div className="ac-page">
      <PageHeader title="Accounts" sub={sub} actions={action} />
      {demoBanner}
      {J.error && <ErrorBlock message={`Couldn't load your journal: ${J.error}`} onRetry={J.refresh} />}

      {!empty && (
        <Tabs<Tab> label="Accounts sections" value={tab} onChange={setTab}
          items={[{ key: 'accounts', label: 'Accounts', count: J.accounts.length }, { key: 'funding', label: 'Funding', count: J.transactions.length }]} />
      )}

      {empty && (
        <Panel title="No accounts yet">
          <p style={{ color: 'var(--text-2)', maxWidth: '56ch', marginBottom: 16 }}>
            An account holds your trades and its own limits: a starting balance, and for a prop firm the profit target, the loss floor and the daily limit.
            Add the first one and every screen starts measuring against it.
          </p>
          <div className="j-actions"><button className="j-btn primary" onClick={() => setDialog('add')}><Plus /> Add your first account</button></div>
        </Panel>
      )}

      {!empty && tab === 'funding' && (
        <Funding initialAccount={sp.get('account')} addOpen={txOpen} onAdd={() => setTxOpen(true)} onAddClose={() => setTxOpen(false)} onDemo={() => { setTxOpen(false); onDemo(); }} />
      )}

      {!empty && tab === 'accounts' && (
        <>
          <Kpis items={[
            { label: 'Total equity', lead: true, value: money(equity, cur), note: mixed ? 'Mixed currencies, not converted' : `across ${rows.length} ${rows.length === 1 ? 'account' : 'accounts'}${paper.length ? `, ${money(paperEquity, cur, { decimals: 0 })} of it on paper` : ''}` },
            { label: 'Net result since start', tone: result < 0 ? 'neg' : 'flat', value: money(result, cur, { sign: true, decimals: 0 }), note: paper.length && paper.length < rows.length ? `${money(paperResult, cur, { sign: true, decimals: 0 })} of it on paper` : `${int(rows.reduce((s, r) => s + r.closed, 0))} closed trades` },
            { label: 'Fees paid', value: money(cash.fees, cur, { decimals: 0 }), note: 'prop firm fees' },
            { label: 'Withdrawn', value: money(cash.withdrawals, cur, { decimals: 0 }), note: cash.payouts ? `plus ${money(cash.payouts, cur, { decimals: 0 })} in payouts` : 'no payouts yet' },
            { label: 'Net cash position', tone: cash.net < 0 ? 'neg' : 'flat', value: money(cash.net, cur, { sign: true, decimals: 0 }), note: 'cash out less cash in' },
          ]} />

          <Panel title="Accounts and limits" meta={single ? `${rows.length} of ${J.accounts.length} shown` : `${rows.length} ${rows.length === 1 ? 'account' : 'accounts'}`}
            action={single ? <button className="j-link" onClick={() => J.setScope('all')}>Show all</button> : undefined}>
            {rows.length ? (
              <>
                <div className="j-table-wrap j-table-m">
                  <table>
                    <thead>
                      <tr>
                        <th className="id">Account</th><th>Type</th><th className="n">Equity</th><th className="n">Result since start</th>
                        <th>Progress and limits</th><th className="n">Trades</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.account.id} className="j-click ac-acc" tabIndex={0} onClick={() => nav(`/accounts/${r.account.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/accounts/${r.account.id}`)}>
                          <td className="id two">
                            <span className="ac-ident">
                              <Avatar name={r.account.name} hue={hueFor(r.index)} />
                              <span className="ac-name"><span className="ac-n">{r.account.name}</span><span className="j-sub">{r.account.broker || 'No broker'}</span></span>
                            </span>
                          </td>
                          <td><span className="j-pill">{kindLabel(r.account)}</span></td>
                          <td className="n j-num">{money(r.equity, r.account.currency)}</td>
                          <td className="n"><PnL v={r.result} currency={r.account.currency} /></td>
                          <td className="ac-cell"><Progress r={r} /></td>
                          <td className="n j-num">{int(r.trades)}</td>
                          <td><StatusMark account={r.account} breached={r.breached} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="j-list-m">
                  {rows.map((r) => (
                    <button key={r.account.id} className="ac-mrow acc" onClick={() => nav(`/accounts/${r.account.id}`)}>
                      <Avatar name={r.account.name} hue={hueFor(r.index)} />
                      <span className="grow">
                        <span className="t">{r.account.name}</span>
                        <span className="s">{kindLabel(r.account)} · {r.account.broker || 'No broker'}{r.account.is_active ? '' : ' · Inactive'}{r.breached ? ' · Breached' : ''}</span>
                      </span>
                      <span className="ac-right">
                        <span className="j-num">{money(r.equity, r.account.currency, { decimals: 0 })}</span>
                        <span className="s"><PnL v={r.result} currency={r.account.currency} decimals={0} /> since start</span>
                      </span>
                      {(r.prop || r.goalPct != null) && <span className="ac-mprog"><Progress r={r} /></span>}
                    </button>
                  ))}
                </div>
              </>
            ) : <Empty>No accounts in this view.</Empty>}
          </Panel>
        </>
      )}

      <AccountDialog open={dialog === 'add'} onClose={() => setDialog(null)} onSaved={(newId) => { setDialog(null); nav(`/accounts/${newId}`); }} onDemo={onDemo} />
    </div>
  );
}
