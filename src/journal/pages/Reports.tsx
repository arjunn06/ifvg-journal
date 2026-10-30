// Reports. The question this screen answers: "Where is my edge, and where do I leak it?"
// Four views of the same closed trades: edge (who earns), behaviour (what the leaks cost), distribution (shape of results), periods (week and month by week and month).

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import { useJournal } from '../JournalProvider';
import { useQuickLog } from '../quicklog/QuickLog';
import { PERIODS, isClosed, summarize, topFinding } from '../analytics';
import { isoDate, money } from '../format';
import { Empty, ErrorBlock, PageHeader, Panel, Range, Skel, Tabs } from '../ui/kit';
import { Behaviour } from './reports/Behaviour';
import { Distribution } from './reports/Distribution';
import { Edge } from './reports/Edge';
import { Periods } from './reports/Periods';
import { buildPeriods, download, tradesCsv, type Span } from './reports/stats';
import './Reports.css';

type Tab = 'edge' | 'behaviour' | 'distribution' | 'periods';
const TABS: { key: Tab; label: string }[] = [
  { key: 'edge', label: 'Edge' }, { key: 'behaviour', label: 'Behaviour' }, { key: 'distribution', label: 'Distribution' }, { key: 'periods', label: 'Periods' },
];

function Loading({ tab }: { tab: Tab }) {
  return (
    <>
      <PageHeader title="Reports" sub={<Skel w={360} />} />
      <div className="j-tabs" role="tablist" aria-label="Report view">{TABS.map((t) => <span key={t.key} className="j-tab" aria-selected={t.key === tab}>{t.label}</span>)}</div>
      {tab !== 'periods' && (
        <div className="j-kpis" style={{ '--cols': 'minmax(0,1.5fr) repeat(5, minmax(0,1fr))' } as React.CSSProperties}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className={`j-kpi ${i ? '' : 'lead'}`}><Skel w={70} h={12} /><div style={{ marginTop: 10 }}><Skel w={i ? 80 : 150} h={i ? 22 : 30} /></div></div>)}
        </div>
      )}
      <div className="j-grid"><div className="j-panel j-span-12" style={{ height: tab === 'periods' ? 560 : 360 }} /></div>
    </>
  );
}

export default function Reports() {
  const nav = useNavigate();
  const { open: openLog } = useQuickLog();
  const [sp, setSp] = useSearchParams();
  const J = useJournal();
  const { viewTrades, scopeTrades, scopeAccounts, accounts, strategies, mistakes, confluenceItems, tradeConfluence, period, setPeriod, startBalance, loading, error, refresh, scope } = J;
  const currency = scopeAccounts[0]?.currency ?? 'USD';
  const raw = sp.get('tab');
  const tab: Tab = TABS.some((t) => t.key === raw) ? (raw as Tab) : 'edge';
  const setTab = (t: Tab) => setSp((p) => { const n = new URLSearchParams(p); n.set('tab', t); return n; }, { replace: true });
  const [span, setSpan] = useState<Span>('weeks');

  const s = useMemo(() => summarize(viewTrades), [viewTrades]);
  const finding = useMemo(() => topFinding(viewTrades, strategies, mistakes, currency), [viewTrades, strategies, mistakes, currency]);
  const periods = useMemo(() => buildPeriods(scopeTrades, mistakes, span), [scopeTrades, mistakes, span]);

  if (loading) return <Loading tab={tab} />;
  const periodLabel = PERIODS.find((p) => p.key === period)!.label;
  const scopeLabel = scope === 'all' ? `${scopeAccounts.length} accounts` : scopeAccounts[0]?.name;
  const isPeriods = tab === 'periods';
  const any = J.trades.some(isClosed);

  // The one sentence of the current view.
  let sub: React.ReactNode;
  if (isPeriods) {
    const w = periods.filter((r) => r.s.count);
    const best = w.length ? w.reduce((a, b) => (b.s.net > a.s.net ? b : a)) : null;
    const worst = w.length ? w.reduce((a, b) => (b.s.net < a.s.net ? b : a)) : null;
    const nn = span === 'weeks' ? 'week' : 'month';
    sub = best && worst
      ? <><b>{w.filter((r) => r.s.net > 0).length} of {w.length} {nn}s with trades closed in profit; best {nn} {money(best.s.net, currency, { sign: true, decimals: 0 })}, worst {money(worst.s.net, currency, { sign: true, decimals: 0 })}.</b> <span className="j-dim">· {scopeLabel} · last 12 {nn}s</span></>
      : `No closed trades in the last 12 ${nn}s · ${scopeLabel}`;
  } else if (finding) {
    sub = <><b>{finding.text}</b> <span className="j-dim">· {scopeLabel} · {periodLabel}</span></>;
  } else {
    sub = s.count ? `${s.count} closed trades, ${money(s.net, currency, { sign: true })} net · ${scopeLabel} · ${periodLabel}` : `${scopeLabel ?? 'No accounts yet'} · ${periodLabel}`;
  }

  const exportCsv = () => {
    const rows = isPeriods ? periods.flatMap((r) => r.trades) : viewTrades;
    download(`ifvg-${tab}-${isPeriods ? `12-${span}` : period}-${isoDate(new Date())}.csv`, tradesCsv(rows, accounts, strategies, mistakes));
  };

  const header = (
    <PageHeader title="Reports" sub={sub}
      actions={<>
        {!isPeriods && <Range value={period} onChange={setPeriod} />}
        <button className="j-btn ghost" onClick={exportCsv} disabled={!(isPeriods ? periods.some((r) => r.trades.length) : viewTrades.length)}><Download /> Export CSV</button>
      </>} />
  );
  const tabs = <Tabs<Tab> label="Report view" value={tab} onChange={setTab} items={TABS} />;

  if (!J.trades.length || !any) {
    return (
      <>
        {header}{tabs}
        {error && <ErrorBlock message={`Couldn't load your journal: ${error}`} onRetry={refresh} />}
        <Panel title="Nothing to report yet">
          <p style={{ color: 'var(--text-2)', maxWidth: '56ch', marginBottom: 16 }}>Reports are built from closed trades. Log one with its setup, checklist and mistakes and the edge, behaviour and distribution views fill in.</p>
          <div className="j-actions"><button className="j-btn primary" onClick={openLog}><Plus /> Log a trade</button></div>
        </Panel>
      </>
    );
  }

  const empty = !s.count && !isPeriods;
  return (
    <>
      {header}{tabs}
      {error && <ErrorBlock message={`Couldn't load your journal: ${error}`} onRetry={refresh} />}
      {empty ? (
        <Panel title="No closed trades in this period" meta={`${scopeLabel} · ${periodLabel}`}>
          <Empty>No trade closed in this period. Pick a longer one above to see the {tab} view.</Empty>
        </Panel>
      ) : tab === 'edge' ? (
        <Edge trades={viewTrades} s={s} currency={currency} strategies={strategies} periodLabel={periodLabel} />
      ) : tab === 'behaviour' ? (
        <Behaviour trades={viewTrades} s={s} currency={currency} mistakes={mistakes} items={confluenceItems} links={tradeConfluence} periodLabel={periodLabel} />
      ) : tab === 'distribution' ? (
        <Distribution trades={viewTrades} s={s} currency={currency} startBalance={startBalance} periodLabel={periodLabel} />
      ) : (
        <Periods rows={periods} span={span} setSpan={setSpan} currency={currency} strategies={strategies} mistakes={mistakes} />
      )}
    </>
  );
}
