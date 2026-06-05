-- Fix profiles table security vulnerability with correct approach
-- The issue was using OLD/NEW in RLS policies which is not allowed

-- 1. Drop the current user update policy
DROP POLICY IF EXISTS "Authenticated users can update own profile" ON public.profiles;

-- 2. Create a simple policy for users to update their own profiles (excluding role field protection)
CREATE POLICY "Users can update own profile data" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Add database-level trigger to prevent role modification attempts
-- This will enforce role protection at the trigger level
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If role is being changed and user is not admin, block the update
  IF OLD.role IS DISTINCT FROM NEW.role AND NOT is_admin(auth.uid()) THEN
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
  IF OLD.role IS DISTINCT FROM NEW.role AND is_admin(auth.uid()) THEN
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
  EXECUTE FUNCTION public.prevent_role_escalation();

-- 5. Create function to validate and sanitize profile data updates
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

-- 7. Create audit function for profile changes with email anonymization
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Log all profile operations for security monitoring
  -- Email addresses are anonymized in logs (only domain shown)
  PERFORM public.log_security_event(
    'PROFILE_' || TG_OP,
    'profiles',
    jsonb_build_object(
      'user_id', COALESCE(NEW.user_id, OLD.user_id),
      'operation', TG_OP,
      'email_domain', CASE 
        WHEN COALESCE(NEW.email, OLD.email) IS NOT NULL 
        THEN substring(COALESCE(NEW.email, OLD.email) from '@.*$')
        ELSE NULL 
      END,
      'timestamp', now()
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 8. Create audit trigger for profile changes
DROP TRIGGER IF EXISTS trigger_audit_profile_changes ON public.profiles;
CREATE TRIGGER trigger_audit_profile_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_profile_changes();