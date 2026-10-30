import type { Transaction } from '../../types';
import type { Account } from '../../types';
import { Pill } from '../../ui/kit';
import { FEE_TYPES, txLabel } from './model';

/** A 4px track. `tone` colours the fill: ink by default, accent for room, warning and loss for trouble. */
export function MiniTrack({ pct, tone = 'ink', label }: { pct: number; tone?: 'ink' | 'sig' | 'warn' | 'neg'; label: string }) {
  return (
    <span className={`ac-track ${tone}`} role="img" aria-label={label}>
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

export function TypePill({ type }: { type: Transaction['transaction_type'] | string }) {
  const kind = type === 'payout' ? 'pos' : FEE_TYPES.includes(type) ? 'warn' : undefined;
  return <Pill kind={kind}>{txLabel(type)}</Pill>;
}

export function StatusMark({ account, breached }: { account: Account; breached?: boolean }) {
  if (breached) return <Pill kind="neg">Breached</Pill>;
  return (
    <span className={`ac-status ${account.is_active ? 'on' : ''}`}>
      <i className="j-dot" aria-hidden="true" />{account.is_active ? 'Active' : 'Inactive'}
    </span>
  );
}

export const currencyOf = (accounts: Account[]) => accounts[0]?.currency ?? 'USD';
export const mixedCurrency = (accounts: Account[]) => new Set(accounts.map((a) => a.currency)).size > 1;
