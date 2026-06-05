-- Add invoice_url column to financial_transactions table
ALTER TABLE public.financial_transactions 
ADD COLUMN invoice_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.financial_transactions.invoice_url IS 'URL to uploaded invoice/receipt file';