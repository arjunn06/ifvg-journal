-- Fix remaining security warnings from the linter

-- 1. Fix function search path issues for invitation-related functions
-- Update all functions to have proper search_path set to empty string for security

CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.check_invitation_rate_limit(admin_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.invitation_cleanup_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Randomly trigger cleanup (1% chance per invitation creation)
  IF random() < 0.01 THEN
    PERFORM public.cleanup_expired_invitations();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_invitation_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.validate_invitation_token(input_token text)
RETURNS TABLE(
  invitation_id uuid,
  email text,
  premium_access boolean,
  is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.use_invitation_token(input_token text, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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