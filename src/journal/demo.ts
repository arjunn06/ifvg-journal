// Sample journal for the "Explore with sample data" mode. Deterministic (seeded) and relative to
// today, so every period filter has something in it. Every P&L is computed from entry, exit,
// size and the instrument's point value, so a trade row reconciles with its own prices.

import type {
  Account, ConfluenceItem, JournalData, SessionKey, Strategy, Trade, TradeConfluence, TradeMistake, Transaction,
} from './types';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INSTRUMENTS = {
  NQ: { mult: 20, tick: 0.25, base: 24400, stop: [14, 36], fee: 2.4 },
  MNQ: { mult: 2, tick: 0.25, base: 24400, stop: [14, 42], fee: 0.74 },
  ES: { mult: 50, tick: 0.25, base: 6860, stop: [3, 8], fee: 2.4 },
  MES: { mult: 5, tick: 0.25, base: 6860, stop: [3, 9], fee: 0.74 },
  MGC: { mult: 10, tick: 0.1, base: 4210, stop: [4, 11], fee: 0.8 },
} as const;
type Sym = keyof typeof INSTRUMENTS;

const SESSION_WINDOWS: Record<SessionKey, [number, number]> = {
  asia: [20, 23], london: [2, 4], 'new-york-am': [8.5, 10.75], 'new-york-lunch': [12, 13.25], 'new-york-pm': [13.75, 15.5],
};
const SESSION_WEIGHTS: [SessionKey, number][] = [
  ['new-york-am', 0.46], ['london', 0.2], ['new-york-pm', 0.18], ['new-york-lunch', 0.09], ['asia', 0.07],
];
const SESSION_EDGE: Record<SessionKey, number> = {
  'new-york-am': 0.06, london: 0.01, 'new-york-pm': -0.01, 'new-york-lunch': -0.1, asia: -0.07,
};

export const MISTAKE_TAGS = ['FOMO entry', 'Moved stop loss', 'Cut winner early', 'Oversized', 'Revenge trade', 'Ignored the plan'];

const NOTES = {
  win: [
    'Swept the Asia low, closed through the 5m inverse FVG, entered on the retest. Held to the opposing high.',
    'Waited for the displacement leg before entering. Clean target hit, no second-guessing.',
    'HTF bias lined up. Entry on the iFVG body close, stop under the sweep. Scaled at 1R.',
    'Patient. Let price come to the 62% of the leg and took it with the plan.',
  ],
  loss: [
    'Entered before the structure shift closed. Stop hit on the next candle; the idea was early, not wrong.',
    'News window I had flagged and traded anyway. Stopped out on the spike.',
    'Sweep was real but no displacement after it. Should have passed.',
    'Chased the second leg. No iFVG, no entry.',
  ],
  flat: ['Moved to break-even after the first push and got tagged. Fine.'],
};
const EMO_WIN = ['calm', 'focused', 'confident', 'patient'];
const EMO_LOSS = ['impatient', 'frustrated', 'doubtful', 'stressed'];

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function buildDemo(now = new Date()): JournalData {
  const rand = rng(20261030);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const weighted = <T,>(xs: [T, number][]) => {
    let r = rand(), acc = 0;
    for (const [v, w] of xs) { acc += w; if (r <= acc) return v; }
    return xs[xs.length - 1][0];
  };
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = (n: number) => new Date(day0.getFullYear(), day0.getMonth(), day0.getDate() - n);

  const accounts: Account[] = [
    {
      id: 'acc-eval', name: 'Apex 50K evaluation', account_type: 'live', broker: 'Apex Trader Funding',
      initial_balance: 50000, currency: 'USD', is_active: true, is_prop_firm: true, profit_target: 3000,
      max_loss_limit: 2500, daily_loss_limit: 1000, minimum_trading_days: 7, trailing_drawdown_enabled: true,
      equity_goal: null, start_date: daysAgo(44).toISOString(), created_at: daysAgo(44).toISOString(),
    },
    {
      id: 'acc-live', name: 'Personal futures', account_type: 'live', broker: 'Tradovate',
      initial_balance: 12500, currency: 'USD', is_active: true, is_prop_firm: false, profit_target: null,
      max_loss_limit: null, daily_loss_limit: null, minimum_trading_days: null, trailing_drawdown_enabled: null,
      equity_goal: 20000, start_date: daysAgo(150).toISOString(), created_at: daysAgo(150).toISOString(),
    },
    {
      id: 'acc-sim', name: 'Sim · new setups', account_type: 'paper', broker: 'Tradovate Sim',
      initial_balance: 100000, currency: 'USD', is_active: true, is_prop_firm: false, profit_target: null,
      max_loss_limit: null, daily_loss_limit: null, minimum_trading_days: null, trailing_drawdown_enabled: null,
      equity_goal: null, start_date: daysAgo(40).toISOString(), created_at: daysAgo(40).toISOString(),
    },
  ];

  const strategies: Strategy[] = [
    { id: 'st-ifvg', name: 'iFVG reversal', description: 'Liquidity sweep, shift, then the inverse FVG closes through. Entry on the retest.', rules: null, entry_criteria: 'Candle body closes through the FVG against the sweep', exit_criteria: 'Opposing liquidity or 2R, whichever first', timeframe: '1m / 5m', risk_per_trade: 0.5, min_risk_reward: 2, is_active: true },
    { id: 'st-cont', name: 'FVG continuation', description: 'With the HTF trend: displacement leaves an FVG, enter on the first return.', rules: null, entry_criteria: 'First tap of the FVG after displacement', exit_criteria: 'Prior swing high or low', timeframe: '5m / 15m', risk_per_trade: 0.5, min_risk_reward: 2, is_active: true },
    { id: 'st-sweep', name: 'Sweep and MSS', description: 'Raid of a session high or low, market structure shift on the 1m.', rules: null, entry_criteria: 'MSS candle close after the raid', exit_criteria: 'Midpoint of the range, then runner', timeframe: '1m', risk_per_trade: 0.5, min_risk_reward: 1.5, is_active: true },
  ];

  const confluenceItems: ConfluenceItem[] = [
    { id: 'cf-bias', name: 'HTF bias aligned', description: 'Daily and 4H point the same way as the trade', weight: 2, category: 'Context', is_active: true },
    { id: 'cf-liq', name: 'Liquidity swept', description: 'Session or previous-day high or low taken', weight: 2, category: 'Context', is_active: true },
    { id: 'cf-mss', name: 'Market structure shift', description: 'Body close through the last swing on the entry timeframe', weight: 1.5, category: 'Trigger', is_active: true },
    { id: 'cf-ifvg', name: 'Inverse FVG closed through', description: 'Candle body closes through the gap against the sweep', weight: 2, category: 'Trigger', is_active: true },
    { id: 'cf-kill', name: 'Inside a killzone', description: 'London, NY AM or NY PM window', weight: 1, category: 'Timing', is_active: true },
    { id: 'cf-disp', name: 'Displacement with imbalance', description: 'Impulsive leg that leaves an FVG', weight: 1, category: 'Trigger', is_active: true },
    { id: 'cf-ote', name: 'Entry in the 62–79% zone', description: 'Optimal trade entry of the leg', weight: 1, category: 'Entry', is_active: true },
    { id: 'cf-smt', name: 'SMT divergence', description: 'NQ and ES disagree at the extreme', weight: 0.5, category: 'Context', is_active: true },
    { id: 'cf-news', name: 'News-free window', description: 'No red-folder release within 30 minutes', weight: 1, category: 'Timing', is_active: true },
    { id: 'cf-rr', name: 'At least 2R available', description: 'Target at or beyond twice the stop', weight: 1, category: 'Entry', is_active: true },
  ];
  const totalWeight = confluenceItems.reduce((s, c) => s + (c.weight ?? 1), 0);

  const trades: Trade[] = [];
  const tradeConfluence: TradeConfluence[] = [];
  const mistakes: TradeMistake[] = [];
  const prices: Record<string, number> = {};
  let n = 0;

  const accPlan: { id: string; syms: [Sym, number][]; risk: number; fromDays: number; perDay: number; baseWin: number }[] = [
    { id: 'acc-eval', syms: [['MNQ', 0.6], ['MES', 0.28], ['NQ', 0.12]], risk: 250, fromDays: 44, perDay: 0.95, baseWin: 0.24 },
    { id: 'acc-live', syms: [['MNQ', 0.55], ['MES', 0.25], ['MGC', 0.2]], risk: 125, fromDays: 150, perDay: 0.62, baseWin: 0.19 },
    { id: 'acc-sim', syms: [['NQ', 0.6], ['ES', 0.4]], risk: 500, fromDays: 40, perDay: 0.4, baseWin: 0.21 },
  ];

  for (let ago = 150; ago >= 0; ago--) {
    const d = daysAgo(ago);
    const wd = d.getDay();
    for (const s of Object.keys(INSTRUMENTS)) {
      const ins = INSTRUMENTS[s as Sym];
      const key = s.replace(/^M(?=NQ|ES)/, '');
      const prev = prices[key] ?? ins.base;
      prices[key] = prev + (rand() - 0.48) * ins.base * 0.004;
    }
    if (wd === 0 || wd === 6) continue;
    for (const plan of accPlan) {
      if (ago > plan.fromDays) continue;
      // A rough patch on the evaluation: three days of overtrading after a loss.
      const tilt = plan.id === 'acc-eval' && ago >= 11 && ago <= 13;
      const k = tilt ? 3 + (rand() < 0.5 ? 1 : 0) : rand() < plan.perDay ? 1 + (rand() < 0.38 ? 1 : 0) + (rand() < 0.1 ? 1 : 0) : 0;
      let dayLossTrades = 0;
      for (let i = 0; i < k; i++) {
        if (dayLossTrades >= (tilt ? 4 : 2)) break;
        const sym = weighted(plan.syms);
        const ins = INSTRUMENTS[sym];
        const session = weighted(SESSION_WEIGHTS);
        const [h0, h1] = SESSION_WINDOWS[session];
        const hour = h0 + rand() * (h1 - h0);
        const entry = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(hour), Math.floor((hour % 1) * 60), Math.floor(rand() * 60));
        if (session === 'asia') entry.setDate(entry.getDate() - 1);
        if (entry.getTime() > now.getTime() - 15 * 60000) continue;

        const strat = weighted<string>([['st-ifvg', 0.5], ['st-cont', 0.28], ['st-sweep', 0.22]]);
        const side = rand() < 0.52 ? 'long' : 'short';
        const dir = side === 'long' ? 1 : -1;
        const stopPts = round(ins.stop[0] + rand() * (ins.stop[1] - ins.stop[0]), 2);
        const stopPtsT = Math.round(stopPts / ins.tick) * ins.tick;
        const qty = Math.max(1, Math.round(plan.risk / (stopPtsT * ins.mult)));
        const risk = round(stopPtsT * qty * ins.mult);

        // checklist: more items present on better setups
        const target = Math.min(0.99, Math.max(0.3, 0.74 + (rand() - 0.5) * 0.5 + (strat === 'st-ifvg' ? 0.04 : 0)));
        const present = confluenceItems.filter((c) => rand() < target + ((c.weight ?? 1) >= 2 ? 0.08 : 0));
        const id = `tr-${String(++n).padStart(3, '0')}`;
        for (const c of confluenceItems) tradeConfluence.push({ trade_id: id, confluence_item_id: c.id, is_present: present.includes(c) });
        const score = round((present.reduce((s, c) => s + (c.weight ?? 1), 0) / totalWeight) * 100, 0);

        const tags: string[] = [];
        const mistakeProb = score < 60 ? 0.5 : score < 80 ? 0.2 : 0.08;
        if (rand() < mistakeProb) tags.push(pick(MISTAKE_TAGS));
        if (tilt && i > 0 && rand() < 0.7) tags.push('Revenge trade');
        else if (dayLossTrades >= 1 && rand() < 0.2) tags.push('Revenge trade');
        const uniqueTags = [...new Set(tags)];

        const pWin = Math.min(0.78, Math.max(0.14,
          plan.baseWin + (score - 50) / 100 * 0.55 + SESSION_EDGE[session] + (strat === 'st-ifvg' ? 0.05 : strat === 'st-sweep' ? -0.03 : 0) - uniqueTags.length * 0.1 - (tilt ? 0.1 : 0)));
        const u = rand();
        let R: number;
        if (u < pWin) {
          R = 0.9 + 2.5 * Math.pow(rand(), 1.5);
          if (uniqueTags.includes('Cut winner early')) R *= 0.4;
        } else if (u < pWin + (1 - pWin) * 0.09) R = 0;
        else {
          R = rand() < 0.14 ? -0.6 : -1;
          if (uniqueTags.includes('Moved stop loss')) R = -1.5;
        }
        const px = (prices[sym.replace(/^M(?=NQ|ES)/, '')] ?? ins.base);
        const entryPx = round(Math.round(px / ins.tick) * ins.tick, 2);
        const movePts = Math.round((R * stopPtsT) / ins.tick) * ins.tick;
        const exitPx = round(entryPx + dir * movePts, 2);
        const pnl = round(dir * (exitPx - entryPx) * qty * ins.mult);
        const fees = round(qty * ins.fee * 2);
        const stop = round(entryPx - dir * stopPtsT, 2);
        const tp = round(entryPx + dir * stopPtsT * 2.2, 2);
        const minutes = 4 + Math.floor(Math.pow(rand(), 1.6) * 90);
        const exit = new Date(entry.getTime() + minutes * 60000);
        if (pnl < 0) dayLossTrades++;

        trades.push({
          id, user_id: 'demo', trading_account_id: plan.id, strategy_id: strat, symbol: sym, trade_type: side,
          status: 'closed', session, entry_price: entryPx, exit_price: exitPx, quantity: qty, stop_loss: stop, take_profit: tp,
          entry_date: entry.toISOString(), exit_date: exit.toISOString(), pnl, commission: fees, swap: 0,
          risk_amount: risk, risk_reward_ratio: 2.2,
          notes: pick(pnl > 0 ? NOTES.win : pnl < 0 ? NOTES.loss : NOTES.flat),
          emotions: pnl > 0 ? pick(EMO_WIN) : pnl < 0 ? pick(EMO_LOSS) : 'calm',
          screenshots: null, confluence_score: score, created_at: exit.toISOString(),
        });
        for (const tag of uniqueTags) {
          mistakes.push({ id: `mk-${mistakes.length + 1}`, trade_id: id, mistake_tag: tag, description: null, severity: tag === 'Oversized' || tag === 'Revenge trade' ? 'high' : 'medium' });
        }
      }
    }
  }

  // One position still open on the personal account.
  const open = new Date(now.getTime() - 55 * 60000);
  trades.push({
    id: 'tr-open', user_id: 'demo', trading_account_id: 'acc-live', strategy_id: 'st-ifvg', symbol: 'MNQ', trade_type: 'long',
    status: 'open', session: 'new-york-am', entry_price: round(prices.NQ ?? 24400, 0), exit_price: null, quantity: 2,
    stop_loss: round((prices.NQ ?? 24400) - 24, 0), take_profit: round((prices.NQ ?? 24400) + 56, 0),
    entry_date: open.toISOString(), exit_date: null, pnl: null, commission: null, swap: null, risk_amount: 96, risk_reward_ratio: 2.3,
    notes: 'Swept the overnight low, 1m iFVG closed through. In, stop under the sweep.', emotions: 'calm',
    screenshots: null, confluence_score: 90, created_at: open.toISOString(),
  });

  trades.sort((a, b) => +new Date(b.entry_date) - +new Date(a.entry_date));

  const transactions: Transaction[] = [
    { id: 'tx-1', trading_account_id: 'acc-eval', transaction_type: 'evaluation_fee', amount: 167, description: 'Apex 50K evaluation, monthly', transaction_date: daysAgo(44).toISOString() },
    { id: 'tx-2', trading_account_id: 'acc-live', transaction_type: 'deposit', amount: 2000, description: 'Top-up from savings', transaction_date: daysAgo(78).toISOString() },
    { id: 'tx-3', trading_account_id: 'acc-live', transaction_type: 'withdrawal', amount: 750, description: 'Monthly withdrawal', transaction_date: daysAgo(28).toISOString() },
  ];

  // Reconciliation, as assertions the console shows if the generator ever drifts.
  for (const t of trades) {
    if (t.status !== 'closed') continue;
    const ins = INSTRUMENTS[t.symbol as Sym];
    const expect = round((t.trade_type === 'long' ? 1 : -1) * (t.exit_price! - t.entry_price) * t.quantity * ins.mult);
    console.assert(Math.abs(expect - t.pnl!) < 0.01, 'demo pnl does not reconcile', t.id);
  }

  return { accounts, trades, strategies, confluenceItems, tradeConfluence, mistakes, transactions };
}
