-- Fix existing imported trades that should be closed
-- Update trades to 'closed' status if they have exit data (exit_price, exit_date, or pnl)
UPDATE public.trades 
SET status = 'closed'
WHERE status = 'open' 
  AND (
    exit_price IS NOT NULL 
    OR exit_date IS NOT NULL 
    OR pnl IS NOT NULL
  );