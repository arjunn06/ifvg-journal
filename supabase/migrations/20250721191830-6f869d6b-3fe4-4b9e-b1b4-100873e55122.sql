-- Add equity goal field to trading accounts
ALTER TABLE public.trading_accounts 
ADD COLUMN equity_goal NUMERIC DEFAULT NULL;

-- Add a comment to describe the column
COMMENT ON COLUMN public.trading_accounts.equity_goal IS 'Target equity goal for this trading account';