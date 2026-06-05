/**
 * Properly typed API interfaces to replace 'any' usage
 */

// Trading related types
export interface TradingAccount {
  id: string;
  user_id: string;
  name: string;
  account_type: string;
  broker?: string;
  currency: string;
  current_balance: number;
  current_equity: number;
  initial_balance: number;
  equity_goal?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  trading_account_id: string;
  strategy_id?: string;
  symbol: string;
  trade_type: 'long' | 'short';
  entry_price: number;
  exit_price?: number;
  quantity: number;
  stop_loss?: number;
  take_profit?: number;
  status: 'open' | 'closed' | 'cancelled';
  entry_date: string;
  exit_date?: string;
  pnl?: number;
  swap?: number;
  commission?: number;
  notes?: string;
  emotions?: string;
  screenshots?: string[];
  confluence_score?: number;
  risk_reward_ratio?: number;
  risk_amount?: number;
  external_id?: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  rules?: string;
  risk_per_trade?: number;
  max_daily_risk?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConfluenceItem {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  category?: string;
  weight?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content?: string;
  category?: string;
  tags?: string[];
  images?: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountTransaction {
  id: string;
  user_id: string;
  trading_account_id: string;
  transaction_type: string;
  amount: number;
  description?: string;
  transaction_date: string;
  created_at: string;
  updated_at: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    status?: number;
    code?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  count?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

// Payment related types
export interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  paymentMethod?: 'razorpay' | 'zoho';
  customerEmail?: string;
  plan?: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SubscriptionData {
  subscribed: boolean;
  subscription_tier: string;
  subscription_end?: string;
  isActive: boolean;
}

// Chart data types
export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winRate: number;
  profitLoss: number;
  averageWin: number;
  averageLoss: number;
  maxDrawdown: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
}

// File upload types
export interface FileUpload {
  file: File;
  url?: string;
  name: string;
  size: number;
  type: string;
}

// cTrader integration types
export interface CTraderConnection {
  id: string;
  user_id: string;
  trading_account_id: string;
  account_number: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  connected_at: string;
  updated_at: string;
}

export interface CTraderAuthState {
  id: string;
  user_id: string;
  trading_account_id: string;
  account_number: string;
  state: string;
  expires_at: string;
  created_at: string;
}

// Form data types
export interface TradeFormData {
  symbol: string;
  trade_type: 'long' | 'short';
  entry_price: number;
  exit_price?: number;
  quantity: number;
  stop_loss?: number;
  take_profit?: number;
  entry_date: string;
  exit_date?: string;
  trading_account_id: string;
  strategy_id?: string;
  notes?: string;
  emotions?: string;
  screenshots?: FileUpload[];
  confluence_items?: string[];
}

export interface AccountFormData {
  name: string;
  account_type: string;
  broker?: string;
  currency: string;
  initial_balance: number;
  current_balance: number;
  current_equity: number;
  equity_goal?: number;
}

export interface StrategyFormData {
  name: string;
  description?: string;
  rules?: string;
  risk_per_trade?: number;
  max_daily_risk?: number;
  is_active: boolean;
}

// Error types
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: ValidationError[];
}