import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isoDate } from '@/journal/format';

/** Status row: what the account is on, and a button to re-read it after a payment. */
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
    <div className="up-status">
      <div className="grow">
        <div className="t">
          {isPremium ? <span className="j-pill pos"><i className="j-dot" />Active</span> : <span className="j-pill">Free plan</span>}
        </div>
        <div className="s" style={{ marginTop: 8 }}>
          {isPremium
            ? <>Tier: <span className="j-num" style={{ textTransform: 'capitalize' }}>{subscriptionTier}</span>{subscriptionEnd && <> · valid until <span className="j-num">{isoDate(subscriptionEnd)}</span></>}</>
            : 'Paid and still on Free? Refresh to re-read your status.'}
        </div>
      </div>
      <button type="button" className="j-btn" onClick={handleRefresh} disabled={isRefreshing || !user}>
        {isRefreshing ? 'Refreshing…' : 'Refresh status'}
      </button>
    </div>
  );
}
