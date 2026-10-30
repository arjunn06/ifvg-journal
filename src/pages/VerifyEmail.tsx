import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SoloScreen } from '@/journal/auth/parts';

const VerifyEmail = () => {
  const [isResending, setIsResending] = useState(false);
  const [emailResent, setEmailResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = new URLSearchParams(window.location.search).get('email') || '';

  const handleResendEmail = async () => {
    setIsResending(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        setError(error.message);
      } else {
        setEmailResent(true);
      }
    } catch (error) {
      setError('Failed to resend the verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SoloScreen
      title="Check your email"
      sub={email
        ? <>We sent a verification link to <span className="auth-addr">{email}</span>. Open it to activate your account.</>
        : 'We sent you a verification link. Open it to activate your account.'}
      foot="No email? Check your spam folder, then resend it."
    >
      <div className="auth-actions" aria-live="polite">
        {error && <p className="auth-err" role="alert">{error}</p>}
        {emailResent && <p className="auth-msg" role="status">A new verification email is on its way.</p>}
        <button type="button" className="j-btn primary" onClick={handleResendEmail} disabled={isResending || emailResent || !email}>
          {isResending ? 'Sending…' : emailResent ? 'Email sent' : 'Resend email'}
        </button>
        <Link to="/auth" className="j-btn ghost">Back to sign in</Link>
      </div>
    </SoloScreen>
  );
};

export default VerifyEmail;
