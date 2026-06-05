-- Extend allowed transaction types for financial_transactions
-- Keep existing allowed values and add new ones used by the app

ALTER TABLE public.financial_transactions
DROP CONSTRAINT IF EXISTS financial_transactions_transaction_type_check;

ALTER TABLE public.financial_transactions
ADD CONSTRAINT financial_transactions_transaction_type_check
CHECK (
  transaction_type IN (
    'deposit',
    'withdrawal',
    'challenge_fee',
    'evaluation_fee',
    'funded_account_fee',
    'payout',
    'commission',
    'other'
  )
);

COMMENT ON CONSTRAINT financial_transactions_transaction_type_check ON public.financial_transactions
IS 'Allowed transaction types used across the app: deposit, withdrawal, challenge_fee, evaluation_fee, funded_account_fee, payout, commission, other.';