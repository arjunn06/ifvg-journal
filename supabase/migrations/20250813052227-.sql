-- Fix RLS policy on subscribers to avoid referencing auth.users (causing 403)
-- and allow users to read their own subscription row by user_id or JWT email.

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Replace existing SELECT policy
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscribers;

CREATE POLICY "select_own_subscription"
ON public.subscribers
FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid())
  OR (
    email IS NOT NULL AND
    email = COALESCE(
      (current_setting('request.jwt.claims', true)::jsonb ->> 'email'),
      (auth.jwt() ->> 'email')
    )
  )
);
