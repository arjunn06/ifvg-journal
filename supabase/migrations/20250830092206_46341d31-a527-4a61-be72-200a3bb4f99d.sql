-- Fix profiles table security vulnerability - prevent role privilege escalation
-- Corrected version with proper trigger logic

-- 1. Drop the current user update policy that allows updating any field including role
DROP POLICY IF EXISTS "Authenticated users can update own profile" ON public.profiles;

-- 2. Create a new policy that excludes the role field from user updates
-- Users can update their own profile EXCEPT the role field
CREATE POLICY "Users can update own profile except role" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND (
    -- Only allow update if role is not being changed or user is admin
    OLD.role = NEW.role 
    OR is_admin(auth.uid())
  )
);

-- 3. Add database-level trigger to prevent role modification attempts
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If role is being changed and user is not admin, block the update
  IF OLD.role != NEW.role AND NOT is_admin(auth.uid()) THEN
    -- Log the attempted privilege escalation
    PERFORM public.log_security_event(
      'ROLE_ESCALATION_ATTEMPT',
      'profiles',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'attempted_role_change', jsonb_build_object(
          'from', OLD.role,
          'to', NEW.role
        ),
        'timestamp', now()
      )
    );
    
    RAISE EXCEPTION 'Access denied: Users cannot modify their own role';
  END IF;
  
  -- Log legitimate role changes by admins
  IF OLD.role != NEW.role AND is_admin(auth.uid()) THEN
    PERFORM public.log_security_event(
      'ADMIN_ROLE_CHANGE',
      'profiles',
      jsonb_build_object(
        'target_user_id', NEW.user_id,
        'admin_user_id', auth.uid(),
        'role_change', jsonb_build_object(
          'from', OLD.role,
          'to', NEW.role
        ),
        'timestamp', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Create trigger to enforce role protection at database level
DROP TRIGGER IF EXISTS trigger_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trigger_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.prevent_role_escalation();

-- 5. Create function to validate profile data updates
CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Validate email format if being updated
  IF NEW.email IS NOT NULL AND (OLD.email IS NULL OR NEW.email != OLD.email) THEN
    IF NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'Invalid email format';
    END IF;
  END IF;
  
  -- Sanitize display name input
  IF NEW.display_name IS NOT NULL THEN
    NEW.display_name := public.sanitize_text_input(NEW.display_name, 100);
  END IF;
  
  -- Sanitize notes input
  IF NEW.notes IS NOT NULL THEN
    NEW.notes := public.sanitize_text_input(NEW.notes, 5000);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Create validation trigger
DROP TRIGGER IF EXISTS trigger_validate_profile_update ON public.profiles;
CREATE TRIGGER trigger_validate_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_update();

-- 7. Add rate limiting for profile updates to prevent abuse
CREATE OR REPLACE FUNCTION public.check_profile_update_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  update_count integer;
BEGIN
  -- Check how many profile updates this user has made in the last 10 minutes
  SELECT COUNT(*) INTO update_count
  FROM public.security_audit_logs
  WHERE user_id = auth.uid()
    AND action = 'PROFILE_UPDATE'
    AND created_at > now() - INTERVAL '10 minutes';
  
  -- Allow maximum 5 profile updates per 10 minutes
  IF update_count >= 5 THEN
    PERFORM public.log_security_event(
      'PROFILE_UPDATE_RATE_LIMIT_EXCEEDED',
      'profiles',
      jsonb_build_object(
        'user_id', auth.uid(),
        'update_count', update_count,
        'timestamp', now()
      )
    );
    
    RAISE EXCEPTION 'Rate limit exceeded: Too many profile updates. Please wait before trying again.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 8. Create rate limiting trigger
DROP TRIGGER IF EXISTS trigger_profile_rate_limit ON public.profiles;
CREATE TRIGGER trigger_profile_rate_limit
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_update_rate_limit();