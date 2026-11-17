import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useJournal } from '../JournalProvider';
import { useOnboardingState } from './state';

/**
 * Layout route inside the journal provider. A signed-in user with no account and no finished onboarding is
 * sent to /onboarding from anywhere in the app; a user who has finished is sent away from it. Sample data
 * has no onboarding, and if either read failed we let the user through rather than send an existing user to
 * a first-run screen on a bad connection.
 */
export function OnboardingGate({ fallback }: { fallback: ReactNode }) {
  const { pathname } = useLocation();
  const { isDemo } = useJournal();
  const s = useOnboardingState();
  const onboarding = pathname === '/onboarding';

  if (isDemo) return onboarding ? <Navigate to="/dashboard" replace /> : <Outlet />;
  if (s.loading) return <>{fallback}</>;
  if (s.failed) return <Outlet />;
  if (onboarding && s.completed) return <Navigate to="/dashboard" replace />;
  if (!onboarding && !s.completed && !s.hasAccounts) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
