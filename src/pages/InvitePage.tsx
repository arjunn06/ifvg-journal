import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';

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
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive'
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive'
      });
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
        toast({
          title: 'Sign Up Failed',
          description: error.message,
          variant: 'destructive'
        });
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
      toast({
        title: 'Error',
        description: error.message || 'An error occurred during sign up',
        variant: 'destructive'
      });
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button asChild>
              <a href="/">Back to Home</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CheckCircle className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Welcome to IFVG Journal Beta!</CardTitle>
          <p className="text-sm text-muted-foreground">
            You've been invited to join our exclusive beta
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4" />
              <span className="font-medium">{invitation?.email}</span>
            </div>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Enter your display name"
                value={formData.displayName}
                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a strong password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSigningUp}>
              {isSigningUp ? 'Creating Account...' : 'Join IFVG Journal Beta'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}