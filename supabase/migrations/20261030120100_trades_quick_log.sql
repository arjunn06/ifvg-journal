-- Quick-logged trades (source = 'quick') record pair, side, result, mood and what cost the loss, but no
-- entry price or size. Allow those two columns to be empty. CHECK constraints such as
-- check_valid_quantity (quantity > 0) pass for NULL, so they keep protecting every trade that has a value.
ALTER TABLE public.trades ALTER COLUMN entry_price DROP NOT NULL;
ALTER TABLE public.trades ALTER COLUMN quantity DROP NOT NULL;
