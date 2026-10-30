// Add / edit account. One dialog for both; the prop-firm switch reveals the evaluation rules.

import { useEffect, useId, useMemo, useState } from 'react';
import { useJournal } from '../../JournalProvider';
import { Dialog } from '../../ui/kit';
import { isoDate } from '../../format';
import type { Account } from '../../types';
import { writeAccount, type AccountForm } from './api';
import { DemoReadOnly, todayInput } from './model';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'INR'];

const blank = (): AccountForm => ({
  name: '', account_type: 'live', broker: '', currency: 'USD', initial_balance: '', start_date: todayInput(), is_active: true,
  is_prop: false, profit_target: '', max_loss_limit: '', daily_loss_limit: '', minimum_trading_days: '', trailing: false, equity_goal: '',
});

const fromAccount = (a: Account): AccountForm => ({
  name: a.name,
  account_type: a.account_type === 'demo' || a.account_type === 'paper' ? a.account_type : 'live',
  broker: a.broker ?? '',
  currency: a.currency,
  initial_balance: String(a.initial_balance),
  start_date: isoDate(a.start_date ?? a.created_at),
  is_active: a.is_active,
  is_prop: !!a.is_prop_firm,
  profit_target: a.profit_target != null ? String(a.profit_target) : '',
  max_loss_limit: a.max_loss_limit != null ? String(a.max_loss_limit) : '',
  daily_loss_limit: a.daily_loss_limit != null ? String(a.daily_loss_limit) : '',
  minimum_trading_days: a.minimum_trading_days != null ? String(a.minimum_trading_days) : '',
  trailing: !!a.trailing_drawdown_enabled,
  equity_goal: a.equity_goal != null ? String(a.equity_goal) : '',
});

type Errors = Partial<Record<keyof AccountForm, string>>;

function validate(f: AccountForm): Errors {
  const e: Errors = {};
  const pos = (v: string) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) > 0;
  const opt = (k: keyof AccountForm, label: string) => {
    const v = f[k] as string;
    if (v.trim() !== '' && !pos(v)) e[k] = `${label} must be a number above zero, or left empty.`;
  };
  if (!f.name.trim()) e.name = 'Give the account a name.';
  else if (f.name.trim().length > 60) e.name = 'Keep the name under 60 characters.';
  if (!pos(f.initial_balance)) e.initial_balance = 'Enter the balance the account started with, above zero.';
  if (!f.start_date || Number.isNaN(new Date(`${f.start_date}T12:00:00`).getTime())) e.start_date = 'Pick the day the account started.';
  if (f.is_prop) {
    opt('profit_target', 'Profit target'); opt('max_loss_limit', 'Max loss limit'); opt('daily_loss_limit', 'Daily loss limit');
    const m = f.minimum_trading_days.trim();
    if (m !== '' && !(Number.isInteger(Number(m)) && Number(m) >= 0)) e.minimum_trading_days = 'Use a whole number of days, or leave empty.';
    if (pos(f.max_loss_limit) && pos(f.initial_balance) && Number(f.max_loss_limit) >= Number(f.initial_balance)) e.max_loss_limit = 'The loss limit has to be smaller than the starting balance.';
  } else {
    const g = f.equity_goal.trim();
    if (g !== '' && !(pos(g) && Number(g) > Number(f.initial_balance))) e.equity_goal = 'The goal is an equity level above the starting balance, or leave it empty.';
  }
  return e;
}

export function AccountDialog({ open, onClose, account, onSaved, onDemo }: {
  open: boolean; onClose: () => void; account?: Account | null; onSaved: (id: string) => void; onDemo: () => void;
}) {
  const J = useJournal();
  const formId = useId();
  const [f, setF] = useState<AccountForm>(blank);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [demoNote, setDemoNote] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(account ? fromAccount(account) : blank());
    setSubmitted(false); setBusy(false); setFailure(null); setDemoNote(false);
  }, [open, account]);

  const errs = useMemo(() => validate(f), [f]);
  const set = <K extends keyof AccountForm>(k: K, v: AccountForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const show = (k: keyof AccountForm) => (submitted ? errs[k] : undefined);

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
      const id = await writeAccount(J, f, account?.id);
      await J.refresh();
      onSaved(id);
    } catch (e) {
      if (e instanceof DemoReadOnly) { setDemoNote(true); onDemo(); } else setFailure(e instanceof Error ? e.message : 'Could not save the account.');
    } finally { setBusy(false); }
  };

  const field = (k: keyof AccountForm, label: string, input: React.ReactNode, hint?: string, cls = '') => (
    <div className={`j-field ${cls}`}>
      <label htmlFor={`${formId}-${k}`}>{label}</label>
      {input}
      {show(k) ? <span className="j-err" role="alert">{errs[k]}</span> : hint ? <span className="j-hint">{hint}</span> : null}
    </div>
  );
  const text = (k: keyof AccountForm, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={`${formId}-${k}`} className="j-input" value={f[k] as string} onChange={(e) => set(k, e.target.value as never)}
      aria-invalid={!!show(k)} {...props} />
  );

  return (
    <Dialog open={open} onClose={onClose} wide title={account ? `Edit ${account.name}` : 'Add account'}
      footer={<>
        <button type="button" className="j-btn" onClick={onClose}>Cancel</button>
        <button type="submit" form={formId} className="j-btn primary" disabled={busy}>{busy ? 'Saving' : account ? 'Save changes' : 'Add account'}</button>
      </>}>
      <form id={formId} onSubmit={submit} noValidate className="ac-form">

        <div className="ac-fields">
          {field('name', 'Account name', text('name', { placeholder: 'Apex 50K evaluation', autoFocus: !account, autoComplete: 'off' }), undefined, 'full')}
          {field('account_type', 'Type', (
            <select id={`${formId}-account_type`} className="j-select" value={f.account_type} onChange={(e) => set('account_type', e.target.value as AccountForm['account_type'])}>
              <option value="live">Live</option><option value="demo">Demo</option><option value="paper">Paper</option>
            </select>
          ))}
          {field('broker', 'Broker', text('broker', { placeholder: 'Tradovate', autoComplete: 'off' }))}
          {field('currency', 'Currency', (
            <select id={`${formId}-currency`} className="j-select" value={f.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          ))}
          {field('initial_balance', 'Initial balance', text('initial_balance', { type: 'number', inputMode: 'decimal', step: '0.01', min: 0, placeholder: '50000' }))}
          {field('start_date', 'Start date', text('start_date', { type: 'date' }))}
          <div className="j-field ac-active">
            <span className="j-label">Status</span>
            <label className="ac-switch ac-inline">
              <b>Active</b>
              <input type="checkbox" className="j-switch" role="switch" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            </label>
            <span className="j-hint">Inactive accounts leave the account switcher.</span>
          </div>
        </div>

        <label className="ac-switch ac-prop">
          <span><b>Prop firm account</b><span className="j-hint">Track the profit target, loss floor and daily limit the firm sets.</span></span>
          <input type="checkbox" className="j-switch" role="switch" checked={f.is_prop} onChange={(e) => set('is_prop', e.target.checked)} />
        </label>

        {f.is_prop ? (
          <div className="ac-well">
            <h3>Evaluation rules</h3>
            <div className="ac-fields">
              {field('profit_target', 'Profit target', text('profit_target', { type: 'number', inputMode: 'decimal', step: '0.01', min: 0, placeholder: '3000' }), 'Profit needed to pass.')}
              {field('max_loss_limit', 'Max loss limit', text('max_loss_limit', { type: 'number', inputMode: 'decimal', step: '0.01', min: 0, placeholder: '2500' }), 'How far equity may fall from the floor reference.')}
              {field('daily_loss_limit', 'Daily loss limit', text('daily_loss_limit', { type: 'number', inputMode: 'decimal', step: '0.01', min: 0, placeholder: '1000' }), 'Most you may lose in one day.')}
              {field('minimum_trading_days', 'Minimum trading days', text('minimum_trading_days', { type: 'number', inputMode: 'numeric', step: '1', min: 0, placeholder: '7' }), 'Days with a closed trade.')}
              <label className="ac-switch full">
                <span><b>Trailing drawdown</b><span className="j-hint">The floor follows your highest equity instead of staying at the start balance.</span></span>
                <input type="checkbox" className="j-switch" role="switch" checked={f.trailing} onChange={(e) => set('trailing', e.target.checked)} />
              </label>
            </div>
          </div>
        ) : (
          <div className="ac-fields">
            {field('equity_goal', 'Equity goal', text('equity_goal', { type: 'number', inputMode: 'decimal', step: '0.01', min: 0, placeholder: 'Optional' }), 'The equity level you are building toward. Shown as a progress track.', 'full')}
          </div>
        )}
        {demoNote && <div className="j-notice" role="status" style={{ margin: 0 }}>Sample data is read-only for this action. Sign in to save accounts of your own.</div>}
        {failure && <div className="j-error" role="alert" style={{ margin: 0 }}>{failure}</div>}
      </form>
    </Dialog>
  );
}
