-- Add prop firm related fields to trading_accounts table
ALTER TABLE public.trading_accounts 
ADD COLUMN IF NOT EXISTS is_prop_firm boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS profit_target numeric,
ADD COLUMN IF NOT EXISTS max_loss_limit numeric,
ADD COLUMN IF NOT EXISTS daily_loss_limit numeric,
ADD COLUMN IF NOT EXISTS minimum_trading_days integer,
ADD COLUMN IF NOT EXISTS current_drawdown numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_drawdown_reached boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS breach_reason text,
ADD COLUMN IF NOT EXISTS breach_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS trading_days_completed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS start_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS target_completion_date timestamp with time zone;