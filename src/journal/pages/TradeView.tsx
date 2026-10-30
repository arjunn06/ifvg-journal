// One trade, in full. The question this screen answers: "Was this trade taken to the plan, and what would I change?"
// Biggest block: the checklist and the exit against the plan, side by side with the numbers.

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useJournal } from '../JournalProvider';
import { duration, money, rMult, qty } from '../format';
import { sessionLabel } from '../types';
import { Empty, Kpis, PageHeader, Panel, Pill, Skel } from '../ui/kit';
import TradeInspector, { DeleteTradeDialog, useTradeFacts, whenLabel } from '../ui/TradeInspector';
import { byEntryDesc, resultKind, resultLabel, sideWord } from '../ui/tradeInfo';
import type { Trade } from '../types';
import './journal-list.css';

function Loading() {
  return (
    <>
      <PageHeader title="Trade" sub={<Skel w={320} />} />
      <div className="j-kpis">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="j-kpi"><Skel w={70} h={12} /><div style={{ marginTop: 10 }}><Skel w={90} h={24} /></div></div>)}
      </div>
      <div className="j-grid top">
        <div className="j-panel j-span-7" style={{ height: 420 }} />
        <div className="j-panel j-span-5" style={{ height: 420 }} />
      </div>
    </>
  );
}

function NotFound() {
  return (
    <>
      <PageHeader title="Trade not found" />
      <Panel>
        <div className="jl-empty">
          <Empty>This trade doesn't exist or was deleted.</Empty>
          <Link className="j-btn" to="/trades"><ChevronLeft /> Back to Journal</Link>
        </div>
      </Panel>
    </>
  );
}

function Detail({ trade, older, newer }: { trade: Trade; older: Trade | null; newer: Trade | null }) {
  const nav = useNavigate();
  const f = useTradeFacts(trade);
  const [del, setDel] = useState(false);
  const open = trade.status === 'open';
  const cur = f.currency;
  const sub = `${whenLabel(trade.entry_date)} · ${f.account?.name ?? 'Unknown account'}${f.strategy ? ` · ${f.strategy.name}` : ''}`;
  const score = f.checklist.score;

  return (
    <>
      <PageHeader
        title={`${trade.symbol} ${sideWord(trade)}`}
        sub={sub}
        actions={
          <>
            <button className="j-icon-btn" disabled={!older} onClick={() => older && nav(`/trades/${older.id}`)} aria-label="Previous trade, the one before this" title="Previous trade"><ChevronLeft /></button>
            <button className="j-icon-btn" disabled={!newer} onClick={() => newer && nav(`/trades/${newer.id}`)} aria-label="Next trade, the one after this" title="Next trade"><ChevronRight /></button>
            <button className="j-btn" onClick={() => nav(`/trades/edit/${trade.id}`)}><Pencil /> Edit</button>
            <button className="j-btn danger" onClick={() => setDel(true)}><Trash2 /> Delete</button>
          </>
        }
      />
      <Kpis items={[
        {
          label: 'Result', lead: true, tone: !open && (trade.pnl ?? 0) < 0 ? 'neg' : 'flat',
          value: open ? 'Open' : money(trade.pnl, cur, { sign: true }),
          note: <><Pill kind={resultKind(f.result)}>{resultLabel(f.result)}</Pill>{!open && trade.commission != null ? <span> · fees {money(-Math.abs(trade.commission), cur)}</span> : null}</>,
        },
        { label: 'R multiple', value: f.r != null ? rMult(f.r) : '—', tone: f.r != null && f.r < 0 ? 'neg' : 'flat', note: trade.risk_amount != null ? `on ${money(trade.risk_amount, cur)} risked` : 'no risk recorded' },
        { label: 'Duration', value: open ? 'Running' : duration(trade.entry_date, trade.exit_date), note: sessionLabel(trade.session) },
        { label: 'Size', value: qty(trade.quantity), unit: trade.quantity === 1 ? 'contract' : trade.quantity ? 'contracts' : undefined, note: `${trade.symbol} ${sideWord(trade)}` },
        { label: 'Confluence', value: score != null ? `${score}%` : '—', note: f.checklist.total ? `${f.checklist.present} of ${f.checklist.total} items` : 'no checklist logged' },
      ]} />
      <TradeInspector trade={trade} variant="page" />
      <DeleteTradeDialog trade={trade} open={del} onClose={() => setDel(false)} />
    </>
  );
}

export default function TradeView() {
  const { id } = useParams();
  const { trades, loading } = useJournal();
  const ordered = useMemo(() => [...trades].sort(byEntryDesc), [trades]);
  if (loading) return <Loading />;
  const i = ordered.findIndex((t) => t.id === id);
  if (i < 0) return <NotFound />;
  return <Detail key={ordered[i].id} trade={ordered[i]} older={ordered[i + 1] ?? null} newer={ordered[i - 1] ?? null} />;
}
