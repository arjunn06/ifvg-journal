// Mistakes tab: the vocabulary of ways a trade goes wrong, and what each one has cost so far.
// A tag is stored as plain text on every trade that carries it, so renaming and deleting reach those rows too.

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useJournal } from '../../JournalProvider';
import { isClosed, mistakeCosts, pnlOf } from '../../analytics';
import { money } from '../../format';
import { ConfirmDialog, Dialog, Empty, ErrorBlock, Panel, PnL, RankList, Skel } from '../../ui/kit';
import type { TagRow } from './data';
import { DemoNotice, Field, errText, plural, useWriteGuard } from './shared';

interface Row { name: string; category: string | null; count: number; cost: number; saved: TagRow | null; all: number }
interface Draft { id: string | null; name: string; category: string }

export default function Mistakes({
  saved, loading, error: loadError, reload, newSignal,
}: { saved: TagRow[]; loading: boolean; error: string | null; reload: () => Promise<void>; newSignal: number }) {
  const J = useJournal();
  const { mistakes, scopeTrades, scopeAccounts } = J;
  const { guard, blocked, clear, refresh } = useWriteGuard();
  const currency = scopeAccounts[0]?.currency ?? 'USD';
  const [draft, setDraft] = useState<(Draft & { from: string | null }) | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);

  useEffect(() => { if (newSignal > 0) { clear(); setError(null); setNameErr(null); setDraft({ id: null, name: '', category: '', from: null }); } }, [newSignal, clear]);

  const rows = useMemo<Row[]>(() => {
    const costs = new Map(mistakeCosts(scopeTrades, mistakes).map((m) => [m.tag, m]));
    const all = new Map<string, number>();
    for (const m of mistakes) all.set(m.mistake_tag, (all.get(m.mistake_tag) ?? 0) + 1);
    const names = new Set([...saved.map((s) => s.tag_name), ...mistakes.map((m) => m.mistake_tag)]);
    return [...names].map((name) => {
      const s = saved.find((x) => x.tag_name === name) ?? null;
      const c = costs.get(name);
      return { name, category: s?.category ?? null, count: c?.count ?? 0, cost: c?.cost ?? 0, saved: s, all: all.get(name) ?? 0 };
    }).sort((a, b) => a.cost - b.cost || b.count - a.count || a.name.localeCompare(b.name));
  }, [saved, mistakes, scopeTrades]);

  const byCategory = useMemo(() => {
    const m = new Map<string, { cost: number; count: number }>();
    for (const r of rows) { const k = r.category?.trim() || 'No category'; const x = m.get(k) ?? { cost: 0, count: 0 }; x.cost += r.cost; x.count += r.count; m.set(k, x); }
    return [...m.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => a.cost - b.cost);
  }, [rows]);
  const split = useMemo(() => {
    const flagged = new Set(mistakes.map((m) => m.trade_id));
    const closed = scopeTrades.filter(isClosed);
    const part = (ts: typeof closed) => { return { count: ts.length, avg: ts.length ? ts.reduce((x, t) => x + pnlOf(t), 0) / ts.length : null }; };
    return { clean: part(closed.filter((t) => !flagged.has(t.id))), tagged: part(closed.filter((t) => flagged.has(t.id))) };
  }, [mistakes, scopeTrades]);
  const maxCat = Math.max(1, ...byCategory.map((c) => Math.abs(c.cost)));
  const maxCost = Math.max(1, ...rows.map((r) => Math.abs(r.cost)));
  const categories = useMemo(() => [...new Set(saved.map((s) => s.category).filter(Boolean) as string[])], [saved]);

  const openEdit = (r: Row) => { clear(); setError(null); setNameErr(null); setDraft({ id: r.saved?.id ?? null, name: r.name, category: r.category ?? '', from: r.name }); };

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) { setNameErr('A tag needs a name.'); return; }
    if (rows.some((r) => r.name.toLowerCase() === name.toLowerCase() && r.name !== draft.from)) { setNameErr('You already have a tag with this name.'); return; }
    const uid = guard();
    if (!uid) return;
    setBusy(true); setError(null);
    try {
      const category = draft.category.trim() || 'General';
      if (draft.id) {
        const { error: e } = await supabase.from('mistake_tags').update({ tag_name: name, category }).eq('id', draft.id).eq('user_id', uid);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('mistake_tags').insert({ tag_name: name, category, user_id: uid });
        if (e) throw e;
      }
      if (draft.from && draft.from !== name) {
        const { error: e } = await supabase.from('trade_mistakes').update({ mistake_tag: name }).eq('mistake_tag', draft.from).eq('user_id', uid);
        if (e) throw e;
      }
      await Promise.all([reload(), refresh()]);
      setDraft(null);
    } catch (e) {
      const m = errText(e);
      setError(/duplicate|unique/i.test(m) ? 'You already have a tag with this name.' : m);
    } finally { setBusy(false); }
  };

  const remove = async () => {
    const r = confirmDelete;
    if (!r) return;
    const uid = guard();
    if (!uid) { setConfirmDelete(null); return; }
    setBusy(true);
    try {
      if (r.saved) {
        const { error: e } = await supabase.from('mistake_tags').delete().eq('id', r.saved.id).eq('user_id', uid);
        if (e) throw e;
      }
      if (r.all) {
        const { error: e } = await supabase.from('trade_mistakes').delete().eq('mistake_tag', r.name).eq('user_id', uid);
        if (e) throw e;
      }
      await Promise.all([reload(), refresh()]);
    } catch (e) { setError(errText(e)); } finally { setBusy(false); setConfirmDelete(null); }
  };

  const dialog = draft && (
    <Dialog open onClose={() => setDraft(null)} title={draft.from ? 'Edit mistake tag' : 'New mistake tag'}
      footer={<>
        {blocked && <DemoNotice compact onClose={clear} />}
        {draft.from && <button className="j-btn danger pb-foot-left" onClick={() => { const r = rows.find((x) => x.name === draft.from)!; setDraft(null); setConfirmDelete(r); }}><Trash2 /> Delete</button>}
        <button className="j-btn" onClick={() => setDraft(null)}>Cancel</button>
        <button className="j-btn primary" disabled={busy} onClick={save}>{busy ? 'Saving' : draft.from ? 'Save changes' : 'Add tag'}</button>
      </>}>
      <span className="pb-dlg" hidden />
      {error && <ErrorBlock message={error} />}
      <Field label="Name" hint={draft.from ? 'Renaming updates every trade that carries the tag.' : undefined}>{(id) => (
        <>
          <input id={id} className="j-input" value={draft.name} autoFocus placeholder="FOMO entry" aria-invalid={!!nameErr} onChange={(e) => { setNameErr(null); setDraft({ ...draft, name: e.target.value }); }} />
          {nameErr && <span className="j-err">{nameErr}</span>}
        </>
      )}</Field>
      <Field label="Category" hint="Groups tags in the breakdown, for example Psychology, Risk or Process.">{(id) => (
        <>
          <input id={id} className="j-input" list={`${id}-cats`} value={draft.category} placeholder="Psychology" onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
          <datalist id={`${id}-cats`}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </>
      )}</Field>
    </Dialog>
  );

  const confirm = (
    <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={remove}
      title={confirmDelete ? `Delete ${confirmDelete.name}?` : 'Delete tag'}
      body={confirmDelete ? (confirmDelete.all
        ? <>The tag is removed from your list and from the {plural(confirmDelete.all, 'trade')} that carry it. Those trades stay in the journal, untagged.</>
        : <>The tag is removed from your list. No trade carries it.</>) : null} />
  );

  if (loading) return <Panel title="Mistake tags"><Skel w="100%" h={220} /></Panel>;

  if (!rows.length) {
    return (
      <>
        {loadError && <ErrorBlock message={`Couldn't load your tags: ${loadError}`} onRetry={reload} />}
        {blocked && !draft && <DemoNotice onClose={clear} />}
        <Panel title="No mistake tags yet">
          <p className="pb-lede">A mistake tag names a way a trade went off the plan: chased the entry, moved the stop, oversized. Tag a trade after the fact and the journal adds up what each habit has cost you.</p>
          <div className="j-actions"><button className="j-btn primary" onClick={() => { clear(); setDraft({ id: null, name: '', category: '', from: null }); }}><Plus /> Add your first tag</button></div>
        </Panel>
        {dialog}
      </>
    );
  }

  return (
    <>
      {loadError && <ErrorBlock message={`Couldn't load your tags: ${loadError}`} onRetry={reload} />}
      {error && !draft && <ErrorBlock message={error} />}
      {blocked && !draft && !confirmDelete && <DemoNotice onClose={clear} />}
      <div className="j-grid">
        <Panel className="j-span-8" title="Mistake tags" meta={plural(rows.length, 'tag')}>
          <div className="j-table-wrap j-table-m">
            <table className="pb-table tight">
              <thead><tr><th className="id">Tag</th><th>Category</th><th className="n">Trades</th><th className="n">Cost</th><th aria-label="Edit" /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="j-click" tabIndex={0} onClick={() => openEdit(r)} onKeyDown={(e) => e.key === 'Enter' && openEdit(r)}>
                    <td className="two id pb-name">
                      <span className="t">{r.name}</span>
                      <span className="pb-bar wide" aria-hidden="true"><i style={{ width: `${r.cost ? Math.max(2, (Math.abs(r.cost) / maxCost) * 100) : 0}%` }} /></span>
                    </td>
                    <td className="mut">{r.category ?? '—'}</td>
                    <td className="n">{r.count}</td>
                    <td className="n">{r.count ? <PnL v={r.cost} currency={currency} decimals={0} /> : <span className="j-dim">—</span>}</td>
                    <td className="pb-act"><span className="j-meta">Edit</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="j-list-m pb-mlist">
            {rows.map((r) => (
              <button key={r.name} className="pb-mrow" onClick={() => openEdit(r)}>
                <span className="grow"><span className="t">{r.name}</span><span className="s">{r.category ?? 'No category'} · <span className="j-num">{plural(r.count, 'trade')}</span></span></span>
                <span className="pb-end">{r.count ? <PnL v={r.cost} currency={currency} decimals={0} /> : <span className="j-dim">—</span>}</span>
              </button>
            ))}
          </div>
          <p className="j-meta pb-foot">Cost is the sum of the losing trades that carry the tag, in this scope and over all time. A trade with two tags counts under each.</p>
        </Panel>

        <Panel className="j-span-4 col" title="By category" meta="Cost of losing trades">
          {byCategory.some((c) => c.count) ? (
            <RankList rows={byCategory.map((c) => ({ key: c.k, label: c.k, share: Math.abs(c.cost) / maxCat, sub: plural(c.count, 'trade'), value: c.count ? <PnL v={c.cost} currency={currency} decimals={0} /> : <span className="j-dim">—</span> }))} />
          ) : <Empty>No trade in this scope carries a mistake tag yet.</Empty>}
          {byCategory.some((c) => c.count) && (
            <p className="j-meta pb-foot">
              {money(rows.reduce((x, r) => x + r.cost, 0), currency, { decimals: 0 })} across all tags.
              {rows[0] && rows[0].cost < 0 && <> {rows[0].name} is the costliest: {money(rows[0].cost, currency, { decimals: 0 })} over {plural(rows[0].count, 'trade')}.</>}
            </p>
          )}
          <div className="pin">
            <h3 className="pb-sub">Tagged against clean</h3>
            <dl className="j-kv">
              <dt>Clean trades</dt><dd><span className="j-num">{split.clean.count} · <PnL v={split.clean.avg} currency={currency} decimals={0} /></span> <span className="j-meta">a trade</span></dd>
              <dt>Tagged trades</dt><dd><span className="j-num">{split.tagged.count} · <PnL v={split.tagged.avg} currency={currency} decimals={0} /></span> <span className="j-meta">a trade</span></dd>
            </dl>
          </div>
        </Panel>
      </div>
      {dialog}
      {confirm}
    </>
  );
}
