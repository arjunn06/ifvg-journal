-- Fix RLS policies for profiles table to prevent public access to sensitive user data
-- Drop existing permissive policies and create stricter ones

-- First, drop all existing policies on profiles table
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new, secure policies that require authentication
-- Users can only view their own profile (requires authentication)
CREATE POLICY "Authenticated users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all profiles (requires authentication and admin role)
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (is_admin(auth.uid()));

-- Users can create their own profile (requires authentication)
CREATE POLICY "Authenticated users can create own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile (requires authentication)
CREATE POLICY "Authenticated users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Admins can update any profile (requires authentication and admin role)
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (is_admin(auth.uid()));

-- Also fix the subscribers table issue mentioned in the security scan
-- Drop and recreate more restrictive policies for subscribers table
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;

-- Users can only view their own subscription
CREATE POLICY "Users can view own subscription" 
ON public.subscribers 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Users can only create their own subscription
CREATE POLICY "Users can create own subscription" 
ON public.subscribers 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can only update their own subscription
CREATE POLICY "Users can update own subscription" 
ON public.subscribers 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid());

-- Admins can manage all subscriptions
CREATE POLICY "Admins can manage all subscriptions" 
ON public.subscribers 
FOR ALL 
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));