// Pieces the four Playbook tabs share: the demo write guard, a phone media query, small parsers.

import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { useJournal } from '../../JournalProvider';
import type { Strategy } from '../../types';

/** The strategies table carries more columns than the shared `Strategy` row type lists. */
export type SetupRow = Strategy & {
  partial_criteria?: string | null;
  be_criteria?: string | null;
  market_conditions?: string | null;
  max_risk_reward?: number | null;
};

export const lines = (s?: string | null) => (s ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
export const numOrNull = (v: string | number | null | undefined) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
export const errText = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'Something went wrong');
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function useMedia(query: string) {
  const [on, setOn] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches));
  useEffect(() => {
    const m = window.matchMedia(query);
    const h = () => setOn(m.matches);
    h();
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, [query]);
  return on;
}

/** Demo and signed-out sessions never reach the network: `guard()` returns false and raises the notice. */
export function useWriteGuard() {
  const { isDemo, userId, refresh } = useJournal();
  const [blocked, setBlocked] = useState(false);
  const guard = useCallback((): string | false => {
    if (isDemo || !userId) { setBlocked(true); return false; }
    setBlocked(false);
    return userId;
  }, [isDemo, userId]);
  const clear = useCallback(() => setBlocked(false), []);
  return { guard, blocked, clear, refresh, isDemo };
}

export function DemoNotice({ onClose, compact }: { onClose: () => void; compact?: boolean }) {
  return (
    <div className={`j-notice ${compact ? 'pb-compact' : ''}`} role="status">
      <span>{compact ? 'Sample data is read-only for edits.' : 'Sample data is read-only for edits. Sign in to build your own playbook.'}</span>
      {!compact && <button className="j-link" onClick={onClose}>Dismiss</button>}
    </div>
  );
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={`j-field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <span className="j-hint">{hint}</span>}
    </div>
  );
}

export function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="pb-switch-row">
      <span><span className="t">{label}</span>{hint && <span className="j-hint">{hint}</span>}</span>
      <input type="checkbox" role="switch" className="j-switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
