-- Create tables for cTrader integration

-- Table to store temporary OAuth states
CREATE TABLE public.ctrader_auth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  account_number TEXT NOT NULL,
  trading_account_id UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store cTrader connections
CREATE TABLE public.ctrader_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trading_account_id UUID NOT NULL,
  account_number TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, trading_account_id)
);

-- Add external_id and source columns to trades table for import tracking
ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Create index for external_id lookups
CREATE INDEX IF NOT EXISTS idx_trades_external_id ON public.trades(external_id);

-- Enable RLS on new tables
ALTER TABLE public.ctrader_auth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctrader_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ctrader_auth_states
CREATE POLICY "Users can manage their own auth states" 
ON public.ctrader_auth_states 
FOR ALL 
USING (auth.uid() = user_id);

-- Create RLS policies for ctrader_connections
CREATE POLICY "Users can view their own connections" 
ON public.ctrader_connections 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own connections" 
ON public.ctrader_connections 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections" 
ON public.ctrader_connections 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections" 
ON public.ctrader_connections 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates on ctrader_connections
CREATE TRIGGER update_ctrader_connections_updated_at
BEFORE UPDATE ON public.ctrader_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to clean up expired auth states
CREATE OR REPLACE FUNCTION public.cleanup_expired_auth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM public.ctrader_auth_states 
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;