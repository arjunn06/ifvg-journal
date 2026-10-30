// Add a money movement: deposit, withdrawal, payout or one of the three fees.

import { useEffect, useId, useMemo, useState } from 'react';
import { useJournal } from '../../JournalProvider';
import { Dialog } from '../../ui/kit';
import { currencySign } from '../../format';
import { writeTransaction, type TxForm } from './api';
import { DemoReadOnly, TX_TYPES, todayInput } from './model';

type Errors = Partial<Record<keyof TxForm, string>>;

export function TransactionDialog({ open, onClose, defaultAccount, onSaved }: {
  open: boolean; onClose: () => void; defaultAccount?: string | null; onSaved: () => void;
}) {
  const J = useJournal();
  const formId = useId();
  const accounts = useMemo(() => [...J.accounts].sort((a, b) => Number(b.is_active) - Number(a.is_active)), [J.accounts]);
  const [f, setF] = useState<TxForm>({ account: '', type: 'deposit', amount: '', date: todayInput(), description: '' });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [demoNote, setDemoNote] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF({ account: defaultAccount && accounts.some((a) => a.id === defaultAccount) ? defaultAccount : accounts[0]?.id ?? '', type: 'deposit', amount: '', date: todayInput(), description: '' });
    setSubmitted(false); setBusy(false); setFailure(null); setDemoNote(false);
  }, [open, defaultAccount, accounts]);

  const errs = useMemo<Errors>(() => {
    const e: Errors = {};
    if (!f.account) e.account = 'Choose the account this belongs to.';
    if (!(f.amount.trim() !== '' && Number.isFinite(Number(f.amount)) && Number(f.amount) > 0)) e.amount = 'Enter an amount above zero. The type sets whether it adds or costs.';
    if (!f.date || Number.isNaN(new Date(`${f.date}T12:00:00`).getTime())) e.date = 'Pick the date it happened.';
    if (f.description.length > 140) e.description = 'Keep the note under 140 characters.';
    return e;
  }, [f]);
  const set = <K extends keyof TxForm>(k: K, v: TxForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const show = (k: keyof TxForm) => (submitted ? errs[k] : undefined);
  const acc = J.accounts.find((a) => a.id === f.account);
  const kind = TX_TYPES.find((t) => t.key === f.type);

  const submit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    if (busy) return;
    setSubmitted(true); setFailure(null);
    if (Object.keys(errs).length) {
      setTimeout(() => (document.getElementById(formId)?.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus(), 0);
      return;
    }
    if (J.isDemo) { setDemoNote(true); return; }
    setBusy(true);
    try {
      await writeTransaction(J, f);
      await J.refresh();
      onSaved();
    } catch (e) {
      if (e instanceof DemoReadOnly) setDemoNote(true); else setFailure(e instanceof Error ? e.message : 'Could not save the transaction.');
    } finally { setBusy(false); }
  };

  const err = (k: keyof TxForm, hint?: string) => (show(k) ? <span className="j-err" role="alert">{errs[k]}</span> : hint ? <span className="j-hint">{hint}</span> : null);

  return (
    <Dialog open={open} onClose={onClose} title="Add transaction"
      footer={<>
        <button type="button" className="j-btn" onClick={onClose}>Cancel</button>
        <button type="submit" form={formId} className="j-btn primary" disabled={busy}>{busy ? 'Saving' : 'Add transaction'}</button>
      </>}>
      <form id={formId} onSubmit={submit} noValidate className="ac-form">
        <div className="ac-fields">
          <div className="j-field full">
            <label htmlFor={`${formId}-account`}>Account</label>
            <select id={`${formId}-account`} className="j-select" value={f.account} onChange={(e) => set('account', e.target.value)} aria-invalid={!!show('account')}>
              {!accounts.length && <option value="">No accounts yet</option>}
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.is_active ? '' : ' (inactive)'}</option>)}
            </select>
            {err('account')}
          </div>
          <div className="j-field full">
            <label htmlFor={`${formId}-type`}>Type</label>
            <select id={`${formId}-type`} className="j-select" value={f.type} onChange={(e) => set('type', e.target.value)}>
              {TX_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            {kind && <span className="j-hint">{kind.effect}</span>}
          </div>
          <div className="j-field">
            <label htmlFor={`${formId}-amount`}>Amount{acc ? ` (${acc.currency})` : ''}</label>
            <input id={`${formId}-amount`} className="j-input" type="number" inputMode="decimal" step="0.01" min={0} placeholder={`${currencySign(acc?.currency)}0.00`}
              value={f.amount} onChange={(e) => set('amount', e.target.value)} aria-invalid={!!show('amount')} autoFocus />
            {err('amount')}
          </div>
          <div className="j-field">
            <label htmlFor={`${formId}-date`}>Date</label>
            <input id={`${formId}-date`} className="j-input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} aria-invalid={!!show('date')} />
            {err('date')}
          </div>
          <div className="j-field full">
            <label htmlFor={`${formId}-description`}>Note</label>
            <input id={`${formId}-description`} className="j-input" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional: Apex 50K evaluation, monthly" autoComplete="off" />
            {err('description')}
          </div>
        </div>
        {demoNote && <div className="j-notice" role="status" style={{ margin: 0 }}>Sample data is read-only for this action. Sign in to record money movements of your own.</div>}
        {failure && <div className="j-error" role="alert" style={{ margin: 0 }}>{failure}</div>}
      </form>
    </Dialog>
  );
}
