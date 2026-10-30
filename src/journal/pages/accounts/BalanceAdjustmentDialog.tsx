import { useEffect, useId, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useJournal } from '../../JournalProvider';
import { money } from '../../format';
import { Dialog } from '../../ui/kit';
import { writeBalanceAdjustment } from './api';
import { DemoReadOnly } from './model';

export function BalanceAdjustmentDialog({ open, onClose, accountId, accountName, currency, currentBalance, onDemo }: {
  open: boolean; onClose: () => void; accountId: string; accountName: string; currency: string; currentBalance: number; onDemo: () => void;
}) {
  const J = useJournal();
  const { toast } = useToast();
  const inputId = useId();
  const [target, setTarget] = useState(String(currentBalance.toFixed(2)));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    if (open) { setTarget(currentBalance.toFixed(2)); setFailure(''); setBusy(false); }
  }, [open, currentBalance]);
  const amount = target.trim() === '' ? NaN : Number(target);
  const delta = Number.isFinite(amount) ? Math.round((amount - currentBalance) * 100) / 100 : 0;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setFailure('');
    if (!Number.isFinite(amount) || amount < 0) { setFailure('Enter a balance of zero or more.'); return; }
    if (Math.abs(delta) < 0.01) { setFailure('Enter a different balance to adjust.'); return; }
    if (J.isDemo) { onDemo(); return; }
    setBusy(true);
    try {
      await writeBalanceAdjustment(J, accountId, amount, currentBalance);
      await J.refresh();
      toast({ title: 'Account balance adjusted', description: `${accountName} is now ${money(amount, currency)}.` });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not adjust the balance.';
      setFailure(message);
      toast({ title: 'Balance adjustment failed', description: message, variant: 'destructive' });
      if (error instanceof DemoReadOnly) onDemo();
    } finally { setBusy(false); }
  };
  return <Dialog open={open} onClose={onClose} title="Adjust current balance" footer={<>
    <button type="button" className="j-btn" onClick={onClose} disabled={busy}>Cancel</button>
    <button type="submit" form={inputId} className="j-btn primary" disabled={busy}>{busy ? 'Saving…' : 'Set balance'}</button>
  </>}>
    <form id={inputId} onSubmit={(event) => void submit(event)} className="ac-form" noValidate>
      <p style={{ color: 'var(--text-2)', margin: 0 }}>Set the balance for <b>{accountName}</b>. This records a balance adjustment in the account history; it does not change past trades.</p>
      <div className="j-field">
        <label htmlFor={`${inputId}-balance`}>Current balance ({currency})</label>
        <input id={`${inputId}-balance`} className="j-input" type="number" inputMode="decimal" min="0" step="0.01" autoFocus value={target} onChange={(event) => setTarget(event.target.value)} />
      </div>
      <div className="j-meta">Current: {money(currentBalance, currency)} · Adjustment: {money(delta, currency, { sign: true })}</div>
      {failure && <div className="j-error" role="alert" style={{ margin: 0 }}>{failure}</div>}
    </form>
  </Dialog>;
}
