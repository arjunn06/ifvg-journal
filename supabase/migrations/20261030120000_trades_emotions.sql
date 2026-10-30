-- The journal's trade form and the quick-log flow both save the trader's state of mind in trades.emotions.
-- No earlier migration creates the column (the old form wrote it too, so it may already exist in the live
-- project); this makes sure it is there. Safe to run more than once.
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS emotions text;
