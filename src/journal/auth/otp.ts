// Email verification by one-time code. Supabase emails a 6-digit code on sign-up (the "Send Email" hook
// puts `token` in the message); the verify screen exchanges it for a session with verifyOtp.
//
// The address being verified survives a reload in sessionStorage (never the URL), together with the time
// the last code went out, so the resend countdown is right after a refresh.

import { supabase } from '@/integrations/supabase/client';

export const OTP_LENGTH = 6;
/** Supabase sends at most one auth email per address per minute. */
export const RESEND_SECONDS = 60;

const KEY = 'ifvg-pending-verify';

interface Pending { email: string; sentAt: number }

export function rememberPending(email: string, sentAt = Date.now()) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ email, sentAt } satisfies Pending)); } catch { /* storage blocked */ }
}

export function readPending(): Pending | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Partial<Pending> | null;
    return p && typeof p.email === 'string' && typeof p.sentAt === 'number' ? { email: p.email, sentAt: p.sentAt } : null;
  } catch { return null; }
}

export function clearPending() {
  try { sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

/** Whole seconds until another code may be requested; 0 when it may be requested now. */
export function resendWait(sentAt: number, now = Date.now()) {
  return Math.max(0, Math.ceil(RESEND_SECONDS - (now - sentAt) / 1000));
}

export async function sendSignupCode(email: string): Promise<{ error: string | null; rateLimited: boolean }> {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (!error) { rememberPending(email); return { error: null, rateLimited: false }; }
  const rateLimited = error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit' || /rate limit|too many|seconds/i.test(error.message);
  return { error: rateLimited ? 'A code was sent a moment ago. Check your inbox, or try again shortly.' : error.message, rateLimited };
}

/** On success Supabase returns a session and the auth listener signs the user in. */
export async function verifySignupCode(email: string, token: string): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  if (!error) { clearPending(); return null; }
  if (error.code === 'over_request_rate_limit') return 'Too many attempts. Wait a minute, then try again.';
  if (error.code === 'otp_expired' || /expired|invalid/i.test(error.message)) {
    return 'That code did not work. It may have expired: use the newest email, or send a new code.';
  }
  return error.message || 'Could not verify the code. Try again.';
}
