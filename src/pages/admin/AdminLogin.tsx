import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Lock } from 'lucide-react';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const { user, signIn } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        setIsAdmin(data?.role === 'admin');
      }
    };

    checkAdminStatus();
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        toast({
          title: 'Login Failed',
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      // Get the newly signed-in user's session
      const { data: sessionData } = await supabase.auth.getUser();
      const newUserId = sessionData?.user?.id;

      if (!newUserId) {
        toast({
          title: 'Login Failed',
          description: 'Could not retrieve user session',
          variant: 'destructive'
        });
        return;
      }

      // Check if user is admin after login
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', newUserId)
        .single();

      if (data?.role !== 'admin') {
        await supabase.auth.signOut();
        toast({
          title: 'Access Denied',
          description: 'You do not have admin privileges',
          variant: 'destructive'
        });
        return;
      }

      setIsAdmin(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'An error occurred during login',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Redirect if already logged in as admin
  if (user && isAdmin === true) {
    return <Navigate to="/admin" replace />;
  }

  // Show access denied if logged in but not admin
  if (user && isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              You do not have admin privileges to access this panel.
            </p>
            <Button 
              variant="outline" 
              onClick={() => supabase.auth.signOut()}
              className="w-full"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Admin Login</CardTitle>
          <p className="text-sm text-muted-foreground">
            Access the IFVG Journal admin panel
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@ifvg.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}