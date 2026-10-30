// Everything the landing page shows is computed from the sample journal by the same functions the
// signed-in app uses, so a figure in a picture always reconciles with the rows behind it.
// `now` is the end of today: the data is the same for every visit on a given day.

import { buildDemo } from '../demo';
import * as A from '../analytics';
import type { Account, JournalData, Trade } from '../types';

export interface LandingData {
  data: JournalData;
  accounts: number;
  trades: Trade[];
  closed: Trade[];
  end: Date;
  evalAccount: Account;
  evalTrades: Trade[];
  summary: A.Summary;
  tiers: A.Row[];
  sessions: A.Row[];
  costs: A.MistakeRow[];
  adherence: ReturnType<typeof A.planAdherence>;
  prop: A.PropStatus;
  bins: A.Bin[];
}

let cache: LandingData | null = null;

export function landingData(): LandingData {
  if (cache) return cache;
  const t = new Date();
  const end = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 0);
  const data = buildDemo(end);
  // The paper account is left out: the page shows the two accounts a trader would put real money on.
  const live = new Set(data.accounts.filter((a) => a.account_type !== 'paper').map((a) => a.id));
  const trades = data.trades.filter((x) => live.has(x.trading_account_id));
  const closed = trades.filter(A.isClosed);
  const evalAccount = data.accounts.find((a) => a.is_prop_firm) ?? data.accounts[0];
  const evalTrades = trades.filter((x) => x.trading_account_id === evalAccount.id);
  cache = {
    data, accounts: live.size, trades, closed, end, evalAccount, evalTrades,
    summary: A.summarize(trades),
    tiers: A.byConfluence(trades),
    sessions: A.bySession(trades).sort((a, b) => b.net - a.net),
    costs: A.mistakeCosts(trades, data.mistakes),
    adherence: A.planAdherence(trades, data.mistakes),
    prop: A.propStatus(evalAccount, trades, data.transactions, end),
    bins: A.rHistogram(trades),
  };
  return cache;
}
