// The account form's fields, defaults and validation. Shared by the Add/Edit dialog and onboarding so the
// two cannot drift. Styles live in ../Accounts.css (ac- classes).

import { useId } from 'react';
import { isoDate } from '../../format';
import type { Account } from '../../types';
import type { AccountForm } from './api';
import { todayInput } from './model';
import '../Accounts.css';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'INR'];

export const blankAccountForm = (): AccountForm => ({
  name: '', account_type: 'live', broker: '', currency: 'USD', initial_balance: '', start_date: todayInput(), is_active: true,
  is_prop: false, profit_target: '', max_loss_limit: '', daily_loss_limit: '', minimum_trading_days: '', trailing: false, equity_goal: '',
});

export const accountFormFrom = (a: Account): AccountForm => ({
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

export type AccountErrors = Partial<Record<keyof AccountForm, string>>;

export function validateAccount(f: AccountForm): AccountErrors {
  const e: AccountErrors = {};
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

/** Focus the first invalid control inside the form with this id (call after a failed submit). */
export function focusFirstInvalid(formId: string) {
  setTimeout(() => (document.getElementById(formId)?.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus(), 0);
}

export function AccountFields({ formId, f, set, errs, submitted, autoFocusName, hideStatus }: {
  formId: string;
  f: AccountForm;
  set: <K extends keyof AccountForm>(k: K, v: AccountForm[K]) => void;
  errs: AccountErrors;
  submitted: boolean;
  autoFocusName?: boolean;
  /** Onboarding creates an active account; the Active switch only matters when editing. */
  hideStatus?: boolean;
}) {
  const uid = useId();
  const show = (k: keyof AccountForm) => (submitted ? errs[k] : undefined);
  const idOf = (k: keyof AccountForm) => `${uid}-${k}`;

  const field = (k: keyof AccountForm, label: string, input: React.ReactNode, hint?: string, cls = '') => (
    <div className={`j-field ${cls}`}>
      <label htmlFor={idOf(k)}>{label}</label>
      {input}
      {show(k) ? <span className="j-err" role="alert">{errs[k]}</span> : hint ? <span className="j-hint">{hint}</span> : null}
    </div>
  );
  const text = (k: keyof AccountForm, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={idOf(k)} className="j-input" value={f[k] as string} onChange={(e) => set(k, e.target.value as never)}
      aria-invalid={!!show(k)} {...props} />
  );

  return (
    <>
      <div className="ac-fields">
        {field('name', 'Account name', text('name', { placeholder: 'Apex 50K evaluation', autoFocus: autoFocusName, autoComplete: 'off' }), undefined, 'full')}
        {field('account_type', 'Type', (
          <select id={idOf('account_type')} className="j-select" value={f.account_type} onChange={(e) => set('account_type', e.target.value as AccountForm['account_type'])}>
            <option value="live">Live</option><option value="demo">Demo</option><option value="paper">Paper</option>
          </select>
        ))}
        {field('broker', 'Broker', text('broker', { placeholder: 'Tradovate', autoComplete: 'off' }))}
        {field('currency', 'Currency', (
          <select id={idOf('currency')} className="j-select" value={f.currency} onChange={(e) => set('currency', e.target.value)}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        ))}
        {field('initial_balance', 'Initial balance', text('initial_balance', { type: 'number', inputMode: 'decimal', step: '0.01', min: 0, placeholder: '50000' }))}
        {field('start_date', 'Start date', text('start_date', { type: 'date' }))}
        {!hideStatus && (
          <div className="j-field ac-active">
            <span className="j-label">Status</span>
            <label className="ac-switch ac-inline">
              <b>Active</b>
              <input type="checkbox" className="j-switch" role="switch" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            </label>
            <span className="j-hint">Inactive accounts leave the account switcher.</span>
          </div>
        )}
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
    </>
  );
}
