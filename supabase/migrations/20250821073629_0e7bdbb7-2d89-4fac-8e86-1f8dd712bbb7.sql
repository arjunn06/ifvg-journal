-- Add enhanced strategy fields for criteria management
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS entry_criteria TEXT;
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS exit_criteria TEXT;
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS partial_criteria TEXT;
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS be_criteria TEXT;
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS min_risk_reward NUMERIC;
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS max_risk_reward NUMERIC;
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS timeframe TEXT;
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS market_conditions TEXT;

-- Create mistakes tracking table
CREATE TABLE IF NOT EXISTS trade_mistakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  mistake_tag TEXT NOT NULL,
  description TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- Enable RLS on trade_mistakes
ALTER TABLE trade_mistakes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for trade_mistakes
CREATE POLICY "Users can view their own trade mistakes" ON trade_mistakes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trade mistakes" ON trade_mistakes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trade mistakes" ON trade_mistakes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trade mistakes" ON trade_mistakes
  FOR DELETE USING (auth.uid() = user_id);

-- Create mistake tags table for reusable tags
CREATE TABLE IF NOT EXISTS mistake_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name TEXT NOT NULL,
  category TEXT,
  color TEXT DEFAULT '#ef4444',
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tag_name, user_id)
);

-- Enable RLS on mistake_tags
ALTER TABLE mistake_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for mistake_tags
CREATE POLICY "Users can view their own mistake tags" ON mistake_tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mistake tags" ON mistake_tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mistake tags" ON mistake_tags
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mistake tags" ON mistake_tags
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trade_mistakes_trade_id ON trade_mistakes(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_mistakes_user_id ON trade_mistakes(user_id);
CREATE INDEX IF NOT EXISTS idx_mistake_tags_user_id ON mistake_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_mistake_tags_tag_name ON mistake_tags(tag_name);