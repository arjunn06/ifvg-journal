// Journal. The question this screen answers: "What did I trade, and which of those trades should I look at again?"
// Biggest block: the table. Beside it (wide screens) the selected trade, so a review never leaves the list.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, Search, Upload } from 'lucide-react';
import { useJournal } from '../JournalProvider';
import { useQuickLog } from '../quicklog/QuickLog';
import { PERIODS, rOf, type Period } from '../analytics';
import { SESSIONS, sessionLabel, type Trade } from '../types';
import { int, isoDate, price, shortDate, timeHM, qty } from '../format';
import { Empty, ErrorBlock, PageHeader, Panel, Pill, PnL, Range, Signed, Skel } from '../ui/kit';
import TradeInspector, { InspectorEmpty } from '../ui/TradeInspector';
import ImportTradesDialog from './ImportTradesDialog';
import { RESULTS, byEntryDesc, mistakesFor, resultOf, type Result } from '../ui/tradeInfo';
import './journal-list.css';

const PAGE = 50;
type SortKey = 'when' | 'r' | 'pnl';
type Sort = { key: SortKey; dir: 'asc' | 'desc' };

const WINDOW_PHRASE: Record<Period, string> = {
  today: 'today', '7d': 'in the last 7 days', '30d': 'in the last 30 days', '90d': 'in the last 90 days', ytd: 'this year', all: 'across all time',
};

function useMedia(query: string) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

const plural = (n: number, w: string) => `${int(n)} ${w}${n === 1 ? '' : 's'}`;

function Loading() {
  return (
    <>
      <PageHeader title="Journal" sub={<Skel w={300} />} />
      <div className="j-filters">{[220, 90, 80, 110, 130].map((w, i) => <Skel key={i} w={w} h={30} />)}</div>
      <Panel>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="jl-skel-row"><Skel w={86} h={28} /><Skel w={90} /><Skel w={120} /><span className="grow" /><Skel w={70} /></div>
        ))}
      </Panel>
    </>
  );
}

export default function Journal() {
  const nav = useNavigate();
  const { open: openLog } = useQuickLog();
  const J = useJournal();
  const { viewTrades, strategies, mistakes, period, setPeriod, loading, error, refresh, scopeAccounts } = J;
  const split = useMedia('(min-width: 1180px)');

  const [q, setQ] = useState('');
  const [result, setResult] = useState<Result | ''>('');
  const [side, setSide] = useState<'' | 'long' | 'short'>('');
  const [session, setSession] = useState('');
  const [setup, setSetup] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [sort, setSort] = useState<Sort>({ key: 'when', dir: 'desc' });
  const [limit, setLimit] = useState(PAGE);
  const [picked, setPicked] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  const currency = scopeAccounts[0]?.currency ?? 'USD';
  const stratName = (id: string | null) => strategies.find((s) => s.id === id)?.name ?? '—';
  const mistakeCount = useMemo(() => {
    const m = new Map<string, number>();
    mistakes.forEach((x) => m.set(x.trade_id, (m.get(x.trade_id) ?? 0) + 1));
    return m;
  }, [mistakes]);

  const filtersOn = !!(q.trim() || result || side || session || setup || flagged);
  const clear = () => { setQ(''); setResult(''); setSide(''); setSession(''); setSetup(''); setFlagged(false); };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = viewTrades.filter((t) =>
      (!needle || t.symbol.toLowerCase().includes(needle) || (t.notes ?? '').toLowerCase().includes(needle)) &&
      (!result || resultOf(t) === result) &&
      (!side || t.trade_type === side) &&
      (!session || t.session === session) &&
      (!setup || t.strategy_id === setup) &&
      (!flagged || mistakeCount.has(t.id)));
    const val = (t: Trade): number | null => (sort.key === 'when' ? +new Date(t.entry_date) : sort.key === 'r' ? rOf(t) : t.pnl);
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null && y == null) return byEntryDesc(a, b);
      if (x == null) return 1;
      if (y == null) return -1;
      return (x - y) * sign || byEntryDesc(a, b);
    });
  }, [viewTrades, q, result, side, session, setup, flagged, mistakeCount, sort]);

  // Back to the first page whenever the question changes.
  useEffect(() => { setLimit(PAGE); }, [q, result, side, session, setup, flagged, sort, period]);

  const shown = rows.slice(0, limit);
  const newest = useMemo(() => [...rows].sort(byEntryDesc)[0] ?? null, [rows]);
  const selected = rows.find((t) => t.id === picked) ?? newest;

  const closed = rows.filter((t) => t.status === 'closed');
  const open = rows.filter((t) => t.status === 'open').length;
  const won = rows.filter((t) => resultOf(t) === 'won').length;

  if (loading) return <Loading />;

  if (!J.trades.length) {
    return (
      <>
        <PageHeader title="Journal" sub="Every trade you log lands here, newest first." actions={<button className="j-btn" onClick={() => setImportOpen(true)}><Upload /> Import CSV</button>} />
        <Panel title="No trades yet">
          <p style={{ color: 'var(--text-2)', maxWidth: '56ch', marginBottom: 16 }}>
            Log a trade right after you close it: the setup, the checklist you ticked, what you felt. This list, the calendar and the reports are built from those rows.
          </p>
          <div className="j-actions"><button className="j-btn primary" onClick={openLog}><Plus /> Log your first trade</button><button className="j-btn" onClick={() => setImportOpen(true)}><Upload /> Import CSV</button></div>
        </Panel>
        {importOpen && <ImportTradesDialog accounts={J.accounts.filter((a) => a.is_active)} selectedAccountId={J.scope === 'all' ? null : J.scope} onClose={() => setImportOpen(false)} onImport={J.importTrades} />}
      </>
    );
  }

  const sub = !rows.length
    ? (filtersOn ? 'No trades match these filters.' : `No trades ${WINDOW_PHRASE[period]}.`)
    : `${plural(closed.length, 'closed trade')} ${filtersOn ? 'match' : WINDOW_PHRASE[period]}, ${open} open. ${won} won.`;

  const openTrade = (t: Trade) => nav(`/trades/${t.id}`);
  const onRow = (t: Trade) => (split ? setPicked(t.id) : openTrade(t));

  const move = (e: React.KeyboardEvent, from: number) => {
    const to = e.key === 'ArrowDown' ? from + 1 : e.key === 'ArrowUp' ? from - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? shown.length - 1 : null;
    if (to == null) return;
    e.preventDefault();
    const next = shown[Math.max(0, Math.min(shown.length - 1, to))];
    if (!next) return;
    setPicked(next.id);
    requestAnimationFrame(() => bodyRef.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus());
  };

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
  const th = (k: SortKey, label: string, n?: boolean) => {
    const on = sort.key === k;
    const Glyph = sort.dir === 'desc' ? ArrowDown : ArrowUp;
    return (
      <th key={k} className={`j-sort ${n ? 'n' : ''}`} aria-sort={on ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
        <button onClick={() => toggleSort(k)} title={`Sort by ${label}`}>
          {n && on && <Glyph aria-hidden="true" />}{label}{!n && on && <Glyph aria-hidden="true" />}
        </button>
      </th>
    );
  };

  const noRows = !rows.length;
  const emptyMsg = filtersOn ? 'No trades match these filters.' : `No trades ${WINDOW_PHRASE[period]}.`;
  const emptyAction = filtersOn
    ? <button className="j-link" onClick={clear}>Clear filters</button>
    : period !== 'all' ? <button className="j-link" onClick={() => setPeriod('all')}>Show all time</button> : null;

  const table = (
    <Panel className="jl-panel">
      <div className="j-table-wrap jl-wrap j-table-m">
        <table className="jl-table">
          <thead>
            <tr>
              {th('when', 'When')}
              <th className="id">Instrument</th>
              <th>Setup</th>
              <th className="c-sess">Session</th>
              <th className="n c-size">Size</th>
              <th className="c-xy">Entry → Exit</th>
              {th('r', 'R', true)}
              <th className="n c-conf">Confluence</th>
              <th className="n c-mist">Mistakes</th>
              {th('pnl', 'P&L', true)}
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {shown.map((t, i) => {
              const sel = split && selected?.id === t.id;
              const n = mistakeCount.get(t.id) ?? 0;
              const score = t.confluence_score;
              return (
                <tr key={t.id} data-id={t.id} className="j-click" aria-selected={sel} tabIndex={sel || (!selected && i === 0) ? 0 : -1}
                  onClick={() => onRow(t)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); openTrade(t); } else move(e, i); }}>
                  <td className="two"><span className="j-mono">{isoDate(t.entry_date)}</span><span className="j-sub">{timeHM(t.entry_date)}</span></td>
                  <td className="id"><span className={`j-side ${t.trade_type}`} title={t.trade_type}>{t.trade_type === 'long' ? 'L' : 'S'}</span>{t.symbol}</td>
                  <td className="two"><span className="jl-setup">{stratName(t.strategy_id)}</span><span className="j-sub jl-sess-sub">{sessionLabel(t.session)}</span></td>
                  <td className="mut c-sess">{sessionLabel(t.session)}</td>
                  <td className="n j-num c-size">{qty(t.quantity)}</td>
                  <td className="two c-xy"><span className="j-mono">{price(t.entry_price)}</span><span className="j-sub j-mono">→ {t.status === 'open' ? 'open' : price(t.exit_price)}</span></td>
                  <td className="n">{t.status === 'open' ? <Pill kind="warn">Open</Pill> : <Signed v={rOf(t)} digits={2} suffix="R" />}</td>
                  <td className="n c-conf">
                    {score != null ? <span className="jl-conf"><span className="j-num">{Math.round(score)}%</span><i><b style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></i></span> : <span className="j-dim">—</span>}
                  </td>
                  <td className="n j-num c-mist" title={n ? mistakesFor(t, mistakes).map((m) => m.mistake_tag).join(', ') : undefined}>{n || <span className="j-dim">—</span>}</td>
                  <td className="n"><PnL v={t.status === 'open' ? null : t.pnl} currency={currency} /></td>
                </tr>
              );
            })}
            {noRows && (
              <tr className="jl-none"><td colSpan={10}>
                <div className="jl-empty"><Empty>{emptyMsg}</Empty>{emptyAction}</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="j-list-m" role="list" aria-label="Trades">
        {shown.map((t) => {
          const r = rOf(t);
          return (
            <button key={t.id} role="listitem" className="jl-item" onClick={() => openTrade(t)}>
              <span className="l1">
                <span className="id"><span className={`j-side ${t.trade_type}`}>{t.trade_type === 'long' ? 'L' : 'S'}</span><b>{t.symbol}</b><span className="j-meta j-num">{shortDate(t.entry_date)} {timeHM(t.entry_date)}</span></span>
                {t.status === 'open' ? <Pill kind="warn">Open</Pill> : <PnL v={t.pnl} currency={currency} />}
              </span>
              <span className="l2">
                <span className="j-trunc">{stratName(t.strategy_id)} · {sessionLabel(t.session)}</span>
                {t.status === 'open' ? <span className="j-dim">in market</span> : <Signed v={r} digits={2} suffix="R" />}
              </span>
            </button>
          );
        })}
        {noRows && <div className="jl-empty"><Empty>{emptyMsg}</Empty>{emptyAction}</div>}
      </div>

      {!noRows && (
        <div className="jl-foot">
          <span className="j-meta j-num">1–{shown.length} of {rows.length}</span>
          {rows.length > shown.length && (
            <button className="j-link" onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, rows.length - shown.length)} more</button>
          )}
        </div>
      )}
    </Panel>
  );

  return (
    <>
      <PageHeader title="Journal" sub={sub} actions={<button className="j-btn" onClick={() => setImportOpen(true)}><Upload /> Import CSV</button>} />
      {error && <ErrorBlock message={`Couldn't load your journal: ${error}`} onRetry={refresh} />}

      <div className="j-filters" role="search">
        <label className="jl-search">
          <Search aria-hidden="true" />
          <input className="j-input sm" type="search" placeholder="Search symbol or notes" aria-label="Search symbol or notes" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="jl-chips">
        <select className="j-select sm" aria-label="Result" value={result} onChange={(e) => setResult(e.target.value as Result | '')}>
          <option value="">All results</option>
          {RESULTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <select className="j-select sm" aria-label="Side" value={side} onChange={(e) => setSide(e.target.value as '' | 'long' | 'short')}>
          <option value="">Long and short</option><option value="long">Long</option><option value="short">Short</option>
        </select>
        <select className="j-select sm" aria-label="Session" value={session} onChange={(e) => setSession(e.target.value)}>
          <option value="">All sessions</option>
          {SESSIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select className="j-select sm" aria-label="Setup" value={setup} onChange={(e) => setSetup(e.target.value)}>
          <option value="">All setups</option>
          {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="jl-toggle" aria-pressed={flagged} onClick={() => setFlagged((v) => !v)}>Tagged with a mistake</button>
        {filtersOn && <button className="j-link jl-clear" onClick={clear}>Clear filters</button>}
        </div>
        <span className="j-spacer" />
        <Range value={period} onChange={setPeriod} options={PERIODS} />
      </div>

      {split ? (
        <div className="j-split">
          {table}
          {selected ? <TradeInspector key={selected.id} trade={selected} variant="pane" /> : <InspectorEmpty />}
        </div>
      ) : table}
      {importOpen && <ImportTradesDialog accounts={J.accounts.filter((a) => a.is_active)} selectedAccountId={J.scope === 'all' ? null : J.scope} onClose={() => setImportOpen(false)} onImport={J.importTrades} />}
    </>
  );
}
