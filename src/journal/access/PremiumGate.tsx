import { useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { SoloScreen } from '../auth/parts';
import { BLUEPILL, SUPPORT_EMAIL } from './bluepill';

/**
 * Everything signed-in, onboarding included, sits behind this. The journal is part of the Blue Pill, so a
 * signed-in account with no membership sees where to get one instead of the app. Sample data is not behind it
 * (see RequireAuth): it is the preview.
 *
 * This is the interface half. What stops someone granting themselves access is in
 * supabase/migrations/20261116090000_lock_premium_grants.sql.
 */
export function PremiumGate({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const { isLoading, isPremium, checkFailed } = useSubscription();
  if (isLoading) return <>{fallback}</>;
  if (isPremium) return <>{children}</>;
  return checkFailed ? <CheckFailed /> : <NoAccess />;
}

function SignOutLink() {
  const { signOut } = useAuth();
  return <button type="button" className="auth-link" onClick={() => void signOut()}>sign out</button>;
}

/** Signed in, but this email has no active membership. */
function NoAccess() {
  const { user } = useAuth();
  const { checkSubscription } = useSubscription();
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  const recheck = async () => {
    setChecking(true);
    await checkSubscription();
    setChecking(false);
    setChecked(true);
  };

  return (
    <SoloScreen
      title="The journal comes with the Blue Pill"
      sub={<>IFVG Journal is included with every Blue Pill membership, {BLUEPILL.price} {BLUEPILL.per}. <b>{user?.email}</b> has no active membership.</>}
      foot={<>Joined with a different email? <SignOutLink /> and sign in with that one, or write to <a className="auth-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</>}
    >
      <div className="auth-actions">
        <a className="j-btn primary" href={BLUEPILL.url} target="_blank" rel="noopener noreferrer">Get the Blue Pill</a>
        <button type="button" className="j-btn ghost" onClick={recheck} disabled={checking}>
          {checking ? 'Checking…' : 'I have joined, check again'}
        </button>
      </div>
      {checked && !checking && (
        <p className="auth-msg" role="status">Still no active membership on {user?.email}. It can take a minute after you pay.</p>
      )}
    </SoloScreen>
  );
}

/** The membership lookup itself failed: say so rather than tell a paying member they have no access. */
function CheckFailed() {
  const { checkSubscription } = useSubscription();
  const [checking, setChecking] = useState(false);
  const retry = async () => { setChecking(true); await checkSubscription(); setChecking(false); };
  return (
    <SoloScreen
      title="We could not check your membership"
      sub="The check did not go through, so nothing about your access has changed. Try again in a moment."
      foot={<>Still stuck? <SignOutLink /> and back in, or write to <a className="auth-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</>}
    >
      <div className="auth-actions">
        <button type="button" className="j-btn primary" onClick={retry} disabled={checking}>{checking ? 'Trying…' : 'Try again'}</button>
      </div>
    </SoloScreen>
  );
}
