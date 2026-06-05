-- Fix invitation security vulnerabilities with comprehensive protection measures

-- 1. Add DELETE policy for invitation cleanup (currently missing)
CREATE POLICY "Admins can delete invitations" 
ON public.invitations 
FOR DELETE 
TO authenticated
USING (is_admin(auth.uid()));

-- 2. Create automatic cleanup function for expired invitations
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete expired invitations to prevent token accumulation
  DELETE FROM public.invitations 
  WHERE expires_at < now() 
     OR (status = 'used' AND used_at < now() - INTERVAL '30 days');
  
  -- Log cleanup activity for audit purposes
  PERFORM public.log_security_event(
    'INVITATION_CLEANUP', 
    'invitations', 
    jsonb_build_object(
      'cleaned_at', now(),
      'action', 'automatic_cleanup'
    )
  );
END;
$$;

-- 3. Create rate limiting function for invitation creation
CREATE OR REPLACE FUNCTION public.check_invitation_rate_limit(admin_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invitation_count integer;
BEGIN
  -- Check how many invitations this admin has created in the last hour
  SELECT COUNT(*) INTO invitation_count
  FROM public.invitations
  WHERE invited_by = admin_user_id
    AND created_at > now() - INTERVAL '1 hour';
  
  -- Allow maximum 10 invitations per hour per admin
  IF invitation_count >= 10 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- 4. Add enhanced RLS policy for INSERT with rate limiting
DROP POLICY IF EXISTS "Admins can create invitations" ON public.invitations;

CREATE POLICY "Admins can create invitations with rate limit" 
ON public.invitations 
FOR INSERT 
TO authenticated
WITH CHECK (
  is_admin(auth.uid()) 
  AND public.check_invitation_rate_limit(auth.uid())
);

-- 5. Create trigger to automatically clean up expired invitations daily
CREATE OR REPLACE FUNCTION public.invitation_cleanup_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Randomly trigger cleanup (1% chance per invitation creation)
  IF random() < 0.01 THEN
    PERFORM public.cleanup_expired_invitations();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic cleanup
DROP TRIGGER IF EXISTS trigger_invitation_cleanup ON public.invitations;
CREATE TRIGGER trigger_invitation_cleanup
  AFTER INSERT ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.invitation_cleanup_trigger();

-- 6. Create audit trigger for invitation access
CREATE OR REPLACE FUNCTION public.audit_invitation_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log all invitation operations for security monitoring
  PERFORM public.log_security_event(
    'INVITATION_' || TG_OP,
    'invitations',
    jsonb_build_object(
      'invitation_id', COALESCE(NEW.id, OLD.id),
      'email', COALESCE(NEW.email, OLD.email),
      'operation', TG_OP,
      'timestamp', now()
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create audit trigger
DROP TRIGGER IF EXISTS trigger_audit_invitations ON public.invitations;
CREATE TRIGGER trigger_audit_invitations
  AFTER INSERT OR UPDATE OR DELETE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_invitation_access();

-- 7. Create function to validate invitation tokens securely
CREATE OR REPLACE FUNCTION public.validate_invitation_token(input_token text)
RETURNS TABLE(
  invitation_id uuid,
  email text,
  premium_access boolean,
  is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log token validation attempt
  PERFORM public.log_security_event(
    'INVITATION_TOKEN_VALIDATION',
    'invitations',
    jsonb_build_object(
      'token_prefix', substring(input_token, 1, 8),
      'timestamp', now()
    )
  );

  RETURN QUERY
  SELECT 
    i.id,
    i.email,
    i.premium_access,
    (i.status = 'pending' AND i.expires_at > now()) as is_valid
  FROM public.invitations i
  WHERE i.token = input_token
    AND i.status = 'pending'
    AND i.expires_at > now();
END;
$$;

-- 8. Create function to securely use invitation tokens
CREATE OR REPLACE FUNCTION public.use_invitation_token(input_token text, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invitation_record record;
BEGIN
  -- Find and validate the invitation
  SELECT * INTO invitation_record
  FROM public.invitations
  WHERE token = input_token
    AND status = 'pending'
    AND expires_at > now();
  
  IF NOT FOUND THEN
    -- Log failed attempt
    PERFORM public.log_security_event(
      'INVITATION_TOKEN_INVALID',
      'invitations',
      jsonb_build_object(
        'token_prefix', substring(input_token, 1, 8),
        'user_id', user_id,
        'timestamp', now()
      )
    );
    RETURN false;
  END IF;
  
  -- Mark invitation as used
  UPDATE public.invitations
  SET 
    status = 'used',
    used_at = now(),
    updated_at = now()
  WHERE id = invitation_record.id;
  
  -- Update user's profile if premium access granted
  IF invitation_record.premium_access THEN
    UPDATE public.profiles
    SET premium_access_override = true
    WHERE user_id = user_id;
  END IF;
  
  -- Log successful usage
  PERFORM public.log_security_event(
    'INVITATION_TOKEN_USED',
    'invitations',
    jsonb_build_object(
      'invitation_id', invitation_record.id,
      'user_id', user_id,
      'email', invitation_record.email,
      'premium_access', invitation_record.premium_access,
      'timestamp', now()
    )
  );
  
  RETURN true;
END;
$$;