-- CRITICAL SECURITY FIXES

-- 1. Fix subscribers table - make user_id NOT NULL to prevent RLS bypass
-- First update any existing records with null user_id to link them properly
UPDATE public.subscribers 
SET user_id = (
  SELECT auth.users.id 
  FROM auth.users 
  WHERE auth.users.email = subscribers.email 
  LIMIT 1
)
WHERE user_id IS NULL AND email IS NOT NULL;

-- Delete any orphaned records that couldn't be linked
DELETE FROM public.subscribers 
WHERE user_id IS NULL;

-- Now make user_id NOT NULL
ALTER TABLE public.subscribers 
ALTER COLUMN user_id SET NOT NULL;

-- Add foreign key constraint for data integrity
ALTER TABLE public.subscribers 
ADD CONSTRAINT fk_subscribers_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Update subscribers RLS policy to be more restrictive
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscribers;

CREATE POLICY "select_own_subscription" ON public.subscribers
FOR SELECT USING (user_id = auth.uid());

-- 3. Enhance database function security with immutable search_path
-- Update existing functions to have secure search_path

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Return 'user' for all authenticated users for now
  -- This can be expanded later with actual role logic
  IF auth.uid() IS NOT NULL THEN
    RETURN 'user';
  END IF;
  RETURN 'anonymous';
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name', NEW.email);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    table_name,
    operation,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 4. Add security audit logging table
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  resource text,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on security audit logs
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view security audit logs
CREATE POLICY "Admins can view security audit logs" ON public.security_audit_logs
FOR SELECT USING (is_admin(auth.uid()));

-- System can insert security audit logs
CREATE POLICY "System can insert security audit logs" ON public.security_audit_logs
FOR INSERT WITH CHECK (true);

-- 5. Add function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  action_name text,
  resource_name text DEFAULT NULL,
  event_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.security_audit_logs (
    user_id,
    action,
    resource,
    details,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    action_name,
    resource_name,
    event_details,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent'
  );
END;
$function$;