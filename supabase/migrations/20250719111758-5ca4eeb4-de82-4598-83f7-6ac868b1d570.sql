-- Add a column to track if user has completed onboarding
ALTER TABLE public.profiles 
ADD COLUMN has_completed_onboarding boolean NOT NULL DEFAULT false;

-- Update existing users to mark them as having completed onboarding
-- This prevents existing users from seeing the welcome screen
UPDATE public.profiles 
SET has_completed_onboarding = true 
WHERE created_at < NOW() - INTERVAL '1 minute';