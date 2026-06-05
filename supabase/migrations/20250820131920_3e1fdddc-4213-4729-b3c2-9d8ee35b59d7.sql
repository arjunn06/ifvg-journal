-- Set arjunn0606@gmail.com as admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'arjunn0606@gmail.com';

-- Add premium access fields to invitations table
ALTER TABLE public.invitations 
ADD COLUMN premium_access BOOLEAN DEFAULT false,
ADD COLUMN notes TEXT;

-- Create analytics/metrics table for tracking
CREATE TABLE public.app_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on analytics
ALTER TABLE public.app_analytics ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view all analytics
CREATE POLICY "Admins can view all analytics" 
ON public.app_analytics 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Create policy for inserting analytics (public for tracking)
CREATE POLICY "Anyone can insert analytics" 
ON public.app_analytics 
FOR INSERT 
WITH CHECK (true);

-- Add premium access field to profiles
ALTER TABLE public.profiles 
ADD COLUMN premium_access_override BOOLEAN DEFAULT false,
ADD COLUMN notes TEXT;