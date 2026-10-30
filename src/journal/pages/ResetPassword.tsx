import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PasswordField, SoloScreen } from '../auth/parts';

/** Landing page of the password-recovery email link: Supabase signs the visitor in with a recovery session, then they pick a new password. */
export default function ResetPassword() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setErr('Use at least 8 characters.');
    if (pw !== again) return setErr('The two passwords do not match.');
    setBusy(true); setErr('');
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    nav('/dashboard', { replace: true });
  };

  if (!loading && !user) {
    return (
      <SoloScreen title="This reset link has expired" sub="Reset links work once and for a short time. Ask for a new one." foot={<Link to="/auth">Back to sign in</Link>}>
        <Link className="j-btn primary" to="/forgot-password" style={{ justifyContent: 'center' }}>Send a new link</Link>
      </SoloScreen>
    );
  }
  return (
    <SoloScreen title="Choose a new password" sub="You will be signed in once it is saved.">
      <form onSubmit={submit} style={{ display: 'grid', gap: 16 }} noValidate>
        <PasswordField label="New password" value={pw} onChange={setPw} autoComplete="new-password" hint="At least 8 characters." error={!!err} />
        <PasswordField label="Repeat the password" value={again} onChange={setAgain} autoComplete="new-password" error={!!err} />
        {err && <p className="j-err" role="alert">{err}</p>}
        <button className="j-btn primary" type="submit" disabled={busy} style={{ justifyContent: 'center' }}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </SoloScreen>
  );
}
