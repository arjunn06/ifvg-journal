// Strategies tab: the setups the trader takes. A list on the left, the selected setup's rulebook
// and its live record from the journal on the right. One pane at a time on a phone.

import { useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useJournal } from '../../JournalProvider';
import { bySession, equityCurve, summarize } from '../../analytics';
import { dec2, int, money, pct, rMult, signed } from '../../format';
import { ConfirmDialog, Dialog, Empty, ErrorBlock, Kpis, Panel, PnL } from '../../ui/kit';
import { LineChart } from '../../ui/charts';
import { DemoNotice, Field, SwitchRow, errText, lines, numOrNull, plural, useMedia, useWriteGuard, type SetupRow } from './shared';

interface Draft {
  name: string; description: string; timeframe: string; market_conditions: string;
  entry_criteria: string; exit_criteria: string; partial_criteria: string; be_criteria: string; rules: string;
  risk_per_trade: string; min_risk_reward: string; max_risk_reward: string; is_active: boolean;
}
const blank: Draft = {
  name: '', description: '', timeframe: '', market_conditions: '', entry_criteria: '', exit_criteria: '', partial_criteria: '', be_criteria: '', rules: '',
  risk_per_trade: '', min_risk_reward: '', max_risk_reward: '', is_active: true,
};
const toDraft = (s: SetupRow): Draft => ({
  name: s.name, description: s.description ?? '', timeframe: s.timeframe ?? '', market_conditions: s.market_conditions ?? '',
  entry_criteria: s.entry_criteria ?? '', exit_criteria: s.exit_criteria ?? '', partial_criteria: s.partial_criteria ?? '', be_criteria: s.be_criteria ?? '',
  rules: s.rules ?? '', risk_per_trade: s.risk_per_trade != null ? String(s.risk_per_trade) : '', min_risk_reward: s.min_risk_reward != null ? String(s.min_risk_reward) : '',
  max_risk_reward: s.max_risk_reward != null ? String(s.max_risk_reward) : '', is_active: s.is_active,
});
const nz = (s: string) => s.trim() || null;
const nzLines = (s: string) => lines(s).join('\n') || null;

export const SMALL_SAMPLE = 10;

function Rule({ title, text }: { title: string; text?: string | null }) {
  const rows = lines(text);
  if (!rows.length) return null;
  return (
    <div className="pb-rule">
      <h3>{title}</h3>
      {rows.length === 1 ? <p>{rows[0]}</p> : <ul>{rows.map((r, i) => <li key={i}>{r}</li>)}</ul>}
    </div>
  );
}

function Param({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="pb-param"><span className="j-meta">{label}</span><span className="v j-num">{children}</span></div>;
}

export default function Setups({ selectedId, onSelect, newSignal }: { selectedId: string | null; onSelect: (id: string) => void; newSignal: number }) {
  const J = useJournal();
  const { strategies, scopeTrades, scopeAccounts } = J;
  const isPhone = useMedia('(max-width: 640px)');
  const { guard, blocked, clear, refresh } = useWriteGuard();
  const currency = scopeAccounts[0]?.currency ?? 'USD';

  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SetupRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState(false);

  useEffect(() => { if (newSignal > 0) { clear(); setError(null); setNameErr(false); setEditing({ id: null, draft: blank }); } }, [newSignal, clear]);

  const rows = useMemo(() => (strategies as SetupRow[])
    .map((s) => ({ s, ts: scopeTrades.filter((t) => t.strategy_id === s.id) }))
    .map((r) => ({ ...r, sum: summarize(r.ts) }))
    .sort((a, b) => Number(b.s.is_active) - Number(a.s.is_active) || b.sum.count - a.sum.count || a.s.name.localeCompare(b.s.name)), [strategies, scopeTrades]);

  const unassigned = useMemo(() => summarize(scopeTrades.filter((t) => !t.strategy_id || !strategies.some((s) => s.id === t.strategy_id))), [scopeTrades, strategies]);
  const current = rows.find((r) => r.s.id === selectedId) ?? rows[0];
  const detail = useMemo(() => {
    if (!current) return null;
    const curve = equityCurve(current.ts, 0);
    const sessions = bySession(current.ts).filter((r) => r.count >= 3).sort((a, b) => b.net - a.net);
    return { curve, best: sessions[0] ?? null };
  }, [current]);

  const open = (id: string) => { onSelect(id); setDetailOpen(true); };
  const startEdit = (s: SetupRow) => { clear(); setError(null); setNameErr(false); setEditing({ id: s.id, draft: toDraft(s) }); };

  const save = async () => {
    if (!editing) return;
    const d = editing.draft;
    if (!d.name.trim()) { setNameErr(true); return; }
    const uid = guard();
    if (!uid) return;
    setBusy(true); setError(null);
    const payload = {
      name: d.name.trim(), description: nz(d.description), rules: nzLines(d.rules), entry_criteria: nzLines(d.entry_criteria), exit_criteria: nzLines(d.exit_criteria),
      partial_criteria: nzLines(d.partial_criteria), be_criteria: nzLines(d.be_criteria), risk_per_trade: numOrNull(d.risk_per_trade),
      min_risk_reward: numOrNull(d.min_risk_reward), max_risk_reward: numOrNull(d.max_risk_reward), timeframe: nz(d.timeframe),
      market_conditions: nz(d.market_conditions), is_active: d.is_active, user_id: uid,
    };
    try {
      let id = editing.id;
      if (id) {
        const { error: e } = await supabase.from('strategies').update(payload).eq('id', id).eq('user_id', uid);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase.from('strategies').insert(payload).select('id').single();
        if (e) throw e;
        id = (data as { id: string }).id;
      }
      await refresh();
      if (id) onSelect(id);
      setEditing(null);
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  };

  const toggleArchive = async (s: SetupRow) => {
    const uid = guard();
    if (!uid) return;
    setError(null);
    const { error: e } = await supabase.from('strategies').update({ is_active: !s.is_active }).eq('id', s.id).eq('user_id', uid);
    if (e) setError(e.message); else await refresh();
  };

  const remove = async () => {
    const s = confirmDelete;
    if (!s) return;
    const uid = guard();
    if (!uid) { setConfirmDelete(null); return; }
    setBusy(true);
    try {
      // Trades keep existing; the foreign key sets their strategy to null. Doing it explicitly keeps that true if the constraint ever changes.
      const a = await supabase.from('trades').update({ strategy_id: null }).eq('strategy_id', s.id).eq('user_id', uid);
      if (a.error) throw a.error;
      const { error: e } = await supabase.from('strategies').delete().eq('id', s.id).eq('user_id', uid);
      if (e) throw e;
      await refresh();
      setDetailOpen(false);
    } catch (e) { setError(errText(e)); } finally { setBusy(false); setConfirmDelete(null); }
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setEditing((x) => (x ? { ...x, draft: { ...x.draft, [k]: v } } : x));

  const dialog = editing && (
    <Dialog wide open onClose={() => setEditing(null)} title={editing.id ? 'Edit setup' : 'New setup'}
      footer={<>{blocked && <DemoNotice compact onClose={clear} />}<button className="j-btn" onClick={() => setEditing(null)}>Cancel</button><button className="j-btn primary" disabled={busy} onClick={save}>{busy ? 'Saving' : editing.id ? 'Save changes' : 'Create setup'}</button></>}>
      <span className="pb-dlg" hidden />
      {error && <ErrorBlock message={error} />}
      <div className="pb-form-2">
        <Field label="Name">{(id) => (
          <>
            <input id={id} className="j-input" value={editing.draft.name} onChange={(e) => { setNameErr(false); set('name', e.target.value); }} placeholder="iFVG reversal" autoFocus aria-invalid={nameErr} />
            {nameErr && <span className="j-err">A setup needs a name.</span>}
          </>
        )}</Field>
        <Field label="Timeframe">{(id) => <input id={id} className="j-input" value={editing.draft.timeframe} onChange={(e) => set('timeframe', e.target.value)} placeholder="1m / 5m" />}</Field>
      </div>
      <Field label="Description">{(id) => <textarea id={id} className="j-textarea" rows={2} value={editing.draft.description} onChange={(e) => set('description', e.target.value)} placeholder="What the setup is, in a sentence" />}</Field>
      <Field label="Market conditions">{(id) => <textarea id={id} className="j-textarea" rows={2} value={editing.draft.market_conditions} onChange={(e) => set('market_conditions', e.target.value)} placeholder="Trending, ranging, news days to avoid" />}</Field>
      <div className="pb-form-2">
        <Field label="Entry criteria" hint="One condition per line">{(id) => <textarea id={id} className="j-textarea" rows={4} value={editing.draft.entry_criteria} onChange={(e) => set('entry_criteria', e.target.value)} />}</Field>
        <Field label="Exit criteria" hint="One condition per line">{(id) => <textarea id={id} className="j-textarea" rows={4} value={editing.draft.exit_criteria} onChange={(e) => set('exit_criteria', e.target.value)} />}</Field>
        <Field label="Partial criteria" hint="When to take part off">{(id) => <textarea id={id} className="j-textarea" rows={3} value={editing.draft.partial_criteria} onChange={(e) => set('partial_criteria', e.target.value)} />}</Field>
        <Field label="Break-even criteria" hint="When to move the stop">{(id) => <textarea id={id} className="j-textarea" rows={3} value={editing.draft.be_criteria} onChange={(e) => set('be_criteria', e.target.value)} />}</Field>
      </div>
      <Field label="Additional rules" hint="Anything else that gates this setup, one per line">{(id) => <textarea id={id} className="j-textarea" rows={3} value={editing.draft.rules} onChange={(e) => set('rules', e.target.value)} />}</Field>
      <div className="pb-form-3">
        <Field label="Risk per trade (%)">{(id) => <input id={id} type="number" min="0" step="0.1" className="j-input" value={editing.draft.risk_per_trade} onChange={(e) => set('risk_per_trade', e.target.value)} placeholder="0.5" />}</Field>
        <Field label="Min risk:reward">{(id) => <input id={id} type="number" min="0" step="0.1" className="j-input" value={editing.draft.min_risk_reward} onChange={(e) => set('min_risk_reward', e.target.value)} placeholder="2" />}</Field>
        <Field label="Max risk:reward">{(id) => <input id={id} type="number" min="0" step="0.1" className="j-input" value={editing.draft.max_risk_reward} onChange={(e) => set('max_risk_reward', e.target.value)} placeholder="3" />}</Field>
      </div>
      <SwitchRow label="Active" hint="Archived setups stay in your records and drop out of the trade form." checked={editing.draft.is_active} onChange={(v) => set('is_active', v)} />
    </Dialog>
  );

  const confirm = (
    <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={remove}
      title={confirmDelete ? `Delete ${confirmDelete.name}?` : 'Delete setup'}
      body={confirmDelete ? <>The {plural(rows.find((r) => r.s.id === confirmDelete.id)?.ts.length ?? 0, 'trade')} logged under {confirmDelete.name} stay in your journal, with the setup left unassigned. The rulebook for it is removed.</> : null} />
  );

  if (!rows.length) {
    return (
      <>
        {blocked && !editing && <DemoNotice onClose={clear} />}
        <Panel title="No setups yet">
          <p className="pb-lede">A setup is a pattern you trade on purpose: what you wait for, where you get in, where you get out, how much you risk. Trades tagged with a setup build its record, so you can see which ones pay.</p>
          <div className="j-actions"><button className="j-btn primary" onClick={() => { clear(); setEditing({ id: null, draft: blank }); }}><Plus /> Write your first setup</button></div>
        </Panel>
        {dialog}
      </>
    );
  }

  const s = current.s;
  const sum = current.sum;
  const rr = s.min_risk_reward != null && s.max_risk_reward != null ? `${s.min_risk_reward} to ${s.max_risk_reward}` : s.min_risk_reward != null ? `min ${s.min_risk_reward}` : s.max_risk_reward != null ? `max ${s.max_risk_reward}` : null;
  const hasRules = [s.entry_criteria, s.exit_criteria, s.partial_criteria, s.be_criteria, s.market_conditions, s.rules].some((x) => lines(x).length);

  const list = (
    <Panel className="pb-master" title="Setups" meta={plural(rows.reduce((x, r) => x + r.sum.count, 0), 'closed trade')}>
      <div className="pb-list" role="listbox" aria-label="Setups">
        {rows.map((r) => (
          <button key={r.s.id} role="option" className="pb-item" aria-selected={r.s.id === s.id} onClick={() => open(r.s.id)} data-off={!r.s.is_active || undefined}>
            <span className="grow">
              <span className="t">{r.s.name}</span>
              <span className="s j-num">{r.sum.count} {r.sum.count === 1 ? 'trade' : 'trades'} · {r.sum.winRate != null ? `${Math.round(r.sum.winRate)}% won` : 'no result yet'}</span>
            </span>
            <span className="pb-end">
              {r.sum.count ? <PnL v={r.sum.net} currency={currency} decimals={0} /> : <span className="j-dim">—</span>}
              <span className={`j-pill ${r.s.is_active ? '' : 'warn'}`}>{r.s.is_active ? 'Active' : 'Archived'}</span>
            </span>
          </button>
        ))}
      </div>
      {unassigned.count > 0 && (
        <p className="j-meta pb-foot">{plural(unassigned.count, 'closed trade')} carry no setup ({money(unassigned.net, currency, { sign: true, decimals: 0 })}).</p>
      )}
    </Panel>
  );

  const body = (
    <div className="pb-col">
      {isPhone && <button className="j-link pb-back" onClick={() => setDetailOpen(false)}><ArrowLeft /> All setups</button>}
      <Panel
        className="pb-detail"
        title={s.name}
        action={
          <span className="pb-actions">
            <button className="j-btn sm" onClick={() => startEdit(s)}><Pencil /> Edit</button>
            <button className="j-btn sm ghost" onClick={() => toggleArchive(s)}>{s.is_active ? <Archive /> : <ArchiveRestore />} {s.is_active ? 'Archive' : 'Restore'}</button>
            <button className="j-btn sm ghost pb-del" onClick={() => { clear(); setConfirmDelete(s); }}><Trash2 /> Delete</button>
          </span>
        }
      >
        {error && <ErrorBlock message={error} />}
        {blocked && !editing && !confirmDelete && <DemoNotice onClose={clear} />}
        {s.description && <p className="pb-lede">{s.description}</p>}
        <div className="pb-params">
          <Param label="Timeframe">{s.timeframe || <span className="j-dim">—</span>}</Param>
          <Param label="Risk per trade">{s.risk_per_trade != null ? `${s.risk_per_trade}%` : <span className="j-dim">—</span>}</Param>
          <Param label="Risk:reward">{rr ?? <span className="j-dim">—</span>}</Param>
        </div>
      </Panel>

      <Kpis items={[
        { label: 'Trades', value: int(sum.count), note: sum.count < SMALL_SAMPLE ? <span className="pb-warn">Small sample</span> : `${sum.wins} won · ${sum.losses} lost` },
        { label: 'Win rate', value: pct(sum.winRate), note: sum.count ? `${sum.flat} flat` : undefined },
        { label: 'Profit factor', value: sum.profitFactor == null ? '—' : dec2(sum.profitFactor), note: sum.avgWin != null && sum.avgLoss != null ? `avg ${money(sum.avgWin, currency, { decimals: 0 })} / ${money(-sum.avgLoss, currency, { decimals: 0 })}` : 'needs a win and a loss' },
        { label: 'Average R', value: rMult(sum.avgR), note: sum.rCount ? `${sum.rCount} of ${sum.count} trades have R` : undefined },
        { label: 'Net result', value: money(sum.net, currency, { sign: true, decimals: 0 }), tone: sum.net < 0 ? 'neg' : 'flat', note: sum.expectancy != null ? `${money(sum.expectancy, currency, { sign: true, decimals: 0 })} a trade` : undefined },
      ]} />

      <Panel title="Result of this setup" meta={`Running net · all time · ${scopeAccounts.length === 1 ? scopeAccounts[0].name : `${scopeAccounts.length} accounts`}`}>
        {detail && detail.curve.length ? (
          <>
            <LineChart ariaLabel={`Cumulative result of ${s.name}`} currency={currency} height={220}
              points={detail.curve.map((p) => ({ t: p.t, v: p.v, note: `${signed(p.pnl, 2)} on the trade` }))} />
            <p className="j-meta pb-foot">
              {detail.best
                ? <>Best session: <b>{detail.best.label}</b>, {money(detail.best.net, currency, { sign: true, decimals: 0 })} over {plural(detail.best.count, 'trade')}{detail.best.winRate != null ? `, ${Math.round(detail.best.winRate)}% won` : ''}.</>
                : 'No session has three trades under this setup yet.'}
            </p>
          </>
        ) : <Empty>No closed trades under this setup in this scope. Pick it on a trade and its record builds here.</Empty>}
      </Panel>

      <Panel title="Rulebook" meta={`Written once, checked on every trade`}>
        {hasRules ? (
          <div className="pb-rules">
            <Rule title="Entry criteria" text={s.entry_criteria} />
            <Rule title="Exit criteria" text={s.exit_criteria} />
            <Rule title="Partial criteria" text={s.partial_criteria} />
            <Rule title="Break-even criteria" text={s.be_criteria} />
            <Rule title="Market conditions" text={s.market_conditions} />
            <Rule title="Additional rules" text={s.rules} />
          </div>
        ) : <Empty>No rules written for this setup yet. Edit it to add entry and exit criteria.</Empty>}
      </Panel>
    </div>
  );

  return (
    <>
      <div className="pb-split">
        {(!isPhone || !detailOpen) && list}
        {(!isPhone || detailOpen) && body}
      </div>
      {dialog}
      {confirm}
    </>
  );
}
