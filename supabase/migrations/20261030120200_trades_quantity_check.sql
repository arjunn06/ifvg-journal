-- check_valid_quantity was created outside the migrations (CHECK (validate_numeric_input(quantity, 0.00001))) and
-- rejects an empty size. Quick-logged trades have none, so keep the same test for every trade that has a size
-- and let NULL through.
ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS check_valid_quantity;
ALTER TABLE public.trades ADD CONSTRAINT check_valid_quantity
  CHECK (quantity IS NULL OR validate_numeric_input(quantity, 0.00001));
