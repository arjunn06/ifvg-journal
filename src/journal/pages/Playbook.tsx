// Playbook. The question this screen answers: "What are my rules, and do my trades follow them?"
// Four tabs: the setups I trade, the checklist that gates an entry, my notes, the mistakes I tag.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useJournal } from '../JournalProvider';
import { isClosed } from '../analytics';
import { ConfirmDialog, ErrorBlock, PageHeader, Skel, Tabs } from '../ui/kit';
import Setups from './playbook/Setups';
import Checklist from './playbook/Checklist';
import Notes from './playbook/Notes';
import Mistakes from './playbook/Mistakes';
import { useMistakeTags, useNotes } from './playbook/data';
import { plural } from './playbook/shared';
import './Playbook.css';

type Tab = 'strategies' | 'checklist' | 'notes' | 'mistakes';
const TABS: Tab[] = ['strategies', 'checklist', 'notes', 'mistakes'];
const ADD: Record<Tab, string> = { strategies: 'New setup', checklist: 'Add item', notes: 'New note', mistakes: 'Add tag' };

export default function Playbook() {
  const J = useJournal();
  const { strategies, confluenceItems, scopeTrades, loading, error, refresh } = J;
  const [sp, setSp] = useSearchParams();
  const raw = sp.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : 'strategies';
  const notes = useNotes();
  const tags = useMistakeTags();
  const [notesDirty, setNotesDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<Tab | null>(null);
  const [sig, setSig] = useState<{ tab: Tab; n: number }>({ tab, n: 0 });

  const applyTab = useCallback((next: Tab) => {
    setSig({ tab: next, n: 0 });
    setSp((prev) => { const n = new URLSearchParams(prev); n.set('tab', next); n.delete('s'); return n; }, { replace: true });
  }, [setSp]);
  const changeTab = (next: Tab) => { if (next === tab) return; if (tab === 'notes' && notesDirty) setPendingTab(next); else applyTab(next); };
  const selectSetup = (id: string) => setSp((prev) => { const n = new URLSearchParams(prev); n.set('s', id); return n; }, { replace: true });

  useEffect(() => { if (tab !== 'notes') setNotesDirty(false); }, [tab]);

  const sub = useMemo(() => {
    const active = confluenceItems.filter((c) => c.is_active).length;
    if (!strategies.length && !confluenceItems.length) return 'Your rulebook is empty. Write down the setups you trade and the checklist that gates an entry.';
    const base = `${plural(strategies.length, 'setup')}, ${plural(active, 'checklist item')}`;
    const closed = scopeTrades.filter(isClosed);
    if (!closed.length) return `${base}.`;
    const counts = strategies.map((s) => ({ s, n: closed.filter((t) => t.strategy_id === s.id).length })).sort((a, b) => b.n - a.n);
    if (!counts.length || !counts[0].n) return `${base}; none of your ${closed.length} closed trades is tagged with a setup.`;
    return `${base}; ${counts[0].s.name} carries ${Math.round((counts[0].n / closed.length) * 100)}% of your trades.`;
  }, [strategies, confluenceItems, scopeTrades]);

  if (loading) {
    return (
      <>
        <PageHeader title="Playbook" sub={<Skel w={380} />} />
        <div className="j-tabs"><span className="j-tab"><Skel w={60} h={14} /></span></div>
        <div className="pb-split"><div className="j-panel" style={{ height: 260 }} /><div className="j-panel" style={{ height: 420 }} /></div>
      </>
    );
  }

  const bump = () => setSig((x) => ({ tab, n: (x.tab === tab ? x.n : 0) + 1 }));
  const signal = sig.tab === tab ? sig.n : 0;

  return (
    <>
      <PageHeader
        title="Playbook"
        sub={sub}
        actions={<button className="j-btn primary" onClick={bump}><Plus /> {ADD[tab]}</button>}
      />
      <Tabs<Tab> label="Playbook sections" value={tab} onChange={changeTab} items={[
        { key: 'strategies', label: 'Strategies', count: strategies.length },
        { key: 'checklist', label: 'Checklist', count: confluenceItems.length },
        { key: 'notes', label: 'Notes', count: notes.notes.length },
        { key: 'mistakes', label: 'Mistakes', count: tags.saved.length || undefined },
      ]} />
      {error && <ErrorBlock message={`Couldn't load your journal: ${error}`} onRetry={refresh} />}

      {tab === 'strategies' && <Setups selectedId={sp.get('s')} onSelect={selectSetup} newSignal={signal} />}
      {tab === 'checklist' && <Checklist newSignal={signal} />}
      {tab === 'notes' && <Notes notes={notes.notes} loading={notes.loading} error={notes.error} reload={notes.reload} newSignal={signal} onDirty={setNotesDirty} />}
      {tab === 'mistakes' && <Mistakes saved={tags.saved} loading={tags.loading} error={tags.error} reload={tags.reload} newSignal={signal} />}

      <ConfirmDialog open={!!pendingTab} onClose={() => setPendingTab(null)} confirmLabel="Discard changes"
        title="Leave without saving?" body="This note has changes that are not saved. Leaving the tab discards them."
        onConfirm={() => { const t = pendingTab; setPendingTab(null); setNotesDirty(false); if (t) applyTab(t); }} />
    </>
  );
}
