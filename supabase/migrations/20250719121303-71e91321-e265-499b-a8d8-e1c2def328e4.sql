-- Add missing cTrader trade fields to capture all available information

-- Add missing fields to trades table
ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS slippage_points NUMERIC,
ADD COLUMN IF NOT EXISTS execution_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS order_type TEXT,
ADD COLUMN IF NOT EXISTS deal_id TEXT,
ADD COLUMN IF NOT EXISTS order_id TEXT,
ADD COLUMN IF NOT EXISTS position_id TEXT,
ADD COLUMN IF NOT EXISTS filled_volume NUMERIC,
ADD COLUMN IF NOT EXISTS create_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deal_status TEXT,
ADD COLUMN IF NOT EXISTS base_to_usd_rate NUMERIC,
ADD COLUMN IF NOT EXISTS quote_to_deposit_rate NUMERIC,
ADD COLUMN IF NOT EXISTS gross_profit NUMERIC,
ADD COLUMN IF NOT EXISTS margin_rate NUMERIC,
ADD COLUMN IF NOT EXISTS spread NUMERIC,
ADD COLUMN IF NOT EXISTS execution_price NUMERIC,
ADD COLUMN IF NOT EXISTS market_price_at_entry NUMERIC,
ADD COLUMN IF NOT EXISTS market_price_at_exit NUMERIC;

-- Create indexes for better performance on cTrader-specific fields
CREATE INDEX IF NOT EXISTS idx_trades_deal_id ON public.trades(deal_id);
CREATE INDEX IF NOT EXISTS idx_trades_order_id ON public.trades(order_id);
CREATE INDEX IF NOT EXISTS idx_trades_position_id ON public.trades(position_id);
CREATE INDEX IF NOT EXISTS idx_trades_order_type ON public.trades(order_type);
CREATE INDEX IF NOT EXISTS idx_trades_execution_time ON public.trades(execution_time);

-- Add comments to document the new fields
COMMENT ON COLUMN public.trades.slippage_points IS 'Price slippage in points from requested to execution price';
COMMENT ON COLUMN public.trades.execution_time IS 'Actual execution timestamp from cTrader';
COMMENT ON COLUMN public.trades.order_type IS 'Type of order: MARKET, LIMIT, STOP, STOP_LIMIT, etc.';
COMMENT ON COLUMN public.trades.deal_id IS 'cTrader unique deal identifier';
COMMENT ON COLUMN public.trades.order_id IS 'cTrader unique order identifier';
COMMENT ON COLUMN public.trades.position_id IS 'cTrader position identifier for grouping related deals';
COMMENT ON COLUMN public.trades.filled_volume IS 'Actually filled volume vs requested volume';
COMMENT ON COLUMN public.trades.create_timestamp IS 'When the order was created in cTrader';
COMMENT ON COLUMN public.trades.deal_status IS 'Deal execution status: FILLED, PARTIALLY_FILLED, REJECTED, etc.';
COMMENT ON COLUMN public.trades.base_to_usd_rate IS 'Currency conversion rate at execution time';
COMMENT ON COLUMN public.trades.quote_to_deposit_rate IS 'Quote to account currency conversion rate';
COMMENT ON COLUMN public.trades.gross_profit IS 'Gross profit before commissions and swaps';
COMMENT ON COLUMN public.trades.margin_rate IS 'Margin requirement rate for the trade';
COMMENT ON COLUMN public.trades.spread IS 'Bid-ask spread at time of execution in points';
COMMENT ON COLUMN public.trades.execution_price IS 'Actual execution price (can differ from entry_price for market orders)';
COMMENT ON COLUMN public.trades.market_price_at_entry IS 'Market price when order was placed';
COMMENT ON COLUMN public.trades.market_price_at_exit IS 'Market price when position was closed';