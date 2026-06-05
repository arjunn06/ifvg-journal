import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ArrowRight, Building2, Target, TrendingUp, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface WelcomeScreenProps {
  onComplete: () => void;
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Trader';

  // Check if user has already set up accounts or strategies
  useEffect(() => {
    const checkExistingSetup = async () => {
      if (!user) return;

      try {
        // Check for trading accounts
        const { data: accounts } = await supabase
          .from('trading_accounts')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        // Check for strategies  
        const { data: strategies } = await supabase
          .from('strategies')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        const completed = new Set<string>();
        if (accounts && accounts.length > 0) completed.add('account');
        if (strategies && strategies.length > 0) completed.add('strategy');
        
        setCompletedSteps(completed);
      } catch (error) {
        console.error('Error checking existing setup:', error);
      } finally {
        setLoading(false);
      }
    };

    checkExistingSetup();
  }, [user]);

  const steps = [
    {
      id: 'account',
      title: 'Set Up Trading Account',
      description: 'Add your first trading account to start tracking trades',
      icon: Building2,
      action: () => navigate('/accounts'),
      optional: false
    },
    {
      id: 'strategy',
      title: 'Create Trading Strategy',
      description: 'Define your trading rules and risk management',
      icon: Target,
      action: () => navigate('/strategies'),
      optional: true
    }
  ];

  const handleStepComplete = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
  };

  const handleSkipToApp = () => {
    onComplete();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8 animate-fade-in">
        {/* Welcome Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-primary/10 p-4 rounded-full">
              <Star className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold">
            Welcome to IFVG Journal, {displayName}! 🎉
          </h1>
          <p className="text-xl text-muted-foreground max-w-lg mx-auto">
            Your trading journal is ready! Let's set up a few things to get you started on your trading journey.
          </p>
        </div>

        {/* Setup Steps */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Setup
            </CardTitle>
            <CardDescription>
              Complete these steps to get the most out of your trading journal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((step) => {
              const isCompleted = completedSteps.has(step.id);
              const StepIcon = step.icon;
              
              return (
                <div
                  key={step.id}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                    isCompleted 
                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      isCompleted 
                        ? 'bg-green-100 dark:bg-green-900/50' 
                        : 'bg-muted'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <StepIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{step.title}</h3>
                        {step.optional && (
                          <Badge variant="secondary" className="text-xs">
                            Optional
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                  
                  {!isCompleted && (
                    <Button
                      onClick={step.action}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      Set Up
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Progress and Actions */}
        <div className="space-y-4">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <span>Progress:</span>
              <Badge variant="outline">
                {completedSteps.size} of {steps.filter(s => !s.optional).length} essential steps completed
              </Badge>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleSkipToApp}
              variant="outline"
              className="flex items-center gap-2"
            >
              Skip Setup
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleSkipToApp}
              className="flex items-center gap-2"
              disabled={completedSteps.size === 0}
            >
              Continue to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tips Card */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-semibold">💡 Pro Tip</h3>
              <p className="text-sm text-muted-foreground">
                Setting up your trading account first allows you to start logging trades immediately. 
                You can always add more accounts and strategies later!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}