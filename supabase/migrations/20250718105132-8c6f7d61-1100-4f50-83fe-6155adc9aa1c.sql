-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trading accounts table
CREATE TABLE public.trading_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('demo', 'live', 'paper')),
  broker TEXT,
  initial_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  current_equity DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create strategies table
CREATE TABLE public.strategies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rules TEXT,
  risk_per_trade DECIMAL(5,2), -- percentage
  max_daily_risk DECIMAL(5,2), -- percentage
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create confluence checklist items table
CREATE TABLE public.confluence_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  weight DECIMAL(3,2) DEFAULT 1.0, -- importance weight
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trades table
CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trading_account_id UUID NOT NULL,
  strategy_id UUID,
  symbol TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('long', 'short')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  entry_price DECIMAL(15,8) NOT NULL,
  exit_price DECIMAL(15,8),
  quantity DECIMAL(15,8) NOT NULL,
  stop_loss DECIMAL(15,8),
  take_profit DECIMAL(15,8),
  entry_date TIMESTAMP WITH TIME ZONE NOT NULL,
  exit_date TIMESTAMP WITH TIME ZONE,
  pnl DECIMAL(15,2),
  commission DECIMAL(15,2) DEFAULT 0,
  swap DECIMAL(15,2) DEFAULT 0,
  risk_amount DECIMAL(15,2),
  risk_reward_ratio DECIMAL(8,2),
  notes TEXT,
  screenshots TEXT[], -- array of image URLs
  confluence_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trade confluence junction table
CREATE TABLE public.trade_confluence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID NOT NULL,
  confluence_item_id UUID NOT NULL,
  is_present BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(trade_id, confluence_item_id)
);

-- Create notes table
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  category TEXT,
  tags TEXT[],
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE public.trading_accounts ADD CONSTRAINT fk_trading_accounts_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.strategies ADD CONSTRAINT fk_strategies_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.confluence_items ADD CONSTRAINT fk_confluence_items_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.trades ADD CONSTRAINT fk_trades_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.trades ADD CONSTRAINT fk_trades_account FOREIGN KEY (trading_account_id) REFERENCES public.trading_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.trades ADD CONSTRAINT fk_trades_strategy FOREIGN KEY (strategy_id) REFERENCES public.strategies(id) ON DELETE SET NULL;
ALTER TABLE public.trade_confluence ADD CONSTRAINT fk_trade_confluence_trade FOREIGN KEY (trade_id) REFERENCES public.trades(id) ON DELETE CASCADE;
ALTER TABLE public.trade_confluence ADD CONSTRAINT fk_trade_confluence_item FOREIGN KEY (confluence_item_id) REFERENCES public.confluence_items(id) ON DELETE CASCADE;
ALTER TABLE public.notes ADD CONSTRAINT fk_notes_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confluence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_confluence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for trading_accounts
CREATE POLICY "Users can view their own trading accounts" ON public.trading_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own trading accounts" ON public.trading_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own trading accounts" ON public.trading_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own trading accounts" ON public.trading_accounts FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for strategies
CREATE POLICY "Users can view their own strategies" ON public.strategies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own strategies" ON public.strategies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own strategies" ON public.strategies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own strategies" ON public.strategies FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for confluence_items
CREATE POLICY "Users can view their own confluence items" ON public.confluence_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own confluence items" ON public.confluence_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own confluence items" ON public.confluence_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own confluence items" ON public.confluence_items FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for trades
CREATE POLICY "Users can view their own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own trades" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own trades" ON public.trades FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for trade_confluence
CREATE POLICY "Users can view their own trade confluence" ON public.trade_confluence FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.trades WHERE trades.id = trade_confluence.trade_id AND trades.user_id = auth.uid())
);
CREATE POLICY "Users can create their own trade confluence" ON public.trade_confluence FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.trades WHERE trades.id = trade_confluence.trade_id AND trades.user_id = auth.uid())
);
CREATE POLICY "Users can update their own trade confluence" ON public.trade_confluence FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.trades WHERE trades.id = trade_confluence.trade_id AND trades.user_id = auth.uid())
);
CREATE POLICY "Users can delete their own trade confluence" ON public.trade_confluence FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.trades WHERE trades.id = trade_confluence.trade_id AND trades.user_id = auth.uid())
);

-- Create RLS policies for notes
CREATE POLICY "Users can view their own notes" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own notes" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notes" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notes" ON public.notes FOR DELETE USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trading_accounts_updated_at BEFORE UPDATE ON public.trading_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON public.strategies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_confluence_items_updated_at BEFORE UPDATE ON public.confluence_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_trading_accounts_user_id ON public.trading_accounts(user_id);
CREATE INDEX idx_strategies_user_id ON public.strategies(user_id);
CREATE INDEX idx_confluence_items_user_id ON public.confluence_items(user_id);
CREATE INDEX idx_trades_user_id ON public.trades(user_id);
CREATE INDEX idx_trades_account_id ON public.trades(trading_account_id);
CREATE INDEX idx_trades_strategy_id ON public.trades(strategy_id);
CREATE INDEX idx_trades_entry_date ON public.trades(entry_date);
CREATE INDEX idx_trades_symbol ON public.trades(symbol);
CREATE INDEX idx_trade_confluence_trade_id ON public.trade_confluence(trade_id);
CREATE INDEX idx_notes_user_id ON public.notes(user_id);