import { ReactNode } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles, ArrowRight, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PremiumFeatureProps {
  children?: ReactNode;
  feature: string;
  description?: string;
  className?: string;
  fallback?: ReactNode;
  showUpgrade?: boolean;
}

export function PremiumFeature({ 
  children, 
  feature, 
  description, 
  className = '', 
  fallback,
  showUpgrade = true 
}: PremiumFeatureProps) {
  const { isPremium, isLoading } = useSubscription();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className={`animate-pulse bg-muted rounded-lg h-32 ${className}`} />
    );
  }

  if (isPremium && children) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgrade) {
    return null;
  }

  return (
    <Card className={`relative border-2 border-dashed border-primary/30 ${className}`}>
      <div className="absolute -top-3 left-4">
        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
          <Crown className="h-3 w-3 mr-1" />
          Premium
        </Badge>
      </div>
      
      <CardHeader className="text-center pt-8">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-lg">{feature}</CardTitle>
        {description && (
          <CardDescription className="text-center max-w-sm mx-auto">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="text-center pb-8">
        <Button 
          onClick={() => navigate('/')}
          className="w-full max-w-xs mx-auto flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Upgrade to Premium
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-sm text-muted-foreground mt-3">
          Only $10/month • Cancel anytime
        </p>
      </CardContent>
    </Card>
  );
}

interface PremiumBadgeProps {
  className?: string;
}

export function PremiumBadge({ className = '' }: PremiumBadgeProps) {
  return (
    <Badge variant="secondary" className={`bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 ${className}`}>
      <Crown className="h-3 w-3 mr-1" />
      Premium
    </Badge>
  );
}

interface UpgradePromptProps {
  feature: string;
  description: string;
  className?: string;
}

export function UpgradePrompt({ feature, description, className = '' }: UpgradePromptProps) {
  const navigate = useNavigate();
  
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
        <Crown className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{feature}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        {description}
      </p>
      <Button 
        onClick={() => navigate('/')}
        size="lg"
        className="flex items-center gap-2"
      >
        <Sparkles className="h-4 w-4" />
        Upgrade to Premium
        <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="text-sm text-muted-foreground mt-3">
        $10/month • Unlimited access • Cancel anytime
      </p>
    </div>
  );
}