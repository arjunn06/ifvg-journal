-- The journal is members-only (it comes with the Blue Pill), and the app decides who is a member by reading
-- two things the signed-in user can see: their public.subscribers row and their public.profiles row
-- (premium_access_override, role). That only means something if a user cannot write either one for themselves.
-- Before this migration they could:
--
--   * subscribers: "Users can create own subscription" (INSERT) and "Users can update own subscription" (UPDATE)
--     let anyone set subscribed = true and subscription_end = null on their own row, from the browser console.
--   * profiles: "Users can update own profile" lets anyone set premium_access_override = true on their own row.
--
-- After it, only an admin (the existing "Admins can manage all subscriptions" policy and is_admin()) or the server
-- itself (service role: edge functions, webhooks, SECURITY DEFINER functions such as invitation redemption) can
-- grant access. Users keep read access to their own subscriber row.

-- 1. subscribers: users can read their own membership, nothing more.
DROP POLICY IF EXISTS "Users can create own subscription" ON public.subscribers;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscribers;
-- Names from the first version of the table, in case they were recreated by hand:
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;

-- 2. profiles: only an admin can change premium_access_override.
-- Requests from the app run as the 'authenticated' (or 'anon') role. Service-role calls, migrations and
-- SECURITY DEFINER functions run as other roles, so current_user lets them through unchanged. This function is
-- deliberately SECURITY INVOKER: inside a SECURITY DEFINER function (invitation redemption) current_user is the
-- function's owner, which is how that path keeps working.
CREATE OR REPLACE FUNCTION public.protect_premium_override()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.premium_access_override, false) AND NOT COALESCE(public.is_admin(auth.uid()), false) THEN
      RAISE EXCEPTION 'Only an admin can grant premium access';
    END IF;
  ELSIF NEW.premium_access_override IS DISTINCT FROM OLD.premium_access_override
        AND NOT COALESCE(public.is_admin(auth.uid()), false) THEN
    RAISE EXCEPTION 'Only an admin can change premium access';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_premium_override ON public.profiles;
CREATE TRIGGER protect_premium_override
  BEFORE INSERT OR UPDATE OF premium_access_override ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_premium_override();
