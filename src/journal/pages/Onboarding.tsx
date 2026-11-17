// /onboarding. First-run setup once the email is verified:
//   method  -> add an account manually (connecting a broker account is phase 2, shown as coming soon)
//   details -> the account form
//   import  -> bring in trades from a CSV, or "Import later"
// Leaving the flow records has_completed_onboarding and lands on the dashboard. OnboardingGate decides who
// is sent here; the step is derived from data, so a reload after creating the account resumes at import.

import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useJournal } from '../JournalProvider';
import { money } from '../format';
import { SoloScreen, Steps } from '../auth/parts';
import { ErrorBlock } from '../ui/kit';
import type { Trade } from '../types';
import { useOnboardingState } from '../onboarding/state';
import { AccountFields, blankAccountForm, focusFirstInvalid, validateAccount } from './accounts/AccountFields';
import { writeAccount, type AccountForm } from './accounts/api';
import ImportTradesDialog from './ImportTradesDialog';
import './Accounts.css';

type Step = 'method' | 'details' | 'import';

export default function Onboarding() {
  const J = useJournal();
  const { user, signOut } = useAuth();
  const { finish } = useOnboardingState();
  const nav = useNavigate();

  const [step, setStep] = useState<Step>(() => (J.accounts.length ? 'import' : 'method'));
  const [accountId, setAccountId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [imported, setImported] = useState(0);

  // The account trades go into: the one just created, else the oldest active one (resuming after a reload).
  const active = useMemo(() => J.accounts.filter((a) => a.is_active), [J.accounts]);
  const target = useMemo(
    () => active.find((a) => a.id === accountId) ?? [...active].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))[0] ?? null,
    [active, accountId],
  );

  // Details has its own autofocus; the other steps announce themselves by taking focus on the heading.
  useEffect(() => {
    if (step !== 'details') document.querySelector<HTMLElement>('.auth-head h1')?.focus({ preventScroll: true });
  }, [step]);

  const leave = () => {
    void finish();
    nav('/dashboard', { replace: true });
  };

  // ---- details form ----
  const formId = useId();
  const [f, setF] = useState<AccountForm>(blankAccountForm);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const errs = useMemo(() => validateAccount(f), [f]);
  const set = <K extends keyof AccountForm>(k: K, v: AccountForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const createAccount = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    setSubmitted(true); setFailure(null);
    if (Object.keys(errs).length) { focusFirstInvalid(formId); return; }
    setBusy(true);
    try {
      const id = await writeAccount(J, { ...f, is_active: true });
      await J.refresh();
      setAccountId(id);
      setStep('import');
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Could not create the account. Try again.');
    } finally { setBusy(false); }
  };

  const onImport = async (id: string, trades: Partial<Trade>[]) => {
    await J.importTrades(id, trades);
    setImported((n) => n + trades.length);
  };

  const who = (
    <>
      Signed in as {user?.email}. <button type="button" className="auth-link" onClick={async () => { await signOut(); nav('/auth', { replace: true }); }}>Sign out</button>
    </>
  );

  if (step === 'method') {
    return (
      <SoloScreen steps={<Steps current={3} />} title="Add your first account" foot={who}
        sub="Balance, drawdown and progress are tracked per account. Choose how to add yours.">
        {J.error && <ErrorBlock message={J.error} onRetry={() => void J.refresh()} />}
        <ul className="ob-options">
          <li>
            <button type="button" className="ob-option" onClick={() => setStep('details')}>
              <span><b>Create an account manually</b><small>Enter the balance and rules yourself, then import past trades or log them as you go.</small></span>
              <ArrowRight aria-hidden="true" />
            </button>
          </li>
          <li>
            <button type="button" className="ob-option" disabled>
              <span><b>Connect a broker account</b><small>Sync trades automatically from your broker or prop firm.</small></span>
              <span className="j-pill">Coming soon</span>
            </button>
          </li>
        </ul>
      </SoloScreen>
    );
  }

  if (step === 'details') {
    return (
      <SoloScreen wide steps={<Steps current={3} />} title="Set up your account" foot={who}
        sub="These figures drive your balance, limits and progress. You can edit them later in Accounts.">
        <form id={formId} onSubmit={createAccount} noValidate className="ac-form" aria-label="New account">
          <AccountFields formId={formId} f={f} set={set} errs={errs} submitted={submitted} autoFocusName hideStatus />
          {failure && <p className="auth-err" role="alert">{failure}</p>}
          <div className="ob-actions">
            <button type="button" className="j-btn ghost" onClick={() => setStep('method')} disabled={busy}>Back</button>
            <button type="submit" className="j-btn primary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
          </div>
        </form>
      </SoloScreen>
    );
  }

  const done = imported > 0;
  return (
    <SoloScreen steps={<Steps current={4} />} foot={who}
      title={done ? `${imported} ${imported === 1 ? 'trade' : 'trades'} imported` : 'Bring in your trades'}
      sub={done
        ? 'They are in your journal now. Import another file, or head to your dashboard.'
        : 'Import a CSV export from your broker or platform, or start fresh and log trades as you go.'}>
      {J.error && <ErrorBlock message={J.error} onRetry={() => void J.refresh()} />}
      {target && (
        <dl className="auth-rows" aria-label="Account">
          <div><dt>Account</dt><dd>{target.name}</dd></div>
          <div><dt>Starting balance</dt><dd>{money(target.initial_balance, target.currency, { mode: 'money' })}</dd></div>
        </dl>
      )}
      <div className="auth-actions">
        {done ? (
          <>
            <button type="button" className="j-btn primary" onClick={leave}>Go to dashboard</button>
            <button type="button" className="j-btn" onClick={() => setImportOpen(true)} disabled={!target}><Upload /> Import another file</button>
          </>
        ) : (
          <>
            <button type="button" className="j-btn primary" onClick={() => setImportOpen(true)} disabled={!target}><Upload /> Import CSV</button>
            <button type="button" className="j-btn" onClick={leave}>Import later</button>
            <p className="auth-fine ob-note">You can import any time from Journal, using Import CSV.</p>
          </>
        )}
      </div>
      {importOpen && target && (
        <ImportTradesDialog accounts={active} selectedAccountId={target.id} onClose={() => setImportOpen(false)} onImport={onImport} />
      )}
    </SoloScreen>
  );
}
