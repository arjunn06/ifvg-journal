import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { verifyZohoPayment } from '@/components/ZohoPayment';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [verifying, setVerifying] = useState(true);
  const [paymentData, setPaymentData] = useState<any>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      const orderId = searchParams.get('order_id');
      const plan = searchParams.get('plan');
      const amount = searchParams.get('amount');

      if (!orderId) {
        toast({
          title: "Invalid Payment",
          description: "Payment verification failed. Please contact support.",
          variant: "destructive"
        });
        navigate('/');
        return;
      }

      try {
        // Verify payment with Zoho
        const verification = await verifyZohoPayment(orderId);
        
        if (verification.status === 'success') {
          setPaymentData({
            orderId,
            plan,
            amount,
            transactionId: verification.transactionId
          });

          toast({
            title: "Payment Successful!",
            description: `Welcome to the ${plan} plan!`,
          });
        } else {
          throw new Error('Payment verification failed');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        toast({
          title: "Verification Failed",
          description: "Unable to verify payment. Please contact support.",
          variant: "destructive"
        });
      } finally {
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [searchParams, navigate, toast]);

  if (verifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Verifying Payment...</CardTitle>
            <CardDescription>Please wait while we confirm your payment</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-600">Payment Successful!</CardTitle>
          <CardDescription>Your subscription has been activated</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {paymentData && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Plan:</span>
                <span className="text-sm font-medium capitalize">{paymentData.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount:</span>
                <span className="text-sm font-medium">${paymentData.amount}/month</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Order ID:</span>
                <span className="text-sm font-mono">{paymentData.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Transaction ID:</span>
                <span className="text-sm font-mono">{paymentData.transactionId}</span>
              </div>
            </div>
          )}

          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Welcome to Trade Journal! Your subscription is now active and you have access to all premium features.
            </p>
            
            <Button 
              className="w-full gap-2" 
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            A confirmation email has been sent to your registered email address.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}