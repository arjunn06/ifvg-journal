-- Fix the missing is_admin function issue by ensuring it exists and is properly accessible
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = is_admin.user_id 
    AND profiles.role = 'admin'
  );
$function$;