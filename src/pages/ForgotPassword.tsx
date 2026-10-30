import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Field, SoloScreen } from '@/journal/auth/parts';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message);
      } else {
        setEmailSent(true);
      }
    } catch (error) {
      setError('Failed to send the reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <SoloScreen
        title="Check your email"
        sub={<>If an account exists for <span className="auth-addr">{email}</span>, a reset link is on its way. It expires in 1 hour.</>}
      >
        <div className="auth-actions">
          <Link to="/auth" className="j-btn primary">Back to sign in</Link>
        </div>
      </SoloScreen>
    );
  }

  return (
    <SoloScreen title="Reset your password" sub="Enter the email you signed up with and we will send you a reset link.">
      <form onSubmit={handleResetPassword} style={{ display: 'grid', gap: 16 }} aria-label="Reset password">
        <Field label="Email" name="email" type="email" value={email} onChange={setEmail} autoComplete="email" disabled={loading} />
        {error && <p className="auth-err" role="alert">{error}</p>}
        <div className="auth-actions">
          <button type="submit" className="j-btn primary" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
          <Link to="/auth" className="j-btn ghost">Back to sign in</Link>
        </div>
      </form>
    </SoloScreen>
  );
};

export default ForgotPassword;
