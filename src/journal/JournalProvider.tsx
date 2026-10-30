import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { buildDemo } from './demo';
import { inPeriod, type Period } from './analytics';
import type { Account, JournalData, Trade, TradeMistake } from './types';

const DEMO_KEY = 'ifvg-demo';
const SCOPE_KEY = 'ifvg-scope';
const PERIOD_KEY = 'ifvg-period';

const read = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage blocked */ } };

// ?demo opens the app on sample data without signing in. It is read once, when the page loads, and then
// removed from the address bar, so a stale tab or bookmark cannot switch sample data back on after you exit.
(function consumeDemoParam() {
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has('demo')) return;
    localStorage.setItem(DEMO_KEY, '1');
    if (!localStorage.getItem(SCOPE_KEY)) localStorage.setItem(SCOPE_KEY, 'acc-eval');
    u.searchParams.delete('demo');
    window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
  } catch { /* storage or history blocked */ }
})();

export const isDemoMode = () => read(DEMO_KEY) === '1';
/** Leave sample data for good: clear every key it set, then replace the page so Back cannot land on a ?demo URL. */
export function exitDemo() {
  for (const k of [DEMO_KEY, SCOPE_KEY, PERIOD_KEY]) write(k, null);
  window.location.replace('/auth');
}

export function setDemoMode(on: boolean) {
  write(DEMO_KEY, on ? '1' : null);
  if (on) write(SCOPE_KEY, 'acc-eval');
  else write(SCOPE_KEY, null);
}

export interface SaveTradeExtras {
  confluence?: Record<string, boolean>;
  mistakes?: { tag: string; severity: 'low' | 'medium' | 'high'; description?: string | null }[];
}

interface JournalContext extends JournalData {
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  userId: string | null;
  refresh: () => Promise<void>;

  /** 'all' means every active account. */
  scope: string;
  setScope: (id: string) => void;
  period: Period;
  setPeriod: (p: Period) => void;
  scopeAccounts: Account[];
  /** Trades in the chosen account(s), any date. */
  scopeTrades: Trade[];
  /** Trades in the chosen account(s) and period. */
  viewTrades: Trade[];
  startBalance: number;

  saveTrade: (trade: Partial<Trade>, extras?: SaveTradeExtras) => Promise<string>;
  importTrades: (accountId: string, trades: Partial<Trade>[]) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
}

const Ctx = createContext<JournalContext | null>(null);
export const useJournal = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useJournal outside JournalProvider');
  return c;
};

const EMPTY: JournalData = {
  accounts: [], trades: [], strategies: [], confluenceItems: [], tradeConfluence: [], mistakes: [], transactions: [],
};

async function loadAll(userId: string): Promise<JournalData> {
  const q = <T,>(p: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) =>
    Promise.resolve(p).then(({ data, error }) => { if (error) throw new Error(error.message); return data ?? []; });
  const [accounts, trades, strategies, confluenceItems, mistakes, transactions] = await Promise.all([
    q(supabase.from('trading_accounts').select('*').eq('user_id', userId)),
    q(supabase.from('trades').select('*').eq('user_id', userId).order('entry_date', { ascending: false })),
    q(supabase.from('strategies').select('*').eq('user_id', userId)),
    q(supabase.from('confluence_items').select('*').eq('user_id', userId)),
    q(supabase.from('trade_mistakes').select('*').eq('user_id', userId)),
    q(supabase.from('financial_transactions').select('*').eq('user_id', userId)),
  ]);
  const ids = (trades as { id: string }[]).map((t) => t.id);
  const tradeConfluence = ids.length
    ? await q(supabase.from('trade_confluence').select('trade_id, confluence_item_id, is_present').in('trade_id', ids.slice(0, 1000)))
    : [];
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    accounts: (accounts as any[]).map((a) => ({
      ...a, initial_balance: Number(a.initial_balance), profit_target: num(a.profit_target), max_loss_limit: num(a.max_loss_limit),
      daily_loss_limit: num(a.daily_loss_limit), equity_goal: num(a.equity_goal),
    })),
    trades: (trades as any[]).map((t) => ({
      ...t, entry_price: Number(t.entry_price), exit_price: num(t.exit_price), quantity: Number(t.quantity), stop_loss: num(t.stop_loss),
      take_profit: num(t.take_profit), pnl: num(t.pnl), commission: num(t.commission), swap: num(t.swap), risk_amount: num(t.risk_amount),
      risk_reward_ratio: num(t.risk_reward_ratio), confluence_score: num(t.confluence_score),
    })),
    strategies: strategies as any[],
    confluenceItems: (confluenceItems as any[]).map((c) => ({ ...c, weight: num(c.weight) })),
    tradeConfluence: tradeConfluence as any[],
    mistakes: mistakes as any[],
    transactions: (transactions as any[]).map((x) => ({ ...x, amount: Number(x.amount) })),
  };
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isDemo = isDemoMode();
  const userId = isDemo ? 'demo' : user?.id ?? null;

  const [demo, setDemo] = useState<JournalData | null>(() => (isDemo ? buildDemo() : null));
  useEffect(() => { if (isDemo && !demo) setDemo(buildDemo()); }, [isDemo, demo]);

  const live = useQuery({
    queryKey: ['journal', userId],
    queryFn: () => loadAll(userId!),
    enabled: !isDemo && !!userId,
    staleTime: 60_000,
  });

  const data = (isDemo ? demo : live.data) ?? EMPTY;
  const loading = isDemo ? !demo : live.isLoading;
  const error = live.error ? (live.error as Error).message : null;

  const [scope, setScopeState] = useState<string>(() => read(SCOPE_KEY) ?? 'all');
  const [period, setPeriodState] = useState<Period>(() => (read(PERIOD_KEY) as Period) ?? '30d');
  const setScope = useCallback((id: string) => { setScopeState(id); write(SCOPE_KEY, id); }, []);
  const setPeriod = useCallback((p: Period) => { setPeriodState(p); write(PERIOD_KEY, p); }, []);

  const scopeAccounts = useMemo(
    () => (scope === 'all' ? data.accounts.filter((a) => a.is_active) : data.accounts.filter((a) => a.id === scope)),
    [data.accounts, scope],
  );
  const scopeTrades = useMemo(() => {
    const ids = new Set(scopeAccounts.map((a) => a.id));
    return data.trades.filter((t) => ids.has(t.trading_account_id));
  }, [data.trades, scopeAccounts]);
  const viewTrades = useMemo(() => inPeriod(scopeTrades, period), [scopeTrades, period]);
  const startBalance = useMemo(() => scopeAccounts.reduce((s, a) => s + a.initial_balance, 0), [scopeAccounts]);

  // If the saved scope points at an account that no longer exists, fall back to all.
  useEffect(() => {
    if (scope !== 'all' && data.accounts.length && !data.accounts.some((a) => a.id === scope)) setScope('all');
  }, [scope, data.accounts, setScope]);

  const refresh = useCallback(async () => {
    if (isDemo) return;
    await qc.invalidateQueries({ queryKey: ['journal', userId] });
  }, [isDemo, qc, userId]);

  const saveTrade = useCallback(async (trade: Partial<Trade>, extras?: SaveTradeExtras) => {
    const confluenceRows = (id: string) =>
      Object.entries(extras?.confluence ?? {}).map(([confluence_item_id, is_present]) => ({ trade_id: id, confluence_item_id, is_present }));
    const mistakeRows = (id: string): Omit<TradeMistake, 'id'>[] =>
      (extras?.mistakes ?? []).map((m) => ({ trade_id: id, mistake_tag: m.tag, severity: m.severity, description: m.description ?? null }));

    if (isDemo) {
      const id = trade.id ?? `tr-${Date.now()}`;
      setDemo((d) => {
        if (!d) return d;
        const row = { ...(d.trades.find((t) => t.id === id) ?? ({} as Trade)), ...trade, id, user_id: 'demo', created_at: new Date().toISOString() } as Trade;
        return {
          ...d,
          trades: [row, ...d.trades.filter((t) => t.id !== id)].sort((a, b) => +new Date(b.entry_date) - +new Date(a.entry_date)),
          tradeConfluence: extras?.confluence ? [...d.tradeConfluence.filter((c) => c.trade_id !== id), ...confluenceRows(id)] : d.tradeConfluence,
          mistakes: extras?.mistakes ? [...d.mistakes.filter((m) => m.trade_id !== id), ...mistakeRows(id).map((m, i) => ({ ...m, id: `mk-${Date.now()}-${i}` }))] : d.mistakes,
        };
      });
      return id;
    }

    if (!userId) throw new Error('Not signed in');
    let id = trade.id;
    const payload = { ...trade, user_id: userId } as Record<string, unknown>;
    delete payload.id;
    if (id) {
      const { error } = await supabase.from('trades').update(payload as never).eq('id', id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await supabase.from('trades').insert(payload as never).select('id').single();
      if (error) throw new Error(error.message);
      id = (row as { id: string }).id;
    }
    if (extras?.confluence) {
      await supabase.from('trade_confluence').delete().eq('trade_id', id!);
      const rows = confluenceRows(id!);
      if (rows.length) { const { error } = await supabase.from('trade_confluence').insert(rows as never); if (error) throw new Error(error.message); }
    }
    if (extras?.mistakes) {
      await supabase.from('trade_mistakes').delete().eq('trade_id', id!);
      const rows = mistakeRows(id!).map((m) => ({ ...m, user_id: userId }));
      if (rows.length) { const { error } = await supabase.from('trade_mistakes').insert(rows as never); if (error) throw new Error(error.message); }
    }
    await refresh();
    return id!;
  }, [isDemo, userId, refresh]);

  const deleteTrade = useCallback(async (id: string) => {
    if (isDemo) {
      setDemo((d) => d && ({
        ...d, trades: d.trades.filter((t) => t.id !== id),
        tradeConfluence: d.tradeConfluence.filter((c) => c.trade_id !== id), mistakes: d.mistakes.filter((m) => m.trade_id !== id),
      }));
      return;
    }
    const { error } = await supabase.from('trades').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await refresh();
  }, [isDemo, refresh]);

  const importTrades = useCallback(async (accountId: string, imported: Partial<Trade>[]) => {
    if (!data.accounts.some((a) => a.id === accountId && a.is_active)) throw new Error('Choose an active account');
    if (isDemo) {
      setDemo((d) => d && ({
        ...d,
        trades: [...imported.map((trade, i) => ({
          ...trade, id: `tr-import-${Date.now()}-${i}`, user_id: 'demo', trading_account_id: accountId,
          created_at: new Date().toISOString(), source: 'csv',
        } as Trade)), ...d.trades].sort((a, b) => +new Date(b.entry_date) - +new Date(a.entry_date)),
      }));
      return;
    }
    if (!userId) throw new Error('Not signed in');
    const rows = imported.map((trade) => ({ ...trade, user_id: userId, trading_account_id: accountId, source: 'csv' }));
    const { error } = await supabase.from('trades').insert(rows as never);
    if (error) throw new Error(error.message);
    await refresh();
  }, [data.accounts, isDemo, refresh, userId]);

  const value: JournalContext = {
    ...data, loading, error, isDemo, userId, refresh,
    scope, setScope, period, setPeriod, scopeAccounts, scopeTrades, viewTrades, startBalance,
    saveTrade, importTrades, deleteTrade,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
