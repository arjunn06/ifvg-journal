// Add / edit account. One dialog for both; the prop-firm switch reveals the evaluation rules.
// The fields and validation are shared with onboarding (AccountFields).

import { useEffect, useId, useMemo, useState } from 'react';
import { useJournal } from '../../JournalProvider';
import { Dialog } from '../../ui/kit';
import type { Account } from '../../types';
import { writeAccount, type AccountForm } from './api';
import { AccountFields, accountFormFrom, blankAccountForm, focusFirstInvalid, validateAccount } from './AccountFields';
import { DemoReadOnly } from './model';

export function AccountDialog({ open, onClose, account, onSaved, onDemo }: {
  open: boolean; onClose: () => void; account?: Account | null; onSaved: (id: string) => void; onDemo: () => void;
}) {
  const J = useJournal();
  const formId = useId();
  const [f, setF] = useState<AccountForm>(blankAccountForm);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [demoNote, setDemoNote] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(account ? accountFormFrom(account) : blankAccountForm());
    setSubmitted(false); setBusy(false); setFailure(null); setDemoNote(false);
  }, [open, account]);

  const errs = useMemo(() => validateAccount(f), [f]);
  const set = <K extends keyof AccountForm>(k: K, v: AccountForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    if (busy) return;
    setSubmitted(true); setFailure(null);
    if (Object.keys(errs).length) { focusFirstInvalid(formId); return; }
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

  return (
    <Dialog open={open} onClose={onClose} wide title={account ? `Edit ${account.name}` : 'Add account'}
      footer={<>
        <button type="button" className="j-btn" onClick={onClose}>Cancel</button>
        <button type="submit" form={formId} className="j-btn primary" disabled={busy}>{busy ? 'Saving' : account ? 'Save changes' : 'Add account'}</button>
      </>}>
      <form id={formId} onSubmit={submit} noValidate className="ac-form">
        <AccountFields formId={formId} f={f} set={set} errs={errs} submitted={submitted} autoFocusName={!account} />
        {demoNote && <div className="j-notice" role="status" style={{ margin: 0 }}>Sample data is read-only for this action. Sign in to save accounts of your own.</div>}
        {failure && <div className="j-error" role="alert" style={{ margin: 0 }}>{failure}</div>}
      </form>
    </Dialog>
  );
}
