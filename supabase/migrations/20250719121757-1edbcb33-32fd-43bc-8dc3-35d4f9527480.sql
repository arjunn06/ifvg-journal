-- Ensure cTrader auth states table exists and has proper structure
CREATE TABLE IF NOT EXISTS public.ctrader_auth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  account_number TEXT NOT NULL,
  trading_account_id UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS if not already enabled
ALTER TABLE public.ctrader_auth_states ENABLE ROW LEVEL SECURITY;

-- Recreate policy if it doesn't exist
DROP POLICY IF EXISTS "Users can manage their own auth states" ON public.ctrader_auth_states;
CREATE POLICY "Users can manage their own auth states" 
ON public.ctrader_auth_states 
FOR ALL 
USING (auth.uid() = user_id);