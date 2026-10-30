// Playbook tables the journal provider does not load: notes and the mistake-tag vocabulary.
// Live sessions read them with supabase; sample data gets a small in-memory set so the screen has something to show.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useJournal } from '../../JournalProvider';
import { MISTAKE_TAGS } from '../../demo';

export interface Note {
  id: string;
  title: string;
  content: string | null;
  category: string | null;
  tags: string[] | null;
  images: string[] | null;
  attachments: string[] | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface TagRow { id: string; tag_name: string; category: string | null }

export const NOTE_CATEGORIES = ['General', 'Trading Ideas', 'Lessons Learned', 'Market Analysis', 'Personal'];

const ago = (days: number, hour = 18) => { const d = new Date(); d.setDate(d.getDate() - days); d.setHours(hour, 12, 0, 0); return d.toISOString(); };
const sampleNotes = (): Note[] => [
  { id: 'n-1', title: 'Sunday prep: levels for the week', category: 'Market Analysis', tags: ['weekly', 'levels'], images: [], attachments: [], is_favorite: false, created_at: ago(5), updated_at: ago(5),
    content: 'Weekly high sits just above the Friday close; the first sweep of it is the trade if London gives a displacement down.\n\nBias: bearish below the weekly open, neutral above.\nPass on any setup before 08:30 on CPI days.\nOne trade a session until the evaluation passes.' },
  { id: 'n-2', title: 'Why I stopped trading NY lunch', category: 'Lessons Learned', tags: ['sessions', 'discipline'], images: [], attachments: [], is_favorite: true, created_at: ago(12), updated_at: ago(9),
    content: 'Twelve trades in the lunch window, one clean winner. The range is real but the sweeps do not follow through, and I take them out of boredom.\n\nRule: after 11:30 the platform closes unless the NY AM plan was missed entirely.' },
  { id: 'n-3', title: 'iFVG with partials at 1R', category: 'Trading Ideas', tags: ['iFVG', 'partials'], images: [], attachments: [], is_favorite: false, created_at: ago(20), updated_at: ago(20),
    content: 'Test on sim: take half at 1R, stop to break-even, runner to the opposing liquidity. Compare expectancy against all-in for 30 trades before touching the live accounts.' },
  { id: 'n-4', title: 'Pre-trade breathing', category: 'Personal', tags: ['routine'], images: [], attachments: [], is_favorite: false, created_at: ago(33), updated_at: ago(33),
    content: 'Two minutes before the open: water, stretch, read the plan out loud. Revenge trades all came after a skipped routine.' },
];
const SAMPLE_CATEGORY: Record<string, string> = {
  'FOMO entry': 'Psychology', 'Moved stop loss': 'Risk', 'Cut winner early': 'Psychology', Oversized: 'Risk', 'Revenge trade': 'Psychology', 'Ignored the plan': 'Process',
};

export function useNotes() {
  const { isDemo, userId } = useJournal();
  const [notes, setNotes] = useState<Note[]>(() => (isDemo ? sampleNotes() : []));
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (isDemo) { setNotes((n) => (n.length ? n : sampleNotes())); setLoading(false); return; }
    if (!userId) return;
    const { data, error: e } = await supabase.from('notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    if (e) setError(e.message);
    else { setError(null); setNotes(((data ?? []) as Note[]).map((n) => ({ ...n, tags: n.tags ?? [], images: n.images ?? [], attachments: n.attachments ?? [] }))); }
    setLoading(false);
  }, [isDemo, userId]);

  useEffect(() => { reload(); }, [reload]);
  return { notes, loading, error, reload };
}

export function useMistakeTags() {
  const { isDemo, userId } = useJournal();
  const [saved, setSaved] = useState<TagRow[]>(() => (isDemo ? MISTAKE_TAGS.map((t) => ({ id: `tag-${t}`, tag_name: t, category: SAMPLE_CATEGORY[t] ?? null })) : []));
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (isDemo || !userId) { setLoading(false); return; }
    const { data, error: e } = await supabase.from('mistake_tags').select('id, tag_name, category').eq('user_id', userId).order('tag_name');
    if (e) setError(e.message); else { setError(null); setSaved((data ?? []) as TagRow[]); }
    setLoading(false);
  }, [isDemo, userId]);

  useEffect(() => { reload(); }, [reload]);
  return useMemo(() => ({ saved, loading, error, reload }), [saved, loading, error, reload]);
}
