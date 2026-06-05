-- Update the trading_accounts table constraint to include 'prop firm'
ALTER TABLE public.trading_accounts DROP CONSTRAINT trading_accounts_account_type_check;

-- Add new constraint with 'prop firm' included
ALTER TABLE public.trading_accounts ADD CONSTRAINT trading_accounts_account_type_check 
CHECK (account_type = ANY (ARRAY['demo'::text, 'live'::text, 'paper'::text, 'prop firm'::text]));