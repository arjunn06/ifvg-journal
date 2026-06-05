-- Fix subscription status for user with valid subscription end date but incorrect subscribed status
UPDATE public.subscribers 
SET 
    subscribed = true,
    updated_at = now()
WHERE email = 'arjunn0606@gmail.com' 
    AND subscription_end > now() 
    AND subscribed = false;