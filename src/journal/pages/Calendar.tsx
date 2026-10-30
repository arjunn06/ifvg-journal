// Calendar. The question: "Which days made and lost the month, and what happened on them?"
// The month grid is the biggest block; the selected day's trades sit beside it.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useJournal } from '../JournalProvider';
import { byStrategy, dailyMap, dayKey, monthGrid, summarize, rOf, type Day } from '../analytics';
import { compact, int, isoDate, money, monthLabel, pct, signed, timeHM } from '../format';
import { sessionLabel } from '../types';
import { Empty, ErrorBlock, Kpis, PageHeader, Panel, PnL, RankList, Signed } from '../ui/kit';

const HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Calendar() {
  const nav = useNavigate();
  const { scopeTrades, scopeAccounts, strategies, loading, error, refresh } = useJournal();
  const now = new Date();
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [picked, setPicked] = useState<string | null>(dayKey(now));
  const currency = scopeAccounts[0]?.currency ?? 'USD';

  const daily = useMemo(() => dailyMap(scopeTrades), [scopeTrades]);
  const weeks = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth(), daily), [cursor, daily]);
  const monthDays = useMemo(
    () => [...daily.values()].filter((d) => d.date.startsWith(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)),
    [daily, cursor],
  );
  const monthTrades = useMemo(() => monthDays.flatMap((d) => d.trades), [monthDays]);
  const s = useMemo(() => summarize(monthTrades), [monthTrades]);
  const maxAbs = Math.max(1, ...monthDays.map((d) => Math.abs(d.pnl)));
  const greenDays = monthDays.filter((d) => d.pnl > 0).length;
  const best = [...monthDays].sort((a, b) => b.pnl - a.pnl)[0];
  const worst = [...monthDays].sort((a, b) => a.pnl - b.pnl)[0];
  const bySetup = useMemo(() => byStrategy(monthTrades, strategies).sort((a, b) => b.net - a.net), [monthTrades, strategies]);
  const setupMax = Math.max(1, ...bySetup.map((r) => Math.abs(r.net)));
  const pickedDay: Day | null = picked ? daily.get(picked) ?? null : null;
  const todayKey = dayKey(now);
  const stratName = (id: string | null) => strategies.find((x) => x.id === id)?.name ?? 'No setup';
  const step = (n: number) => { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1)); setPicked(null); };
  // Weekends only get columns when something was traded on one (futures sessions close on Saturday).
  const weekend = useMemo(() => [...daily.keys()].some((k) => { const g = new Date(k.replace(/-/g, '/')).getDay(); return g === 0 || g === 6; }), [daily]);
  const atCurrent = cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth();

  const sub = monthDays.length
    ? `${monthDays.length} trading days: ${greenDays} green, ${monthDays.length - greenDays} red${best ? `. Best day ${money(best.pnl, currency, { sign: true, decimals: 0 })} on ${best.date.slice(8)}` : ''}.`
    : 'No closed trades in this month.';

  return (
    <>
      <PageHeader
        title="Calendar"
        sub={sub}
        actions={
          <>
            <button className="j-icon-btn" onClick={() => step(-1)} aria-label="Previous month"><ChevronLeft /></button>
            <span style={{ minWidth: 132, textAlign: 'center', fontWeight: 500 }}>{monthLabel(cursor)}</span>
            <button className="j-icon-btn" onClick={() => step(1)} aria-label="Next month" disabled={atCurrent} style={atCurrent ? { opacity: 0.35 } : undefined}><ChevronRight /></button>
            <button className="j-btn" onClick={() => { setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); setPicked(todayKey); }} disabled={atCurrent && picked === todayKey}>Today</button>
          </>
        }
      />
      {error && <ErrorBlock message={`Couldn't load your journal: ${error}`} onRetry={refresh} />}

      <Kpis items={[
        { label: `Net result, ${cursor.toLocaleString('en-US', { month: 'long' })}`, lead: true, tone: s.net < 0 ? 'neg' : 'flat', value: monthDays.length ? money(s.net, currency, { sign: true }) : money(0, currency), note: `${int(s.count)} closed trades` },
        { label: 'Green days', value: monthDays.length ? `${greenDays} of ${monthDays.length}` : '—', note: monthDays.length ? pct((greenDays / monthDays.length) * 100, 0) : undefined },
        { label: 'Win rate', value: pct(s.winRate), note: `${s.wins} won · ${s.losses} lost` },
        { label: 'Best day', value: best ? money(best.pnl, currency, { sign: true, decimals: 0 }) : '—', note: best ? best.date : undefined },
        { label: 'Worst day', value: worst && worst.pnl < 0 ? money(worst.pnl, currency, { decimals: 0 }) : '—', note: worst && worst.pnl < 0 ? worst.date : undefined },
        { label: 'Avg R', value: s.avgR == null ? '—' : signed(s.avgR, 2, 'R'), note: 'per closed trade' },
      ]} />

      <div className="j-grid top">
        <Panel className="j-span-8" title={monthLabel(cursor)} meta="Result per day · week total on the right">
          {loading ? (
            <div className="j-cal">{Array.from({ length: 35 }).map((_, i) => <div key={i} className="j-day" />)}</div>
          ) : (
            <div className="j-cal" role="grid" aria-label={`Trading calendar for ${monthLabel(cursor)}`} style={{ ['--days' as string]: weekend ? 7 : 5 }}>
              {HEAD.slice(0, weekend ? 7 : 5).map((h) => <div key={h} className="j-cal-h" role="columnheader">{h}</div>)}
              <div className="j-cal-h wk" role="columnheader">Week</div>
              {weeks.map((w) => (
                <div key={w.cells[0].key} style={{ display: 'contents' }} role="row">
                  {w.cells.slice(0, weekend ? 7 : 5).map((c) => {
                    const d = c.day;
                    const k = d ? Math.min(1, Math.abs(d.pnl) / maxAbs) : 0;
                    const cls = ['j-day', !c.inMonth ? 'out' : '', d && c.inMonth ? (d.pnl > 0 ? 'win has' : d.pnl < 0 ? 'loss has' : 'has') : '', c.key === todayKey ? 'today' : ''].join(' ');
                    const inner = (
                      <>
                        <span className="d">{c.date.getDate()}</span>
                        {d && c.inMonth ? (
                          <span>
                            <span className="v full" style={{ display: 'block' }}>{signed(d.pnl, 0)}</span>
                            <span className="v short">{compact(d.pnl)}</span>
                            <span className="c">{d.count} trade{d.count === 1 ? '' : 's'}</span>
                          </span>
                        ) : <span />}
                      </>
                    );
                    return d && c.inMonth ? (
                      <button key={c.key} role="gridcell" className={cls} style={{ ['--k' as string]: 0.35 + k * 0.65 }} aria-pressed={picked === c.key}
                        aria-label={`${c.key}: ${signed(d.pnl, 0)} over ${d.count} trades`} onClick={() => setPicked(picked === c.key ? null : c.key)}>{inner}</button>
                    ) : (
                      <div key={c.key} role="gridcell" className={cls}>{inner}</div>
                    );
                  })}
                  <div className="j-week" role="gridcell">
                    {w.count ? (<><b className={w.pnl < 0 ? 'j-neg' : ''}>{signed(w.pnl, 0)}</b><span>{w.count} trade{w.count === 1 ? '' : 's'}</span></>) : <span>—</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="j-span-4" style={{ display: 'grid', gap: 'var(--gap)', minWidth: 0 }}>
        <Panel title={pickedDay ? isoDate(pickedDay.date.replace(/-/g, '/')) : 'Pick a day'} meta={pickedDay ? `${pickedDay.count} trades · ${pickedDay.wins} won` : undefined}
          action={pickedDay ? <PnL v={pickedDay.pnl} currency={currency} /> : undefined}>
          {pickedDay ? (
            <div className="j-rows">
              {[...pickedDay.trades].sort((a, b) => +new Date(a.entry_date) - +new Date(b.entry_date)).map((t) => (
                <button key={t.id} className="j-row" style={{ background: 'none', border: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => nav(`/trades/${t.id}`)}>
                  <span className={`j-side ${t.trade_type}`}>{t.trade_type === 'long' ? 'L' : 'S'}</span>
                  <span className="grow">
                    <span className="t">{t.symbol}</span>
                    <span className="s" style={{ display: 'block' }}><span className="j-mono">{timeHM(t.entry_date)}</span> · {sessionLabel(t.session)} · {stratName(t.strategy_id)}</span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <PnL v={t.pnl} currency={currency} />
                    <span className="s j-num" style={{ display: 'block' }}><Signed v={rOf(t)} digits={2} suffix="R" /></span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Empty>{monthDays.length ? 'Select a coloured day to see its trades.' : 'Nothing was traded this month.'}</Empty>
          )}
        </Panel>
        <Panel title="Month by setup" meta={`${monthTrades.length} trades`}>
          <RankList rows={bySetup.map((r) => ({ key: r.key, label: r.label, share: Math.abs(r.net) / setupMax, sub: `${r.count} · ${r.winRate != null ? Math.round(r.winRate) + '%' : '—'}`, value: <PnL v={r.net} currency={currency} decimals={0} /> }))} />
        </Panel>
        </div>
      </div>
    </>
  );
}
