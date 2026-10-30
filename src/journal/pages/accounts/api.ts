// Writes for accounts and money movements. Nothing here runs in demo mode: callers check `isDemo`
// first and show the read-only notice; the guard below is a second wall, not the first.

import { supabase } from '@/integrations/supabase/client';
import { DemoReadOnly } from './model';

export interface AccountForm {
  name: string;
  account_type: 'live' | 'demo' | 'paper';
  broker: string;
  currency: string;
  initial_balance: string;
  start_date: string; // yyyy-mm-dd
  is_active: boolean;
  is_prop: boolean;
  profit_target: string;
  max_loss_limit: string;
  daily_loss_limit: string;
  minimum_trading_days: string;
  trailing: boolean;
  equity_goal: string;
}

const num = (s: string) => (s.trim() === '' ? null : Number(s));
const noon = (v: string) => new Date(`${v}T12:00:00`);

export async function writeAccount(ctx: { isDemo: boolean; userId: string | null }, form: AccountForm, id?: string): Promise<string> {
  if (ctx.isDemo) throw new DemoReadOnly();
  if (!ctx.userId) throw new Error('You are signed out. Sign in again to save.');
  const initial = Number(form.initial_balance);
  const start = noon(form.start_date);
  const minDays = form.is_prop ? num(form.minimum_trading_days) : null;
  const base = {
    name: form.name.trim(),
    account_type: form.account_type,
    broker: form.broker.trim() || null,
    initial_balance: initial,
    currency: form.currency,
    is_active: form.is_active,
    is_prop_firm: form.is_prop,
    equity_goal: form.is_prop ? null : num(form.equity_goal),
    profit_target: form.is_prop ? num(form.profit_target) : null,
    max_loss_limit: form.is_prop ? num(form.max_loss_limit) : null,
    daily_loss_limit: form.is_prop ? num(form.daily_loss_limit) : null,
    minimum_trading_days: minDays,
    trailing_drawdown_enabled: form.is_prop ? form.trailing : false,
    start_date: start.toISOString(),
    target_completion_date: form.is_prop && minDays ? new Date(start.getTime() + minDays * 86400000).toISOString() : null,
    user_id: ctx.userId,
  };
  if (id) {
    const { error } = await supabase.from('trading_accounts').update(base as never).eq('id', id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await supabase
    .from('trading_accounts')
    .insert({ ...base, current_balance: initial, current_equity: initial } as never)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function setAccountActive(ctx: { isDemo: boolean }, id: string, active: boolean) {
  if (ctx.isDemo) throw new DemoReadOnly();
  const { error } = await supabase.from('trading_accounts').update({ is_active: active } as never).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function removeAccount(ctx: { isDemo: boolean }, id: string) {
  if (ctx.isDemo) throw new DemoReadOnly();
  const { error } = await supabase.from('trading_accounts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export interface TxForm { account: string; type: string; amount: string; date: string; description: string }

export async function writeTransaction(ctx: { isDemo: boolean; userId: string | null }, f: TxForm) {
  if (ctx.isDemo) throw new DemoReadOnly();
  if (!ctx.userId) throw new Error('You are signed out. Sign in again to save.');
  const { error } = await supabase.from('financial_transactions').insert({
    user_id: ctx.userId,
    trading_account_id: f.account,
    transaction_type: f.type,
    amount: Number(f.amount),
    description: f.description.trim() || null,
    transaction_date: noon(f.date).toISOString(),
  } as never);
  if (error) throw new Error(error.message);
}

export async function writeBalanceAdjustment(ctx: { isDemo: boolean; userId: string | null }, accountId: string, target: number, current: number) {
  if (ctx.isDemo) throw new DemoReadOnly();
  if (!ctx.userId) throw new Error('You are signed out. Sign in again to save.');
  const difference = Math.round((target - current) * 100) / 100;
  if (!Number.isFinite(difference) || Math.abs(difference) < 0.01) throw new Error('The adjusted balance must differ from the current balance.');
  const { error } = await supabase.from('financial_transactions').insert({
    user_id: ctx.userId,
    trading_account_id: accountId,
    transaction_type: 'balance_adjustment',
    amount: difference,
    description: 'Manual balance adjustment',
    transaction_date: new Date().toISOString(),
  } as never);
  if (error) throw new Error(error.message);
}

export async function removeTransaction(ctx: { isDemo: boolean }, id: string) {
  if (ctx.isDemo) throw new DemoReadOnly();
  const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
