import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface SubscriptionContextType {
  isLoading: boolean;
  isPremium: boolean;
  subscriptionTier: string;
  subscriptionEnd: string | null;
  checkSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState('basic');
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);

  const checkSubscription = async () => {
    if (!user?.email) {
      setIsLoading(false);
      setIsPremium(false);
      setSubscriptionTier('basic');
      setSubscriptionEnd(null);
      return;
    }

    try {
      setIsLoading(true);
      
      // Check subscription status from database
      const { data, error } = await supabase
        .from('subscribers')
        .select('subscribed, subscription_tier, subscription_end')
        .eq('email', user.email)
        .maybeSingle();

      if (error) {
        logger.apiError('useSubscription - checking subscription', error);
        setIsPremium(false);
        setSubscriptionTier('basic');
        setSubscriptionEnd(null);
        return;
      }

      if (data) {
        const isActive = data.subscribed && 
          (!data.subscription_end || new Date(data.subscription_end) > new Date());
        
        // Only log subscription info in development
        logger.debug('Subscription check completed', {
          email: user.email,
          subscribed: data.subscribed,
          subscription_end: data.subscription_end,
          isActive,
          subscription_tier: data.subscription_tier
        });
        
        setIsPremium(isActive);
        setSubscriptionTier(data.subscription_tier || 'basic');
        setSubscriptionEnd(data.subscription_end);
      } else {
        // User not in subscribers table - create basic entry
        await supabase
          .from('subscribers')
          .upsert({
            user_id: user.id,
            email: user.email,
            subscribed: false,
            subscription_tier: 'basic'
          }, { onConflict: 'email' });
        
        setIsPremium(false);
        setSubscriptionTier('basic');
        setSubscriptionEnd(null);
      }
    } catch (error) {
      logger.apiError('useSubscription - checkSubscription', error);
      setIsPremium(false);
      setSubscriptionTier('basic');
      setSubscriptionEnd(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [user]);

  // Check subscription every 5 minutes
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(checkSubscription, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <SubscriptionContext.Provider value={{
      isLoading,
      isPremium,
      subscriptionTier,
      subscriptionEnd,
      checkSubscription
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}