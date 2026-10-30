// The Funding tab: every deposit, withdrawal, payout and fee, with the totals computed from the rows shown.

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useJournal } from '../../JournalProvider';
import { int, isoDate, money } from '../../format';
import { Avatar, ConfirmDialog, Empty, Kpis, Panel, hueFor } from '../../ui/kit';
import { removeTransaction } from './api';
import { TypePill, currencyOf, mixedCurrency } from './bits';
import { DemoReadOnly, TX_TYPES, cashTotals, txLabel, txSigned } from './model';
import { TransactionDialog } from './TransactionDialog';
import type { Transaction } from '../../types';

export function fundingSummary(rows: Transaction[], currency: string) {
  const c = cashTotals(rows);
  return `${int(rows.length)} ${rows.length === 1 ? 'entry' : 'entries'}. Net cash position ${money(c.net, currency, { sign: true })}: ${money(c.withdrawals + c.payouts, currency)} received against ${money(c.deposits + c.fees, currency)} put in or spent.`;
}

export function Amount({ tx, currency }: { tx: Transaction; currency: string }) {
  const v = txSigned(tx);
  return <span className={`j-num ${v > 0 ? 'j-pos' : ''}`}>{money(v, currency, { sign: true })}</span>;
}

export function Funding({ initialAccount, addOpen, onAdd, onAddClose, onDemo }: {
  initialAccount: string | null; addOpen: boolean; onAdd: () => void; onAddClose: () => void; onDemo: () => void;
}) {
  const J = useJournal();
  const [account, setAccount] = useState<string>(initialAccount && J.accounts.some((a) => a.id === initialAccount) ? initialAccount : 'all');
  const [type, setType] = useState<string>('all');
  const [del, setDel] = useState<Transaction | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const idx = (id: string | null) => J.accounts.findIndex((a) => a.id === id);
  const accOf = (id: string | null) => J.accounts.find((a) => a.id === id) ?? null;

  const rows = useMemo(
    () => J.transactions
      .filter((x) => (account === 'all' || x.trading_account_id === account) && (type === 'all' || x.transaction_type === type))
      .sort((a, b) => +new Date(b.transaction_date) - +new Date(a.transaction_date)),
    [J.transactions, account, type],
  );
  const shownAccounts = useMemo(() => {
    const ids = new Set(rows.map((r) => r.trading_account_id));
    return J.accounts.filter((a) => ids.has(a.id));
  }, [rows, J.accounts]);
  const cur = account !== 'all' ? accOf(account)?.currency ?? 'USD' : currencyOf(shownAccounts.length ? shownAccounts : J.accounts);
  const mixed = mixedCurrency(shownAccounts);
  const c = cashTotals(rows);
  const filtered = account !== 'all' || type !== 'all';
  const note = mixed ? 'Mixed currencies, not converted' : undefined;

  const confirmDelete = async () => {
    if (!del || busy) return;
    if (J.isDemo) { setDel(null); onDemo(); return; }
    setBusy(true); setDelError(null);
    try {
      await removeTransaction(J, del.id);
      await J.refresh();
      setDel(null);
    } catch (e) {
      if (e instanceof DemoReadOnly) { setDel(null); onDemo(); } else setDelError(e instanceof Error ? e.message : 'Could not delete the transaction.');
    } finally { setBusy(false); }
  };

  const delBody = del && (
    <>
      <span>Delete the {money(del.amount, accOf(del.trading_account_id)?.currency ?? cur)} {txLabel(del.transaction_type).toLowerCase()} dated {isoDate(del.transaction_date)}
      {accOf(del.trading_account_id) ? <> from {accOf(del.trading_account_id)!.name}</> : null}? </span>
      <span>{del.transaction_type === 'deposit' || del.transaction_type === 'payout' || del.transaction_type === 'withdrawal'
        ? `That account's equity ${del.transaction_type === 'withdrawal' ? 'goes up' : 'goes down'} by the same amount.`
        : 'Equity does not change, but the cost leaves your totals.'}</span>
      {delError && <span className="j-err" role="alert" style={{ display: 'block', marginTop: 8 }}>{delError}</span>}
    </>
  );

  return (
    <>
      {J.transactions.length > 0 && (
        <Kpis items={[
          { label: 'Net cash position', lead: true, tone: c.net < 0 ? 'neg' : 'flat', value: money(c.net, cur, { sign: true }), note: note ?? 'withdrawals + payouts − deposits − fees' },
          { label: 'Deposits', value: money(c.deposits, cur), note: 'put into accounts' },
          { label: 'Withdrawals', value: money(c.withdrawals, cur), note: 'taken out' },
          { label: 'Payouts', value: money(c.payouts, cur), note: 'received from firms' },
          { label: 'Fees paid', value: money(c.fees, cur), note: 'prop firm fees' },
        ]} />
      )}

      <Panel
        title="Money movements"
        meta={filtered ? `${int(rows.length)} of ${int(J.transactions.length)} entries` : `${int(rows.length)} ${rows.length === 1 ? 'entry' : 'entries'}`}
      >
        <div className="j-filters">
          <label className="ac-filter">
            <span className="j-label">Account</span>
            <select className="j-select sm" value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Filter by account">
              <option value="all">All accounts</option>
              {J.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="ac-filter">
            <span className="j-label">Type</span>
            <select className="j-select sm" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
              <option value="all">All types</option>
              {TX_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
          {filtered && <button className="j-link" onClick={() => { setAccount('all'); setType('all'); }}>Clear filters</button>}
        </div>

        {rows.length ? (
          <>
            <div className="j-table-wrap j-table-m">
              <table>
                <thead>
                  <tr><th>Date</th><th className="id">Account</th><th>Type</th><th>Description</th><th className="n">Amount</th><th aria-label="Delete" /></tr>
                </thead>
                <tbody>
                  {rows.map((x) => {
                    const a = accOf(x.trading_account_id);
                    return (
                      <tr key={x.id}>
                        <td className="j-mono">{isoDate(x.transaction_date)}</td>
                        <td className="id">{a ? <span className="ac-ident"><Avatar name={a.name} hue={hueFor(idx(a.id))} />{a.name}</span> : <span className="j-dim">No account</span>}</td>
                        <td><TypePill type={x.transaction_type} /></td>
                        <td className="mut ac-desc">{x.description || '—'}</td>
                        <td className="n"><Amount tx={x} currency={a?.currency ?? cur} /></td>
                        <td className="ac-act"><button className="j-icon-btn" aria-label={`Delete ${txLabel(x.transaction_type).toLowerCase()} of ${money(x.amount, a?.currency ?? cur)}`} onClick={() => { setDelError(null); setDel(x); }}><Trash2 /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="j-list-m">
              {rows.map((x) => {
                const a = accOf(x.trading_account_id);
                return (
                  <div key={x.id} className="ac-mrow">
                    {a ? <Avatar name={a.name} hue={hueFor(idx(a.id))} /> : <span className="j-avatar" style={{ background: 'var(--raised)' }} />}
                    <span className="grow">
                      <span className="t">{x.description || txLabel(x.transaction_type)}</span>
                      <span className="s"><span className="j-mono">{isoDate(x.transaction_date)}</span> · {txLabel(x.transaction_type)}{a ? ` · ${a.name}` : ''}</span>
                    </span>
                    <Amount tx={x} currency={a?.currency ?? cur} />
                    <button className="j-icon-btn" aria-label={`Delete ${txLabel(x.transaction_type).toLowerCase()} of ${money(x.amount, a?.currency ?? cur)}`} onClick={() => { setDelError(null); setDel(x); }}><Trash2 /></button>
                  </div>
                );
              })}
            </div>
          </>
        ) : J.transactions.length ? (
          <Empty>No movements match these filters.</Empty>
        ) : (
          <div className="ac-first">
            <p>Deposits, withdrawals, payouts and the fees you pay to prop firms land here, and they decide what each account is really worth.</p>
            {J.accounts.length > 0 && <button className="j-btn primary" onClick={onAdd}><Plus /> Add your first transaction</button>}
          </div>
        )}
      </Panel>

      <TransactionDialog open={addOpen} onClose={onAddClose} defaultAccount={account !== 'all' ? account : null} onSaved={onAddClose} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete transaction" body={delBody} confirmLabel={busy ? 'Deleting' : 'Delete'} />
    </>
  );
}
