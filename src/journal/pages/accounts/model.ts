// Derived figures for the Accounts screen. Everything is computed from the rows passed in,
// so a total on screen always equals the sum of the rows beside it.

import { accountEquity, isClosed, pnlOf, propStatus, transactionNet, type PropStatus } from '../../analytics';
import type { Account, Trade, Transaction, TransactionType } from '../../types';

export const FEE_TYPES: string[] = ['challenge_fee', 'evaluation_fee', 'funded_account_fee', 'commission'];

export const TX_TYPES: { key: TransactionType; label: string; effect: string }[] = [
  { key: 'deposit', label: 'Deposit', effect: 'Adds to equity.' },
  { key: 'withdrawal', label: 'Withdrawal', effect: 'Subtracts from equity.' },
  { key: 'payout', label: 'Payout', effect: 'Adds to equity, and counts as cash you received.' },
  { key: 'challenge_fee', label: 'Challenge fee', effect: 'A cost. Equity does not change.' },
  { key: 'evaluation_fee', label: 'Evaluation fee', effect: 'A cost. Equity does not change.' },
  { key: 'funded_account_fee', label: 'Funded account fee', effect: 'A cost. Equity does not change.' },
  { key: 'balance_adjustment', label: 'Balance adjustment', effect: 'Sets the account balance to a corrected amount.' },
];

export const txLabel = (t: string) =>
  TX_TYPES.find((x) => x.key === t)?.label ?? (t === 'commission' ? 'Commission' : t === 'other' ? 'Other' : t);

/** The sign an amount carries in the ledger: money in is positive, money out and costs negative. */
export function txSigned(x: Pick<Transaction, 'transaction_type' | 'amount'>): number {
  if (x.transaction_type === 'deposit' || x.transaction_type === 'payout' || x.transaction_type === 'balance_adjustment') return x.amount;
  if (x.transaction_type === 'withdrawal' || FEE_TYPES.includes(x.transaction_type)) return -x.amount;
  return x.amount;
}

export interface CashTotals { deposits: number; withdrawals: number; payouts: number; fees: number; net: number; count: number }

/** Net cash position = withdrawals + payouts - deposits - fees. */
export function cashTotals(txs: Transaction[]): CashTotals {
  let deposits = 0, withdrawals = 0, payouts = 0, fees = 0;
  for (const x of txs) {
    if (x.transaction_type === 'deposit') deposits += x.amount;
    else if (x.transaction_type === 'withdrawal') withdrawals += x.amount;
    else if (x.transaction_type === 'payout') payouts += x.amount;
    else if (FEE_TYPES.includes(x.transaction_type)) fees += x.amount;
  }
  return { deposits, withdrawals, payouts, fees, net: withdrawals + payouts - deposits - fees, count: txs.length };
}

export const kindLabel = (a: Account) =>
  a.is_prop_firm ? 'Prop' : a.account_type === 'paper' ? 'Paper' : a.account_type === 'demo' ? 'Demo' : 'Live';

export const kindLong = (a: Account) =>
  a.is_prop_firm ? 'Prop evaluation' : a.account_type === 'paper' ? 'Paper account' : a.account_type === 'demo' ? 'Demo account' : 'Live account';

export interface AccountRow {
  account: Account;
  index: number; // position in the full account list: fixes the avatar hue
  equity: number;
  result: number; // realised trading result since start
  trades: number;
  closed: number;
  prop: PropStatus | null;
  breached: boolean;
  goalPct: number | null;
  roomPct: number | null;
}

export function accountRow(a: Account, index: number, trades: Trade[], txs: Transaction[]): AccountRow {
  const mine = trades.filter((t) => t.trading_account_id === a.id);
  const result = mine.filter(isClosed).reduce((s, t) => s + pnlOf(t), 0);
  const prop = a.is_prop_firm ? propStatus(a, trades, txs) : null;
  const equity = accountEquity(a, trades, txs);
  const breached = !!prop && ((prop.bufferToFloor != null && prop.bufferToFloor <= 0) || (prop.dailyLimit != null && -prop.dailyPnl >= prop.dailyLimit));
  const goalPct = !a.is_prop_firm && a.equity_goal && a.equity_goal > a.initial_balance
    ? Math.max(0, ((equity - a.initial_balance) / (a.equity_goal - a.initial_balance)) * 100) : null;
  const roomPct = prop && prop.bufferToFloor != null && a.max_loss_limit ? Math.max(0, Math.min(100, (prop.bufferToFloor / a.max_loss_limit) * 100)) : null;
  return { account: a, index, equity, result, trades: mine.length, closed: mine.filter(isClosed).length, prop, breached, goalPct, roomPct };
}

export const txOf = (txs: Transaction[], accountId: string) => txs.filter((x) => x.trading_account_id === accountId);
export { transactionNet };

export class DemoReadOnly extends Error {
  constructor() { super('Sample data is read-only for this action. Sign in to save changes to your own accounts.'); }
}

export const todayInput = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** A date typed in an <input type=date> becomes local noon, so it never slips a day across zones. */
export const dateInputToIso = (v: string) => new Date(`${v}T12:00:00`).toISOString();
