// Checklist tab: the confluence items that gate an entry, grouped by category, each with the
// weight it carries in the score and what the journal says it is worth (trades with it vs without).

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useJournal } from '../../JournalProvider';
import { isClosed, summarize } from '../../analytics';
import { money, pct } from '../../format';
import type { ConfluenceItem } from '../../types';
import { ConfirmDialog, Dialog, ErrorBlock, Panel, PnL } from '../../ui/kit';
import { DemoNotice, Field, SwitchRow, errText, plural, useWriteGuard } from './shared';

const CATEGORIES = ['Context', 'Trigger', 'Timing', 'Technical Analysis', 'Fundamental Analysis', 'Market Structure', 'Risk Management', 'Sentiment Analysis', 'Time-based', 'Other'];
const MIN_SIDE = 5;

interface Draft { id: string | null; name: string; category: string; description: string; weight: string; is_active: boolean }
const blank: Draft = { id: null, name: '', category: '', description: '', weight: '1', is_active: true };

interface Stat {
  item: ConfluenceItem;
  nPresent: number; nAbsent: number; scored: number;
  winP: number | null; winA: number | null; expP: number | null; expA: number | null;
  edge: number | null; small: boolean; share: number | null;
}

export default function Checklist({ newSignal }: { newSignal: number }) {
  const J = useJournal();
  const { confluenceItems, tradeConfluence, scopeTrades, scopeAccounts } = J;
  const { guard, blocked, clear, refresh } = useWriteGuard();
  const currency = scopeAccounts[0]?.currency ?? 'USD';
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfluenceItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ name?: string; weight?: string }>({});

  useEffect(() => { if (newSignal > 0) { clear(); setError(null); setFieldErr({}); setDraft(blank); } }, [newSignal, clear]);

  const activeWeight = useMemo(() => confluenceItems.filter((c) => c.is_active).reduce((s, c) => s + (c.weight ?? 1), 0), [confluenceItems]);

  const stats = useMemo<Stat[]>(() => {
    const closed = new Map(scopeTrades.filter(isClosed).map((t) => [t.id, t]));
    const scoredIds = new Set<string>();
    const presentBy = new Map<string, Set<string>>();
    for (const r of tradeConfluence) {
      if (!closed.has(r.trade_id)) continue;
      scoredIds.add(r.trade_id);
      if (r.is_present) (presentBy.get(r.confluence_item_id) ?? presentBy.set(r.confluence_item_id, new Set()).get(r.confluence_item_id)!).add(r.trade_id);
    }
    return confluenceItems.map((item) => {
      const pres = presentBy.get(item.id) ?? new Set<string>();
      const p = [...pres].map((id) => closed.get(id)!);
      const a = [...scoredIds].filter((id) => !pres.has(id)).map((id) => closed.get(id)!);
      const sp = summarize(p), sa = summarize(a);
      const edge = sp.expectancy != null && sa.expectancy != null ? sp.expectancy - sa.expectancy : null;
      return {
        item, nPresent: p.length, nAbsent: a.length, scored: scoredIds.size,
        winP: sp.winRate, winA: sa.winRate, expP: sp.expectancy, expA: sa.expectancy,
        edge, small: p.length < MIN_SIDE || a.length < MIN_SIDE,
        share: item.is_active && activeWeight ? ((item.weight ?? 1) / activeWeight) * 100 : null,
      };
    });
  }, [confluenceItems, tradeConfluence, scopeTrades, activeWeight]);

  const groups = useMemo(() => {
    const m = new Map<string, Stat[]>();
    for (const s of stats) { const k = s.item.category?.trim() || 'Uncategorized'; (m.get(k) ?? m.set(k, []).get(k)!).push(s); }
    return [...m.entries()]
      .map(([name, items]) => ({ name, items: items.sort((a, b) => Number(b.item.is_active) - Number(a.item.is_active) || (b.item.weight ?? 0) - (a.item.weight ?? 0) || a.item.name.localeCompare(b.item.name)) }))
      .sort((a, b) => (a.name === 'Uncategorized' ? 1 : b.name === 'Uncategorized' ? -1 : a.name.localeCompare(b.name)));
  }, [stats]);

  const maxWeight = Math.max(1, ...confluenceItems.map((c) => c.weight ?? 1));
  const categories = useMemo(() => [...new Set([...CATEGORIES, ...confluenceItems.map((c) => c.category).filter(Boolean) as string[]])], [confluenceItems]);

  const openEdit = (c: ConfluenceItem) => { clear(); setError(null); setFieldErr({}); setDraft({ id: c.id, name: c.name, category: c.category ?? '', description: c.description ?? '', weight: String(c.weight ?? 1), is_active: c.is_active }); };

  const save = async () => {
    if (!draft) return;
    const w = Number(draft.weight);
    const errs: typeof fieldErr = {};
    if (!draft.name.trim()) errs.name = 'An item needs a name.';
    if (!(w >= 0.1 && w <= 5)) errs.weight = 'Weight runs from 0.1 to 5.';
    setFieldErr(errs);
    if (errs.name || errs.weight) return;
    const uid = guard();
    if (!uid) return;
    setBusy(true); setError(null);
    const payload = { name: draft.name.trim(), category: draft.category.trim() || null, description: draft.description.trim() || null, weight: Math.round(w * 10) / 10, is_active: draft.is_active, user_id: uid };
    try {
      const { error: e } = draft.id
        ? await supabase.from('confluence_items').update(payload).eq('id', draft.id).eq('user_id', uid)
        : await supabase.from('confluence_items').insert(payload);
      if (e) throw e;
      await refresh();
      setDraft(null);
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  };

  const remove = async () => {
    const c = confirmDelete;
    if (!c) return;
    const uid = guard();
    if (!uid) { setConfirmDelete(null); return; }
    setBusy(true);
    try {
      const { error: e } = await supabase.from('confluence_items').delete().eq('id', c.id).eq('user_id', uid);
      if (e) throw e;
      await refresh();
    } catch (e) { setError(errText(e)); } finally { setBusy(false); setConfirmDelete(null); }
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const dialog = draft && (
    <Dialog open onClose={() => setDraft(null)} title={draft.id ? 'Edit checklist item' : 'New checklist item'}
      footer={<>
        {blocked && <DemoNotice compact onClose={clear} />}
        {draft.id && <button className="j-btn danger pb-foot-left" onClick={() => { const c = confluenceItems.find((x) => x.id === draft.id)!; setDraft(null); setConfirmDelete(c); }}><Trash2 /> Delete</button>}
        <button className="j-btn" onClick={() => setDraft(null)}>Cancel</button>
        <button className="j-btn primary" disabled={busy} onClick={save}>{busy ? 'Saving' : draft.id ? 'Save changes' : 'Add item'}</button>
      </>}>
      <span className="pb-dlg" hidden />
      {error && <ErrorBlock message={error} />}
      <Field label="Name">{(id) => (
        <>
          <input id={id} className="j-input" value={draft.name} onChange={(e) => { setFieldErr((x) => ({ ...x, name: undefined })); set('name', e.target.value); }} placeholder="Liquidity swept" autoFocus aria-invalid={!!fieldErr.name} />
          {fieldErr.name && <span className="j-err">{fieldErr.name}</span>}
        </>
      )}</Field>
      <div className="pb-form-2">
        <Field label="Category">{(id) => (
          <select id={id} className="j-select" value={draft.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">Uncategorized</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}</Field>
        <Field label="Weight" hint="0.1 to 5. Heavier items move the score more.">{(id) => (
          <>
            <input id={id} type="number" min="0.1" max="5" step="0.1" className="j-input" value={draft.weight} onChange={(e) => { setFieldErr((x) => ({ ...x, weight: undefined })); set('weight', e.target.value); }} aria-invalid={!!fieldErr.weight} />
            {fieldErr.weight && <span className="j-err">{fieldErr.weight}</span>}
          </>
        )}</Field>
      </div>
      <Field label="Description">{(id) => <textarea id={id} className="j-textarea" rows={3} value={draft.description} onChange={(e) => set('description', e.target.value)} placeholder="What has to be true for this to count as present" />}</Field>
      <SwitchRow label="Active" hint="Inactive items drop out of the score and the trade form; past answers are kept." checked={draft.is_active} onChange={(v) => set('is_active', v)} />
    </Dialog>
  );

  const confirm = (
    <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={remove}
      title={confirmDelete ? `Delete ${confirmDelete.name}?` : 'Delete item'}
      body={confirmDelete ? <>The item and how each trade answered it are removed. Trades stay in the journal, and their stored scores are left as they were. To keep the history, switch it to inactive instead.</> : null} />
  );

  if (!confluenceItems.length) {
    return (
      <>
        {blocked && !draft && <DemoNotice onClose={clear} />}
        <Panel title="No checklist items yet">
          <p className="pb-lede">A checklist item is one thing that should be true before you enter: bias aligned, liquidity taken, inside a killzone. Each carries a weight. On every trade you tick what was present, and the journal scores the trade and shows which items actually pay.</p>
          <div className="j-actions"><button className="j-btn primary" onClick={() => { clear(); setDraft(blank); }}><Plus /> Add your first item</button></div>
        </Panel>
        {dialog}
      </>
    );
  }

  const scored = stats[0]?.scored ?? 0;
  const activeCount = confluenceItems.filter((c) => c.is_active).length;

  return (
    <>
      {blocked && !draft && !confirmDelete && <DemoNotice onClose={clear} />}
      {error && !draft && <ErrorBlock message={error} />}
      <Panel
        title="Checklist"
        meta={`${plural(activeCount, 'active item')} · total weight ${activeWeight.toFixed(1)}`}
      >
        <p className="j-meta pb-formula">
          A trade scores the weight of the items present divided by the weight of all active items.
          Edge compares {plural(scored, 'closed trade')} that have a checklist: the top figure in each column is with the item present, the grey one without it. Under {MIN_SIDE} trades on either side is a small sample.
        </p>
        <div className="j-table-wrap j-table-m">
          <table className="pb-table">
            <thead>
              <tr>
                <th className="id">Item</th>
                <th className="n pb-c1">Weight</th>
                <th className="n pb-c2">Present in</th>
                <th className="n pb-c3">Win rate</th>
                <th className="n pb-c4">Expectancy</th>
                <th className="n pb-c5">Edge when present</th>
                <th aria-label="Edit" />
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.name}>
                <tr className="pb-group"><th colSpan={7} scope="colgroup">{g.name} <span className="j-dim">· {plural(g.items.length, 'item')}</span></th></tr>
                {g.items.map((s) => (
                  <tr key={s.item.id} className="j-click" tabIndex={0} data-off={!s.item.is_active || undefined} onClick={() => openEdit(s.item)} onKeyDown={(e) => e.key === 'Enter' && openEdit(s.item)}>
                    <td className="two id pb-name">
                      <span className="t">{s.item.name}{!s.item.is_active && <span className="j-pill pb-inline">Inactive</span>}</span>
                      {s.item.description && <span className="j-sub j-trunc-d">{s.item.description}</span>}
                    </td>
                    <td className="n two">
                      <span className="j-mono">{(s.item.weight ?? 1).toFixed(1)}</span>
                      <span className="pb-bar" aria-hidden="true"><i style={{ width: `${((s.item.weight ?? 1) / maxWeight) * 100}%` }} /></span>
                      <span className="j-sub">{s.share != null ? `${pct(s.share, 0)} of score` : 'not scored'}</span>
                    </td>
                    <td className="n two">
                      <span>{s.scored ? pct((s.nPresent / s.scored) * 100, 0) : '—'}</span>
                      <span className="j-sub">{s.scored ? `${s.nPresent} of ${s.scored}` : 'no trades scored'}</span>
                    </td>
                    <td className="n two">
                      <span>{pct(s.winP, 0)}</span>
                      <span className="j-sub">{pct(s.winA, 0)} absent</span>
                    </td>
                    <td className="n two">
                      <span>{s.expP != null ? money(s.expP, currency, { sign: true, decimals: 0 }) : '—'}</span>
                      <span className="j-sub">{s.expA != null ? money(s.expA, currency, { sign: true, decimals: 0 }) : '—'} absent</span>
                    </td>
                    <td className="n two">
                      {s.edge != null ? <PnL v={s.edge} currency={currency} decimals={0} /> : <span className="j-dim">—</span>}
                      <span className={`j-sub ${s.small && s.scored ? 'pb-warn' : ''}`} title={`${s.nPresent} trades with it, ${s.nAbsent} without`}>{s.edge == null ? (s.nAbsent === 0 && s.nPresent ? 'always present' : s.nPresent === 0 && s.scored ? 'never present' : 'no data') : s.small ? 'small sample' : 'a trade'}</span>
                    </td>
                    <td className="pb-act"><span className="j-icon-btn" aria-hidden="true"><Pencil /></span></td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>

        <div className="j-list-m pb-mlist">
          {groups.map((g) => (
            <div key={g.name}>
              <h3 className="pb-gh">{g.name} <span className="j-dim">· {g.items.length}</span></h3>
              {g.items.map((s) => (
                <button key={s.item.id} className="pb-mrow" data-off={!s.item.is_active || undefined} onClick={() => openEdit(s.item)}>
                  <span className="grow">
                    <span className="t">{s.item.name}</span>
                    <span className="s j-num">weight {(s.item.weight ?? 1).toFixed(1)} · in {s.scored ? pct((s.nPresent / s.scored) * 100, 0) : '—'}{!s.item.is_active ? ' · inactive' : ''}</span>
                    {s.small && s.scored > 0 && <span className="s pb-warn">small sample</span>}
                  </span>
                  <span className="pb-end">
                    {s.edge != null ? <PnL v={s.edge} currency={currency} decimals={0} /> : <span className="j-dim">—</span>}
                    <span className="s">edge a trade</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </Panel>
      {dialog}
      {confirm}
    </>
  );
}
