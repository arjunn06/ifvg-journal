import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Field, PasswordField, SoloScreen } from '@/journal/auth/parts';

interface InvitationData {
  id: string;
  email: string;
  status: string;
  expires_at: string;
}

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    displayName: ''
  });
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { user, signUp } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const validateInvitation = async () => {
      if (!token) {
        setError('Invalid invitation link');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('invitations')
          .select('*')
          .eq('token', token)
          .single();

        if (error || !data) {
          setError('Invitation not found');
          setLoading(false);
          return;
        }

        if (data.status !== 'pending') {
          setError('This invitation has already been used');
          setLoading(false);
          return;
        }

        if (new Date(data.expires_at) < new Date()) {
          setError('This invitation has expired');
          setLoading(false);
          return;
        }

        setInvitation(data);
      } catch (error) {
        console.error('Error validating invitation:', error);
        setError('Failed to validate invitation');
      } finally {
        setLoading(false);
      }
    };

    validateInvitation();
  }, [token]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setFormError(null);

    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    setIsSigningUp(true);

    try {
      const { error } = await signUp(
        invitation!.email,
        formData.password,
        formData.displayName
      );

      if (error) {
        setFormError(error.message);
        return;
      }

      // Mark invitation as used
      await supabase
        .from('invitations')
        .update({ 
          status: 'used',
          used_at: new Date().toISOString()
        })
        .eq('token', token);

      toast({
        title: 'Welcome to IFVG Journal!',
        description: 'Your account has been created successfully',
      });

    } catch (error: any) {
      setFormError(error.message || 'An error occurred during sign up.');
    } finally {
      setIsSigningUp(false);
    }
  };

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <SoloScreen title="Checking your invitation" sub="One moment.">
        <div className="j-track" role="progressbar" aria-label="Validating invitation"><i style={{ width: '40%' }} /></div>
      </SoloScreen>
    );
  }

  if (error) {
    return (
      <SoloScreen title="This invitation can't be used" sub={error + '.'}>
        <div className="auth-actions">
          <Link to="/auth" className="j-btn primary">Go to sign in</Link>
          <Link to="/" className="j-btn ghost">Back to home</Link>
        </div>
      </SoloScreen>
    );
  }

  return (
    <SoloScreen title="Join the IFVG Journal beta" sub="You have been invited. Choose a name and a password to create your account.">
      <form onSubmit={handleSignUp} style={{ display: 'grid', gap: 16 }} aria-label="Create your account">
        <Field label="Email" type="email" value={invitation?.email ?? ''} readOnly autoComplete="email"
          hint="The invitation is tied to this address." />
        <Field label="Display name" name="name" value={formData.displayName} autoComplete="name"
          onChange={(v) => setFormData(prev => ({ ...prev, displayName: v }))} disabled={isSigningUp} />
        <PasswordField label="Password" name="password" value={formData.password} autoComplete="new-password" hint="Use at least 6 characters."
          onChange={(v) => setFormData(prev => ({ ...prev, password: v }))} disabled={isSigningUp} />
        <PasswordField label="Confirm password" name="confirm" value={formData.confirmPassword} autoComplete="new-password"
          onChange={(v) => setFormData(prev => ({ ...prev, confirmPassword: v }))} disabled={isSigningUp} />
        {formError && <p className="auth-err" role="alert">{formError}</p>}
        <div className="auth-actions">
          <button type="submit" className="j-btn primary" disabled={isSigningUp}>{isSigningUp ? 'Creating account…' : 'Create account'}</button>
        </div>
      </form>
    </SoloScreen>
  );
}
