import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function PaymentCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-red-600">Payment Cancelled</CardTitle>
          <CardDescription>Your payment was not processed</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Your payment has been cancelled and no charges were made to your account. 
              You can try again or contact our support team if you need assistance.
            </p>
            
            <div className="space-y-2">
              <Button 
                className="w-full gap-2" 
                onClick={() => navigate('/')}
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full gap-2" 
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Need help? Contact our support team for assistance with your subscription.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}