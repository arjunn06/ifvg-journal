import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, RefreshCcw, CheckCircle } from 'lucide-react';

const VerifyEmail = () => {
  const [isResending, setIsResending] = useState(false);
  const [emailResent, setEmailResent] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleResendEmail = async () => {
    setIsResending(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: new URLSearchParams(window.location.search).get('email') || ''
      });
      
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setEmailResent(true);
        toast({
          title: "Email Sent!",
          description: "A new verification email has been sent to your inbox."
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resend verification email. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsResending(false);
    }
  };

  const email = new URLSearchParams(window.location.search).get('email') || '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
            <p className="text-muted-foreground mt-2">
              We've sent a verification link to:
            </p>
            <Badge variant="outline" className="mt-2">
              {email}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              <span>Account created successfully!</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Click the verification link in your email to activate your account and start using IFVG Journal.
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleResendEmail} 
              variant="outline" 
              className="w-full"
              disabled={isResending || emailResent}
            >
              {isResending ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : emailResent ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Email Sent!
                </>
              ) : (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Resend Email
                </>
              )}
            </Button>
            
            <Button 
              onClick={() => navigate('/auth')} 
              variant="ghost" 
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Didn't receive the email? Check your spam folder or try resending.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;