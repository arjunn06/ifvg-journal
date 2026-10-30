// Row shapes for the tables the journal reads. They mirror supabase/migrations; the generated
// Database type in integrations/supabase/types.ts is empty, so these are the typed surface.

export type Side = 'long' | 'short';
export type TradeStatus = 'open' | 'closed' | 'cancelled';
export type SessionKey = 'asia' | 'london' | 'new-york-am' | 'new-york-lunch' | 'new-york-pm';

export interface Account {
  id: string;
  name: string;
  account_type: 'demo' | 'live' | 'paper';
  broker: string | null;
  initial_balance: number;
  currency: string;
  is_active: boolean;
  is_prop_firm: boolean | null;
  profit_target: number | null;
  max_loss_limit: number | null;
  daily_loss_limit: number | null;
  minimum_trading_days: number | null;
  trailing_drawdown_enabled: boolean | null;
  equity_goal: number | null;
  start_date: string | null;
  created_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  trading_account_id: string;
  strategy_id: string | null;
  symbol: string;
  trade_type: Side;
  status: TradeStatus;
  session: SessionKey | null;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  stop_loss: number | null;
  take_profit: number | null;
  entry_date: string;
  exit_date: string | null;
  pnl: number | null;
  commission: number | null;
  swap: number | null;
  risk_amount: number | null;
  risk_reward_ratio: number | null;
  notes: string | null;
  emotions: string | null;
  screenshots: string[] | null;
  confluence_score: number | null;
  /** 'manual' | 'quick' (logged from the quick-log flow, no prices) | broker sync names */
  source?: string | null;
  created_at: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string | null;
  rules: string | null;
  entry_criteria: string | null;
  exit_criteria: string | null;
  timeframe: string | null;
  risk_per_trade: number | null;
  min_risk_reward: number | null;
  is_active: boolean;
}

export interface ConfluenceItem {
  id: string;
  name: string;
  description: string | null;
  weight: number | null;
  category: string | null;
  is_active: boolean;
}

export interface TradeConfluence {
  trade_id: string;
  confluence_item_id: string;
  is_present: boolean;
}

export interface TradeMistake {
  id: string;
  trade_id: string;
  mistake_tag: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | null;
}

export type TransactionType = 'deposit' | 'withdrawal' | 'challenge_fee' | 'evaluation_fee' | 'funded_account_fee' | 'payout' | 'balance_adjustment';

export interface Transaction {
  id: string;
  trading_account_id: string | null;
  transaction_type: TransactionType;
  amount: number;
  description: string | null;
  transaction_date: string;
}

export interface JournalData {
  accounts: Account[];
  trades: Trade[];
  strategies: Strategy[];
  confluenceItems: ConfluenceItem[];
  tradeConfluence: TradeConfluence[];
  mistakes: TradeMistake[];
  transactions: Transaction[];
}

export const SESSIONS: { key: SessionKey; label: string; window: string }[] = [
  { key: 'asia', label: 'Asia', window: '20:00–00:00' },
  { key: 'london', label: 'London', window: '02:00–05:00' },
  { key: 'new-york-am', label: 'New York AM', window: '08:30–11:00' },
  { key: 'new-york-lunch', label: 'NY lunch', window: '12:00–13:30' },
  { key: 'new-york-pm', label: 'New York PM', window: '13:30–16:00' },
];

export const sessionLabel = (k: string | null | undefined) =>
  SESSIONS.find((s) => s.key === k)?.label ?? '—';
