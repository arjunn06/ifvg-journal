-- Add trailing drawdown and certificate fields to trading accounts
ALTER TABLE trading_accounts 
ADD COLUMN trailing_drawdown_enabled boolean DEFAULT false,
ADD COLUMN evaluation_certificate_url text;

-- Create table for financial transactions (separate from trading transactions)
CREATE TABLE public.financial_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    trading_account_id uuid REFERENCES trading_accounts(id) ON DELETE CASCADE,
    transaction_type text NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'challenge_fee', 'evaluation_fee', 'funded_account_fee')),
    amount numeric NOT NULL,
    description text,
    transaction_date timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on financial_transactions
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for financial_transactions
CREATE POLICY "Users can view their own financial transactions" 
ON public.financial_transactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own financial transactions" 
ON public.financial_transactions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own financial transactions" 
ON public.financial_transactions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own financial transactions" 
ON public.financial_transactions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_financial_transactions_updated_at
BEFORE UPDATE ON public.financial_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();