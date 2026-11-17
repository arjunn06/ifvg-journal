// /verify-email. The second step of sign-up: enter the 6-digit code we emailed. A correct code signs the
// user in (verifyOtp returns a session), and the signed-in redirect below carries them on to onboarding.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SoloScreen, Steps } from '@/journal/auth/parts';
import { OtpInput } from '@/journal/auth/OtpInput';
import { OTP_LENGTH, RESEND_SECONDS, clearPending, readPending, resendWait, sendSignupCode, verifySignupCode } from '@/journal/auth/otp';

const VerifyEmail = () => {
  const { user } = useAuth();
  const loc = useLocation();
  // Router state wins (fresh from sign-up or sign-in); sessionStorage covers a reload.
  const pending = readPending();
  const email = (loc.state as { email?: string } | null)?.email ?? pending?.email ?? '';

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wait, setWait] = useState(() => (pending && pending.email === email ? resendWait(pending.sentAt) : 0));
  const field = useRef<HTMLInputElement>(null);
  // A ref, not state: auto-submit on the sixth digit and the Enter key can both fire before a re-render.
  const inFlight = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = useCallback(async (value: string) => {
    if (inFlight.current || value.length !== OTP_LENGTH) return;
    inFlight.current = true;
    setVerifying(true); setError(null); setNotice(null);
    const failure = await verifySignupCode(email, value);
    if (failure) {
      setError(failure); setCode(''); setVerifying(false);
      inFlight.current = false;
      setTimeout(() => field.current?.focus(), 0);
    }
    // On success the auth listener sets `user` and the redirect below takes over; keep the form locked until then.
  }, [email]);

  const resend = async () => {
    setResending(true); setError(null); setNotice(null);
    const { error: err, rateLimited } = await sendSignupCode(email);
    if (err) setError(err);
    else { setNotice('A new code is on its way. Only the newest one works.'); setCode(''); }
    if (!err || rateLimited) setWait(RESEND_SECONDS);
    setResending(false);
    setTimeout(() => field.current?.focus(), 0);
  };

  if (user) return <Navigate to="/onboarding" replace />;
  if (!email) return <Navigate to="/auth?mode=signup" replace />;

  return (
    <SoloScreen
      steps={<Steps current={2} />}
      title="Check your email"
      sub={<>We sent a {OTP_LENGTH}-digit code to <span className="auth-addr">{email}</span>. Enter it to verify your address.</>}
      foot="No email? Check your spam folder, then send a new code. Each new code replaces the last."
    >
      <form className="auth-actions" onSubmit={(e) => { e.preventDefault(); void verify(code); }} aria-label="Verify email">
        <OtpInput ref={field} value={code} onChange={setCode} onComplete={(v) => void verify(v)} disabled={verifying} invalid={!!error} describedBy="otp-status" />
        <div id="otp-status" aria-live="polite" className="auth-actions">
          {error && <p className="auth-err" role="alert">{error}</p>}
          {notice && <p className="auth-msg" role="status">{notice}</p>}
        </div>
        <button type="submit" className="j-btn primary" disabled={verifying || code.length !== OTP_LENGTH}>
          {verifying ? 'Verifying…' : 'Verify email'}
        </button>
        <button type="button" className="j-btn" onClick={() => void resend()} disabled={resending || verifying || wait > 0}>
          {resending ? 'Sending…' : wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        </button>
        <Link to="/auth?mode=signup" className="j-btn ghost" onClick={clearPending}>Use a different email</Link>
      </form>
    </SoloScreen>
  );
};

export default VerifyEmail;
