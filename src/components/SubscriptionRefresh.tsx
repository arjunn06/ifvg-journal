import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { isoDate } from '@/journal/format';

/** Status row: whether this account has a membership, and a button to re-read it after joining. */
export function SubscriptionRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { checkSubscription, isPremium, subscriptionTier, subscriptionEnd } = useSubscription();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleRefresh = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      await checkSubscription();
      toast({ title: 'Membership checked', description: 'Your status is up to date.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="up-status">
      <div className="grow">
        <div className="t">
          {isPremium ? <span className="j-pill pos"><i className="j-dot" />Active</span> : <span className="j-pill">No membership</span>}
        </div>
        <div className="s" style={{ marginTop: 8 }}>
          {isPremium
            ? <>{subscriptionTier === 'granted' ? 'Access granted by IFVG' : <>Plan: <span className="j-num" style={{ textTransform: 'capitalize' }}>{subscriptionTier}</span></>}{subscriptionEnd && <> · active until <span className="j-num">{isoDate(subscriptionEnd)}</span></>}</>
            : 'Just joined? Refresh to re-read your status.'}
        </div>
      </div>
      <button type="button" className="j-btn" onClick={handleRefresh} disabled={isRefreshing || !user}>
        {isRefreshing ? 'Refreshing…' : 'Refresh status'}
      </button>
    </div>
  );
}
