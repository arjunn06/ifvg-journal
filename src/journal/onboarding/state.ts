// Has this user finished setting up? The answer is profiles.has_completed_onboarding, written when they
// leave onboarding (after importing, or choosing "Import later").
//
// Who is sent to /onboarding (see OnboardingGate): a signed-in user with no flag AND no account yet. Anyone
// who already has an account is never forced back, so people who signed up before onboarding existed (their
// flag may still be false) keep working, and nobody is ever trapped by a failed flag write.

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useJournal } from '../JournalProvider';

const key = (userId: string | null) => ['onboarding-complete', userId] as const;

export function useOnboardingState() {
  const { user } = useAuth();
  const J = useJournal();
  const qc = useQueryClient();
  const userId = J.isDemo ? null : user?.id ?? null;

  const flag = useQuery({
    queryKey: key(userId),
    enabled: !!userId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('has_completed_onboarding').eq('user_id', userId!).maybeSingle();
      if (error) throw new Error(error.message);
      return !!(data as { has_completed_onboarding?: boolean } | null)?.has_completed_onboarding;
    },
  });

  /** Best effort: the gate also checks for accounts, so a failed write never strands anyone in onboarding. */
  const finish = useCallback(async () => {
    if (!userId) return;
    qc.setQueryData(key(userId), true);
    const { error } = await supabase.from('profiles').update({ has_completed_onboarding: true } as never).eq('user_id', userId);
    if (error) console.warn('Could not record onboarding as complete:', error.message);
  }, [qc, userId]);

  return {
    /** The first load of accounts and of the flag is still in flight. */
    loading: J.loading || (!!userId && flag.isLoading),
    /** Either read failed. Treat the user as set up rather than guess from partial data. */
    failed: !!J.error || flag.isError,
    completed: flag.data === true,
    hasAccounts: J.accounts.length > 0,
    finish,
  };
}
