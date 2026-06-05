import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RazorpayPayment } from '@/components/RazorpayPayment';
import { SubscriptionRefresh } from '@/components/SubscriptionRefresh';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { 
  Check, 
  Star, 
  TrendingUp, 
  BarChart3, 
  Shield, 
  Calendar,
  Camera,
  Download,
  Users,
  Zap,
  Crown
} from 'lucide-react';

const Upgrade = () => {
  const { user } = useAuth();
  const { isPremium, isLoading, subscriptionTier, subscriptionEnd, checkSubscription } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handlePaymentSuccess = async () => {
    toast({
      title: "🎉 Payment Successful!",
      description: "Welcome to Professional plan! Your subscription is now active.",
    });
    
    // Refresh subscription status
    await checkSubscription();
    
    // Redirect to dashboard after a short delay
    setTimeout(() => {
      navigate('/dashboard');
    }, 2000);
  };

  const handlePaymentError = (error: string) => {
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive"
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-fade-in">
            <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-muted rounded w-2/3 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-96 bg-muted rounded"></div>
              <div className="h-96 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const currentPlan = isPremium ? subscriptionTier : 'basic';
  const isCurrentlyPremium = isPremium && subscriptionTier === 'professional';

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="animate-fade-in">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Crown className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-bold">Upgrade Your Experience</h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Unlock powerful features to take your trading to the next level. 
              Choose the plan that fits your trading journey.
            </p>
            
            {isCurrentlyPremium && (
              <div className="mt-6">
                <Badge variant="default" className="text-sm px-4 py-2">
                  <Star className="h-4 w-4 mr-2" />
                  You're currently on the Professional plan
                </Badge>
              </div>
            )}
          </div>

          {/* Subscription Status & Refresh */}
          <SubscriptionRefresh />

          {/* Current Plan Status */}
          {isPremium && (
            <Card className="mt-8 mb-8 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Current Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold capitalize">{subscriptionTier} Plan</p>
                    <p className="text-sm text-muted-foreground">
                      {subscriptionEnd 
                        ? `Valid until ${new Date(subscriptionEnd).toLocaleDateString()}`
                        : 'Active subscription'
                      }
                    </p>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Basic Plan */}
            <Card className={`relative transition-all duration-300 hover:shadow-lg ${
              currentPlan === 'basic' ? 'border-primary ring-2 ring-primary/20' : ''
            }`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">Basic Plan</CardTitle>
                  {currentPlan === 'basic' && (
                    <Badge variant="secondary">Current Plan</Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">₹0</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <CardDescription>
                  Perfect for getting started with trading journaling
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Up to 50 trades per month</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Basic performance analytics</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>P&L calendar view</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>1 trading account</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Basic confluence checklist</span>
                  </li>
                </ul>
                
                <Button 
                  variant="outline" 
                  className="w-full" 
                  disabled={currentPlan === 'basic'}
                >
                  {currentPlan === 'basic' ? 'Current Plan' : 'Downgrade to Basic'}
                </Button>
              </CardContent>
            </Card>

            {/* Professional Plan */}
            <Card className={`relative transition-all duration-300 hover:shadow-lg border-primary ${
              currentPlan === 'professional' ? 'ring-2 ring-primary/20' : ''
            }`}>
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-4 py-1 text-sm font-medium flex items-center gap-1">
                  <Star className="h-4 w-4" />
                  Most Popular
                </Badge>
              </div>
              
              <CardHeader className="pt-8">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">Professional Plan</CardTitle>
                  {currentPlan === 'professional' && (
                    <Badge variant="default">Current Plan</Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">₹850</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <CardDescription>
                  Advanced features for serious traders
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium">Unlimited trades</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Advanced analytics & reports</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Multiple trading accounts</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Custom strategies & rules</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Advanced confluence system</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Camera className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Trade screenshots & notes</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Download className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Export & backup</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Priority support</span>
                  </li>
                </ul>
                
                {!isCurrentlyPremium ? (
                  <RazorpayPayment 
                    plan="professional" 
                    amount={850}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  >
                    Upgrade to Professional
                  </RazorpayPayment>
                ) : (
                  <Button variant="default" className="w-full" disabled>
                    Current Plan
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Features Comparison */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Why Upgrade to Professional?</CardTitle>
              <CardDescription className="text-center">
                Unlock the full potential of your trading journey
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="bg-primary/10 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Advanced Analytics</h3>
                  <p className="text-muted-foreground text-sm">
                    Deep insights into your trading patterns, win rates, and performance metrics with detailed reports.
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="bg-primary/10 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Strategy Management</h3>
                  <p className="text-muted-foreground text-sm">
                    Create custom trading strategies with advanced confluence systems and rule management.
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="bg-primary/10 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Download className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Export & Backup</h3>
                  <p className="text-muted-foreground text-sm">
                    Export your data, create backups, and maintain full control over your trading records.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FAQ or Support */}
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                Have questions about our plans or need assistance with upgrading?
              </p>
              <Button variant="outline" asChild>
                <a href="mailto:support@ifvg.in">Contact Support</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Upgrade;