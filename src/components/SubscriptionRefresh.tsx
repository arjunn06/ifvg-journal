import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function SubscriptionRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { checkSubscription, isPremium, subscriptionTier, subscriptionEnd } = useSubscription();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleRefresh = async () => {
    if (!user) return;
    
    setIsRefreshing(true);
    try {
      // First check current database status
      const { data, error } = await supabase
        .from('subscribers')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (error) {
        throw error;
      }

      // Refresh the subscription context
      await checkSubscription();

      toast({
        title: "Subscription refreshed",
        description: `Status: ${data?.subscribed ? 'Active' : 'Inactive'} | Tier: ${data?.subscription_tier || 'basic'}`,
      });
    } catch (error) {
      console.error('Error refreshing subscription:', error);
      toast({
        title: "Refresh failed",
        description: "Failed to refresh subscription status. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-lg border">
      <div className="flex items-center gap-2">
        {isPremium ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <AlertCircle className="h-5 w-5 text-orange-500" />
        )}
        <div>
          <p className="font-medium">
            Subscription: <span className={isPremium ? 'text-green-600' : 'text-orange-600'}>
              {isPremium ? 'Active' : 'Inactive'}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Tier: {subscriptionTier} 
            {subscriptionEnd && (
              <span> | Expires: {new Date(subscriptionEnd).toLocaleDateString()}</span>
            )}
          </p>
        </div>
      </div>
      
      <Button 
        onClick={handleRefresh}
        disabled={isRefreshing}
        variant="outline"
        size="sm"
        className="ml-auto"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
      </Button>
    </div>
  );
}