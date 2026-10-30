// One trade, laid out for reading. `pane` is the sticky inspector beside the Journal table; `page` lays the
// same sections out in the two-column grid of the full trade screen (the page header carries the title,
// the actions and the KPI strip, so the pane's headline and buttons are left out there).

import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check, Minus, Pencil, Trash2 } from 'lucide-react';
import { useJournal } from '../JournalProvider';
import { duration, isoDate, money, price, rMult, timeHM, qty } from '../format';
import { rOf } from '../analytics';
import { sessionLabel, type Trade } from '../types';
import { ConfirmDialog, Dialog, Empty, Panel, Pill, PnL, Signed } from './kit';
import { TradeLadder as RLadder } from './TradeLadder';
import { checklistFor, mistakesFor, resultKind, resultLabel, resultOf, sideWord } from './tradeInfo';
import './trade-inspector.css';

/** "Fri 30 Oct, 09:42" */
export const whenLabel = (iso: string) =>
  `${new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso)).replace(',', '')}, ${timeHM(iso)}`;

const stamp = (iso: string | null) => (iso ? `${isoDate(iso)} ${timeHM(iso)}` : '—');
const cap = (s: string | null) => (s ? s[0].toUpperCase() + s.slice(1) : '—');

/** Everything a section needs about a trade, looked up once. */
export function useTradeFacts(trade: Trade) {
  const J = useJournal();
  const account = J.accounts.find((a) => a.id === trade.trading_account_id);
  const strategy = J.strategies.find((s) => s.id === trade.strategy_id);
  const checklist = useMemo(() => checklistFor(trade, J.confluenceItems, J.tradeConfluence), [trade, J.confluenceItems, J.tradeConfluence]);
  const mistakes = useMemo(() => mistakesFor(trade, J.mistakes), [trade, J.mistakes]);
  return { account, currency: account?.currency ?? 'USD', strategy, checklist, mistakes, result: resultOf(trade), r: rOf(trade) };
}

type Facts = ReturnType<typeof useTradeFacts>;

/** A titled block: a bordered Panel on the page, a ruled section inside the pane. */
function Block({ variant, title, meta, children }: { variant: 'pane' | 'page'; title: string; meta?: ReactNode; children: ReactNode }) {
  if (variant === 'page') return <Panel title={title} meta={meta}>{children}</Panel>;
  return (
    <section className="jti-sec">
      <header><h3>{title}</h3>{meta && <span className="j-meta">{meta}</span>}</header>
      {children}
    </section>
  );
}

function Execution({ trade, f }: { trade: Trade; f: Facts }) {
  const planned = trade.stop_loss != null && trade.take_profit != null && trade.entry_price !== trade.stop_loss
    ? Math.abs(trade.take_profit - trade.entry_price) / Math.abs(trade.entry_price - trade.stop_loss)
    : trade.risk_reward_ratio;
  const open = trade.status === 'open';
  return (
    <dl className="j-kv jti-kv">
      <dt>Entry</dt><dd className="j-num">{price(trade.entry_price)}</dd>
      <dt>Exit</dt><dd className="j-num">{open ? <span className="j-dim">Still open</span> : price(trade.exit_price)}</dd>
      <dt>Stop</dt><dd className="j-num">{price(trade.stop_loss)}</dd>
      <dt>Target</dt><dd className="j-num">{price(trade.take_profit)}</dd>
      <dt>Size</dt><dd className="j-num">{qty(trade.quantity)}</dd>
      <dt>Risk</dt><dd className="j-num">{trade.risk_amount != null ? money(trade.risk_amount, f.currency) : '—'}</dd>
      <dt>Planned R:R</dt><dd className="j-num">{planned != null ? `1 : ${planned.toFixed(2)}` : '—'}</dd>
      <dt>Commission</dt><dd className="j-num">{trade.commission != null ? money(-Math.abs(trade.commission), f.currency) : '—'}</dd>
      <dt>Swap</dt><dd className="j-num">{trade.swap != null ? money(trade.swap, f.currency) : '—'}</dd>
      <dt>Duration</dt><dd className="j-num">{open ? 'Running' : duration(trade.entry_date, trade.exit_date)}</dd>
      <dt>Opened</dt><dd className="j-num">{stamp(trade.entry_date)}</dd>
      <dt>Closed</dt><dd className="j-num">{stamp(trade.exit_date)}</dd>
    </dl>
  );
}

function Setup({ trade, f }: { trade: Trade; f: Facts }) {
  return (
    <dl className="j-kv jti-kv">
      <dt>Strategy</dt><dd>{f.strategy?.name ?? <span className="j-dim">Unassigned</span>}</dd>
      <dt>Session</dt><dd>{sessionLabel(trade.session)}</dd>
      <dt>Confluence</dt><dd className="j-num">{f.checklist.score != null ? `${f.checklist.score}%` : '—'}</dd>
      <dt>Emotion</dt><dd>{cap(trade.emotions)}</dd>
    </dl>
  );
}

function Checklist({ f }: { f: Facts }) {
  const c = f.checklist;
  if (!c.rows.length) return <p className="j-meta">No checklist was recorded for this trade.</p>;
  return (
    <ul className="jti-check" aria-label="Confluence checklist">
      {c.rows.map(({ item, present }) => (
        <li key={item.id} className={present ? 'on' : 'off'}>
          {present ? <Check aria-label="Present" /> : <Minus aria-label="Missing" />}
          <span className="nm">{item.name}</span>
          <span className="j-num wt">{item.weight ?? 1} pt{(item.weight ?? 1) === 1 ? '' : 's'}</span>
        </li>
      ))}
    </ul>
  );
}

function Mistakes({ f }: { f: Facts }) {
  if (!f.mistakes.length) return <p className="j-meta">No mistakes tagged on this trade.</p>;
  return (
    <ul className="jti-mist">
      {f.mistakes.map((m) => (
        <li key={m.id}>
          <div className="top">
            <span className="tg">{m.mistake_tag}</span>
            {m.severity && <Pill kind={m.severity === 'high' ? 'neg' : m.severity === 'medium' ? 'warn' : undefined}>{cap(m.severity)}</Pill>}
          </div>
          {m.description && <p className="j-meta">{m.description}</p>}
        </li>
      ))}
    </ul>
  );
}

function Notes({ trade }: { trade: Trade }) {
  return trade.notes?.trim()
    ? <p className="jti-notes">{trade.notes}</p>
    : <p className="j-meta">No notes on this trade.</p>;
}

function Shots({ trade }: { trade: Trade }) {
  const [open, setOpen] = useState<number | null>(null);
  const shots = trade.screenshots ?? [];
  if (!shots.length) return <p className="j-meta">No screenshots attached.</p>;
  return (
    <>
      <div className="jti-shots">
        {shots.map((src, i) => (
          <button key={src + i} onClick={() => setOpen(i)} aria-label={`Open screenshot ${i + 1} of ${shots.length}`}>
            <img src={src} alt={`${trade.symbol} chart ${i + 1}`} loading="lazy" />
          </button>
        ))}
      </div>
      <Dialog open={open != null} onClose={() => setOpen(null)} wide title={open != null ? `${trade.symbol} chart ${open + 1} of ${shots.length}` : ''}>
        {open != null && <img className="jti-lightbox" src={shots[open]} alt={`${trade.symbol} chart ${open + 1}`} />}
      </Dialog>
    </>
  );
}

/** Confirm, delete, go back to the list. In demo mode the trade is only removed from memory. */
export function DeleteTradeDialog({ trade, open, onClose }: { trade: Trade; open: boolean; onClose: () => void }) {
  const { deleteTrade, isDemo } = useJournal();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const name = `${trade.symbol} ${sideWord(trade)} on ${isoDate(trade.entry_date)} at ${timeHM(trade.entry_date)}`;
  const go = async () => {
    setBusy(true); setErr(null);
    try { await deleteTrade(trade.id); onClose(); nav('/trades'); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <ConfirmDialog open={open} onClose={onClose} onConfirm={busy ? () => undefined : go} title="Delete this trade?" confirmLabel={busy ? 'Deleting…' : 'Delete trade'}
      body={<>
        {name} will be removed with its checklist and mistake tags. This cannot be undone.
        {isDemo && <> Sample data: it comes back when you reload.</>}
        {err && <span className="jti-err" role="alert">Couldn't delete: {err}</span>}
      </>} />
  );
}

export default function TradeInspector({ trade, variant }: { trade: Trade; variant: 'pane' | 'page' }) {
  const nav = useNavigate();
  const f = useTradeFacts(trade);
  const [del, setDel] = useState(false);
  const c = f.checklist;
  const checkMeta = c.rows.length ? `${c.present} of ${c.total} · ${c.score ?? 0}%` : undefined;

  if (variant === 'page') {
    return (
      <>
        <div className="j-grid top jti-page">
          <div className="j-span-7 jti-col">
            <Panel title="Exit against the plan" meta={f.r != null ? `Result ${rMult(f.r)}` : undefined}><RLadder trade={trade} /></Panel>
            <Panel title="Execution"><Execution trade={trade} f={f} /></Panel>
            <Panel title="Notes"><Notes trade={trade} /></Panel>
            <Panel title="Screenshots" meta={trade.screenshots?.length ? `${trade.screenshots.length}` : undefined}><Shots trade={trade} /></Panel>
          </div>
          <div className="j-span-5 jti-col">
            <Panel title="Checklist" meta={checkMeta}><Checklist f={f} /></Panel>
            <Panel title="Setup"><Setup trade={trade} f={f} /></Panel>
            <Panel title="Mistakes" meta={f.mistakes.length ? `${f.mistakes.length} tagged` : undefined}><Mistakes f={f} /></Panel>
          </div>
        </div>
      </>
    );
  }

  return (
    <aside className="j-panel j-inspect jti-pane" aria-label={`${trade.symbol} ${sideWord(trade)} trade`}>
      <header className="jti-head">
        <div className="who">
          <span className={`j-side ${trade.trade_type}`}>{trade.trade_type === 'long' ? 'L' : 'S'}</span>
          <b>{trade.symbol} {sideWord(trade)}</b>
          <Pill kind={resultKind(f.result)}>{resultLabel(f.result)}</Pill>
        </div>
        <button className="j-link" onClick={() => nav(`/trades/${trade.id}`)}>Open <ArrowUpRight /></button>
      </header>
      <p className="jti-when j-meta">{whenLabel(trade.entry_date)} · {f.account?.name ?? 'Unknown account'}</p>
      <div className="jti-result">
        <span className="pnl"><PnL v={trade.status === 'open' ? null : trade.pnl} currency={f.currency} /></span>
        <span className="r">{f.r != null ? <Signed v={f.r} digits={2} suffix="R" /> : <span className="j-dim">{trade.status === 'open' ? 'In the market' : 'No R'}</span>}</span>
      </div>
      <div className="jti-actions">
        <button className="j-btn sm" onClick={() => nav(`/trades/edit/${trade.id}`)}><Pencil /> Edit</button>
        <button className="j-btn sm danger" onClick={() => setDel(true)}><Trash2 /> Delete</button>
      </div>

      <Block variant="pane" title="Exit against the plan"><RLadder trade={trade} /></Block>
      <Block variant="pane" title="Execution"><Execution trade={trade} f={f} /></Block>
      <Block variant="pane" title="Setup"><Setup trade={trade} f={f} /></Block>
      <Block variant="pane" title="Checklist" meta={checkMeta}><Checklist f={f} /></Block>
      <Block variant="pane" title="Mistakes" meta={f.mistakes.length ? `${f.mistakes.length} tagged` : undefined}><Mistakes f={f} /></Block>
      <Block variant="pane" title="Notes"><Notes trade={trade} /></Block>
      <Block variant="pane" title="Screenshots" meta={trade.screenshots?.length ? `${trade.screenshots.length}` : undefined}><Shots trade={trade} /></Block>
      <DeleteTradeDialog trade={trade} open={del} onClose={() => setDel(false)} />
    </aside>
  );
}

/** What the pane shows while nothing is selected. */
export function InspectorEmpty() {
  return <aside className="j-panel j-inspect jti-pane" aria-label="Trade details"><Empty>Select a trade to see its checklist, mistakes and notes.</Empty></aside>;
}
