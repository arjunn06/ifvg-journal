import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface SubscriptionContextType {
  /**
   * The first answer for the signed-in user has not arrived yet. Only that first answer counts: a refresh
   * in the background (every few minutes, or when the tab regains focus) never sets it, so the app is
   * never swapped for a loading screen while someone is using it.
   */
  isLoading: boolean;
  /**
   * Journal access. True for an active Blue Pill purchase (bluepill_memberships, by verified email), an active
   * subscribers row, an access grant made by an admin (profiles.premium_access_override, which invitations
   * also set) and for admin accounts.
   */
  isPremium: boolean;
  /** The first check failed (network, permissions), so "no access" would only be a guess. */
  checkFailed: boolean;
  subscriptionTier: string;
  subscriptionEnd: string | null;
  checkSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface Status {
  userId: string;
  premium: boolean;
  tier: string;
  end: string | null;
  failed: boolean;
}

interface SubscriberRow { subscribed: boolean; subscription_tier: string | null; subscription_end: string | null }
interface ProfileRow { premium_access_override: boolean | null; role: string | null }
/** One row while the membership is active (ends_at is null for one with no end date), none otherwise. */
interface BluepillRow { ends_at: string | null }

/** Shown as "Plan: Blue Pill" on the membership page. */
const BLUEPILL_TIER = 'Blue Pill';

const REFRESH_MS = 5 * 60 * 1000;

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [status, setStatus] = useState<Status | null>(null);

  const checkSubscription = useCallback(async () => {
    if (!userId) { setStatus(null); return; }
    try {
      // Three places say who is a member, all written by the server or an admin and never by the user:
      //  - subscribers: a membership row for this account
      //  - profiles: an admin grant (premium_access_override, which invitations also set) and the admin role
      //  - bluepill_memberships, through my_bluepill_membership(): a Blue Pill purchase, recorded by the
      //    bluepill-webhook function against the email it was bought with. Matches this account once its email is verified.
      // Read all three; any one gives access.
      const [subRes, profRes, bpRes] = await Promise.all([
        supabase.from('subscribers').select('subscribed, subscription_tier, subscription_end').eq('user_id', userId).maybeSingle(),
        supabase.from('profiles').select('premium_access_override, role').eq('user_id', userId).maybeSingle(),
        supabase.rpc('my_bluepill_membership'),
      ]);
      const sub = subRes.data as SubscriberRow | null;
      const prof = profRes.data as ProfileRow | null;
      const bluepill = (bpRes.data as BluepillRow[] | null)?.[0] ?? null;

      const active = !!sub?.subscribed && (!sub.subscription_end || new Date(sub.subscription_end) > new Date());
      const member = !!bluepill;
      const granted = prof?.premium_access_override === true || prof?.role === 'admin';
      const premium = active || member || granted;

      // Having access settles it whatever else failed. Without it, a failed read means we do not know.
      if (!premium && (subRes.error || profRes.error || bpRes.error)) throw subRes.error ?? profRes.error ?? bpRes.error;

      logger.debug('Access check completed', { active, member, granted, tier: sub?.subscription_tier });
      setStatus({
        userId, premium, failed: false,
        tier: active ? sub?.subscription_tier || 'basic' : member ? BLUEPILL_TIER : granted ? 'granted' : 'basic',
        end: active ? sub?.subscription_end ?? null : member ? bluepill?.ends_at ?? null : null,
      });
    } catch (error) {
      logger.apiError('useSubscription - checkSubscription', error);
      // A refresh that fails keeps the last good answer for this person; only a first check can end up "failed".
      setStatus((prev) => (prev && prev.userId === userId && !prev.failed ? prev : { userId, premium: false, tier: 'basic', end: null, failed: true }));
    }
  }, [userId]);

  useEffect(() => { void checkSubscription(); }, [checkSubscription]);

  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(checkSubscription, REFRESH_MS);
    // Joined in another tab and came back: pick the membership up without asking them to refresh.
    const onVisible = () => { if (document.visibilityState === 'visible') void checkSubscription(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [userId, checkSubscription]);

  // Until the answer for *this* user is in, we are loading: that also covers the render right after sign-in,
  // when the user is known but the check has not started.
  const current = status && status.userId === userId ? status : null;

  return (
    <SubscriptionContext.Provider value={{
      isLoading: !!userId && !current,
      isPremium: !!current?.premium,
      checkFailed: !!current?.failed,
      subscriptionTier: current?.tier ?? 'basic',
      subscriptionEnd: current?.end ?? null,
      checkSubscription,
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
