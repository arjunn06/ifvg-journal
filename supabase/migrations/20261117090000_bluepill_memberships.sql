-- Blue Pill purchases -> journal access.
--
-- The journal comes with the Blue Pill course, which is sold on another site and billed by Razorpay. Someone
-- often pays before they have a journal account, and public.subscribers.user_id is NOT NULL, so a purchase
-- cannot be recorded there. This table records it by email instead, and the app reads it by the signed-in
-- user's own verified email. There is nothing to sync when the buyer signs up later, and nothing to repair if
-- they sign up first.
--
-- Written by the bluepill-webhook edge function (service role) through apply_bluepill_event(). Users never
-- write it and cannot read other people's rows; they ask my_bluepill_membership() about themselves.

CREATE TABLE IF NOT EXISTS public.bluepill_memberships (
  -- Lower-cased address the course was bought with.
  email        text PRIMARY KEY CHECK (email = lower(btrim(email)) AND email <> ''),
  -- Razorpay subscription id (sub_...). Lets an event that carries no email (a cancellation) find its member.
  reference    text,
  -- Paid-through date. NULL means no end date (a manual grant). A revoke sets it to the moment it happened.
  active_until timestamptz,
  -- When the latest applied event happened at the source. Older events arriving late are ignored.
  event_at     timestamptz NOT NULL,
  -- Name of the latest applied event (subscription.charged, revoke, ...): why this row looks the way it does.
  last_event   text NOT NULL,
  source       text NOT NULL DEFAULT 'razorpay',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bluepill_memberships_reference_idx ON public.bluepill_memberships (reference);

ALTER TABLE public.bluepill_memberships ENABLE ROW LEVEL SECURITY;

-- RLS is the lock; take the default table grants away as well so a policy added by mistake does not open it.
REVOKE ALL ON public.bluepill_memberships FROM anon, authenticated;
GRANT SELECT ON public.bluepill_memberships TO authenticated;

-- Admins can see who has bought (support: "I paid but cannot get in"). Nobody but the server can write.
DROP POLICY IF EXISTS "Admins can read Blue Pill memberships" ON public.bluepill_memberships;
CREATE POLICY "Admins can read Blue Pill memberships"
  ON public.bluepill_memberships FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));


-- Apply one purchase event. Service role only (the edge function). Returns:
--   'applied'   the row was written
--   'stale'     the row already reflects a later event, nothing changed (Razorpay retries and delivers out of order)
--   'unmatched' no email was given and no row carries this reference, so there is nobody to change
CREATE OR REPLACE FUNCTION public.apply_bluepill_event(
  p_email        text,
  p_reference    text,
  p_active_until timestamptz,
  p_event_at     timestamptz,
  p_event        text,
  p_source       text DEFAULT 'razorpay'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_rows  integer;
BEGIN
  IF v_email = '' THEN
    IF p_reference IS NULL OR p_reference = '' THEN
      RETURN 'unmatched';
    END IF;
    SELECT m.email INTO v_email
      FROM public.bluepill_memberships m
     WHERE m.reference = p_reference
     ORDER BY m.event_at DESC
     LIMIT 1;
    IF v_email IS NULL THEN
      RETURN 'unmatched';
    END IF;
  END IF;

  INSERT INTO public.bluepill_memberships AS m (email, reference, active_until, event_at, last_event, source)
  VALUES (v_email, NULLIF(p_reference, ''), p_active_until, p_event_at, p_event, p_source)
  ON CONFLICT (email) DO UPDATE SET
    reference    = COALESCE(EXCLUDED.reference, m.reference),
    active_until = EXCLUDED.active_until,
    event_at     = EXCLUDED.event_at,
    last_event   = EXCLUDED.last_event,
    source       = EXCLUDED.source,
    updated_at   = now()
  -- <=, not <: two events in the same second (activated and charged) must both land.
  WHERE m.event_at <= EXCLUDED.event_at;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN CASE WHEN v_rows = 0 THEN 'stale' ELSE 'applied' END;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_bluepill_event(text, text, timestamptz, timestamptz, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_bluepill_event(text, text, timestamptz, timestamptz, text, text) TO service_role;


-- The signed-in user's own Blue Pill membership: one row (ends_at is NULL when there is no end date) while it is
-- active, no rows otherwise. Only an address the user has verified counts: with "Confirm email" off in the Auth
-- settings anyone could sign up as someone else's email, so keep that setting on.
CREATE OR REPLACE FUNCTION public.my_bluepill_membership()
RETURNS TABLE (ends_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.active_until
    FROM public.bluepill_memberships m
    JOIN auth.users u ON lower(btrim(u.email)) = m.email
   WHERE u.id = auth.uid()
     AND u.email_confirmed_at IS NOT NULL
     AND (m.active_until IS NULL OR m.active_until > now())
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.my_bluepill_membership() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_bluepill_membership() TO authenticated;
