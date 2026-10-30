// Notes tab: a searchable list and an editor beside it. Content is plain text, exactly as the old
// screen stored it; images go to the `trade-screenshots` bucket under <user id>/, PDFs under <user id>/documents/.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileText, ImagePlus, Paperclip, Plus, Search, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { isoDate } from '../../format';
import { ConfirmDialog, Dialog, Empty, ErrorBlock, Panel, Skel } from '../../ui/kit';
import { NOTE_CATEGORIES, type Note } from './data';
import { DemoNotice, Field, errText, plural, useMedia, useWriteGuard } from './shared';

interface Draft { title: string; content: string; category: string; tags: string[]; images: string[]; attachments: string[] }
const emptyDraft: Draft = { title: '', content: '', category: 'General', tags: [], images: [], attachments: [] };
const fromNote = (n: Note): Draft => ({ title: n.title, content: n.content ?? '', category: n.category ?? '', tags: n.tags ?? [], images: n.images ?? [], attachments: n.attachments ?? [] });
const fileName = (url: string) => decodeURIComponent(url.split('/').pop() ?? 'document.pdf').replace(/^\d+(-\d+)?\./, 'document.');

function TagsInput({ id, tags, onChange }: { id: string; tags: string[]; onChange: (t: string[]) => void }) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const next = raw.split(',').map((x) => x.trim().replace(/^#/, '')).filter((x) => x && !tags.some((t) => t.toLowerCase() === x.toLowerCase()));
    if (next.length) onChange([...tags, ...next]);
    setText('');
  };
  return (
    <div className="pb-tags">
      {tags.map((t) => (
        <span key={t} className="j-chip">{t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}><X /></button></span>
      ))}
      <input
        id={id} className="pb-tags-in" value={text} placeholder={tags.length ? 'Add tag' : 'Add tags, press Enter'} 
        onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(text); }
          else if (e.key === 'Backspace' && !text && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={() => text.trim() && add(text)}
      />
    </div>
  );
}

export default function Notes({
  notes, loading, error: loadError, reload, newSignal, onDirty,
}: { notes: Note[]; loading: boolean; error: string | null; reload: () => Promise<void>; newSignal: number; onDirty: (d: boolean) => void }) {
  const isPhone = useMedia('(max-width: 640px)');
  const { guard, blocked, clear } = useWriteGuard();
  const [sel, setSel] = useState<string | null>(null); // note id, 'new', or null
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [base, setBase] = useState(JSON.stringify(emptyDraft));
  const [pendingImgs, setPendingImgs] = useState<{ file: File; url: string }[]>([]);
  const [pendingPdfs, setPendingPdfs] = useState<File[]>([]);
  const [pane, setPane] = useState<'list' | 'note'>('list');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleErr, setTitleErr] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const handledSignal = useRef(0);

  const dirty = sel != null && (JSON.stringify(draft) !== base || pendingImgs.length > 0 || pendingPdfs.length > 0);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  useEffect(() => () => pendingImgs.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = (id: string | null, d: Draft) => {
    pendingImgs.forEach((p) => URL.revokeObjectURL(p.url));
    setSel(id); setDraft(d); setBase(JSON.stringify(d)); setPendingImgs([]); setPendingPdfs([]); setError(null); setTitleErr(false); clear();
    setPane(id ? 'note' : 'list');
  };
  const go = (action: () => void) => { if (dirty) setPendingNav(() => action); else action(); };
  const openNote = (n: Note) => go(() => load(n.id, fromNote(n)));
  const startNew = () => go(() => load('new', emptyDraft));

  useEffect(() => {
    if (newSignal > handledSignal.current) { handledSignal.current = newSignal; startNew(); }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // On a wide screen the first note is open by default.
  useEffect(() => {
    if (!isPhone && sel == null && notes.length) load(notes[0].id, fromNote(notes[0]));
  }, [isPhone, notes]); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(() => [...new Set([...NOTE_CATEGORIES, ...notes.map((n) => n.category).filter(Boolean) as string[]])], [notes]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return notes.filter((n) => (cat === 'all' || n.category === cat)
      && (!t || n.title.toLowerCase().includes(t) || (n.content ?? '').toLowerCase().includes(t) || (n.tags ?? []).some((x) => x.toLowerCase().includes(t))));
  }, [notes, q, cat]);

  const current = sel && sel !== 'new' ? notes.find((n) => n.id === sel) : null;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const addImages = (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
    setPendingImgs((p) => [...p, ...list.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };
  const addPdfs = (files: FileList | null) => setPendingPdfs((p) => [...p, ...Array.from(files ?? []).filter((f) => f.type === 'application/pdf')]);

  const save = async () => {
    if (!draft.title.trim()) { setTitleErr(true); return; }
    const uid = guard();
    if (!uid) return;
    setBusy(true); setError(null);
    try {
      const up = async (f: File, folder: string, i: number) => {
        const ext = f.name.split('.').pop() || 'bin';
        const path = `${uid}/${folder}${Date.now()}-${i}.${ext}`;
        const { error: e } = await supabase.storage.from('trade-screenshots').upload(path, f);
        if (e) throw e;
        return supabase.storage.from('trade-screenshots').getPublicUrl(path).data.publicUrl;
      };
      const newImgs = await Promise.all(pendingImgs.map((p, i) => up(p.file, '', i)));
      const newPdfs = await Promise.all(pendingPdfs.map((f, i) => up(f, 'documents/', i)));
      const payload = {
        title: draft.title.trim(), content: draft.content, category: draft.category, tags: draft.tags,
        images: [...draft.images, ...newImgs], attachments: [...draft.attachments, ...newPdfs], user_id: uid, updated_at: new Date().toISOString(),
      };
      let id = sel;
      if (sel === 'new') {
        const { data, error: e } = await supabase.from('notes').insert(payload).select('id').single();
        if (e) throw e;
        id = (data as { id: string }).id;
      } else {
        const { error: e } = await supabase.from('notes').update(payload).eq('id', sel!).eq('user_id', uid);
        if (e) throw e;
      }
      await reload();
      const saved: Draft = { ...draft, images: payload.images, attachments: payload.attachments };
      pendingImgs.forEach((p) => URL.revokeObjectURL(p.url));
      setSel(id); setDraft(saved); setBase(JSON.stringify(saved)); setPendingImgs([]); setPendingPdfs([]);
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  };

  const remove = async () => {
    setAskDelete(false);
    if (!current) { load(null, emptyDraft); return; }
    const uid = guard();
    if (!uid) return;
    setBusy(true);
    try {
      const { error: e } = await supabase.from('notes').delete().eq('id', current.id).eq('user_id', uid);
      if (e) throw e;
      await reload();
      load(null, emptyDraft);
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  };

  const confirms = (
    <>
      <ConfirmDialog open={askDelete} onClose={() => setAskDelete(false)} onConfirm={remove} title={`Delete ${draft.title.trim() || 'this note'}?`} body="The note, its tags and its attached images are removed from your journal." />
      <ConfirmDialog open={!!pendingNav} onClose={() => setPendingNav(null)} confirmLabel="Discard changes"
        onConfirm={() => { const a = pendingNav; setPendingNav(null); a?.(); }} title="Leave without saving?" body={`Your edits to ${draft.title.trim() ? `"${draft.title.trim()}"` : 'this note'} have not been saved.`} />
      {lightbox && <Dialog wide open onClose={() => setLightbox(null)} title="Image"><img src={lightbox} alt="Attached to the note" className="pb-lightbox" /></Dialog>}
    </>
  );

  if (loading) {
    return (
      <div className="pb-split">
        <Panel title="Notes"><div className="pb-list">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="pb-item"><span className="grow"><Skel w="70%" /><div style={{ marginTop: 8 }}><Skel w="45%" h={12} /></div></span></div>)}</div></Panel>
        <Panel title="Note"><Skel w="40%" h={26} /><div style={{ marginTop: 20 }}><Skel w="100%" h={240} /></div></Panel>
      </div>
    );
  }

  if (!notes.length && !sel) {
    return (
      <>
        {loadError && <ErrorBlock message={`Couldn't load your notes: ${loadError}`} onRetry={reload} />}
        <Panel title="No notes yet">
          <p className="pb-lede">Notes are for what does not fit a trade: the week's levels, a lesson after a bad day, a rule you want to test. Tag them and they stay searchable.</p>
          <div className="j-actions"><button className="j-btn primary" onClick={startNew}><Plus /> Write your first note</button></div>
        </Panel>
        {confirms}
      </>
    );
  }

  const list = (
    <Panel className="pb-master" title="Notes" meta={q || cat !== 'all' ? `${filtered.length} of ${notes.length}` : plural(notes.length, 'note')}>
      <div className="pb-search">
        <label className="pb-search-in"><Search /><input className="j-input" type="search" placeholder="Search title, text, tags" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search notes" /></label>
        <select className="j-select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="pb-list" role="listbox" aria-label="Notes">
        {sel === 'new' && (
          <button role="option" className="pb-item" aria-selected="true"><span className="grow"><span className="t">{draft.title.trim() || 'Untitled note'}</span><span className="s">New, not saved</span></span></button>
        )}
        {filtered.map((n) => (
          <button key={n.id} role="option" className="pb-item" aria-selected={n.id === sel} onClick={() => openNote(n)}>
            <span className="grow">
              <span className="t">{n.title}</span>
              <span className="s"><span className="j-num">{isoDate(n.updated_at)}</span>{n.category ? ` · ${n.category}` : ''}</span>
              {!!n.tags?.length && <span className="pb-chips">{n.tags.slice(0, 3).map((t) => <span key={t} className="j-chip">{t}</span>)}{n.tags.length > 3 && <span className="j-meta">+{n.tags.length - 3}</span>}</span>}
            </span>
          </button>
        ))}
        {!filtered.length && notes.length > 0 && <Empty>No note matches. Try fewer words or another category.</Empty>}
      </div>
    </Panel>
  );

  const editor = sel ? (
    <div className="pb-col">
      {isPhone && <button className="j-link pb-back" onClick={() => go(() => { setPane('list'); setSel(null); setDraft(emptyDraft); setBase(JSON.stringify(emptyDraft)); })}><ArrowLeft /> All notes</button>}
      <Panel
        className="pb-detail"
        title={sel === 'new' ? 'New note' : 'Note'}
        meta={dirty ? <span className="pb-warn">Unsaved changes</span> : current ? `Edited ${isoDate(current.updated_at)}` : undefined}
        action={
          <span className="pb-actions">
            {dirty && <button className="j-btn sm ghost" onClick={() => load(sel, sel === 'new' ? emptyDraft : fromNote(current!))}>Discard</button>}
            <button className="j-btn sm primary" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving' : 'Save'}</button>
            <button className="j-icon-btn" aria-label="Delete note" onClick={() => (sel === 'new' ? go(() => load(null, emptyDraft)) : (clear(), setAskDelete(true)))}><Trash2 /></button>
          </span>
        }
      >
        {blocked && <DemoNotice onClose={clear} />}
        {error && <ErrorBlock message={error} />}
        <div className="pb-note">
          <Field label="Title">{(id) => (
            <>
              <input id={id} className="j-input pb-title-in" value={draft.title} onChange={(e) => { setTitleErr(false); set('title', e.target.value); }} placeholder="What is this note about" aria-invalid={titleErr} />
              {titleErr && <span className="j-err">Give the note a title.</span>}
            </>
          )}</Field>
          <div className="pb-form-2">
            <Field label="Category">{(id) => (
              <select id={id} className="j-select" value={draft.category} onChange={(e) => set('category', e.target.value)}>
                {!categories.includes(draft.category) && <option value={draft.category}>{draft.category || 'No category'}</option>}
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}</Field>
            <Field label="Tags">{(id) => <TagsInput id={id} tags={draft.tags} onChange={(t) => set('tags', t)} />}</Field>
          </div>
          <Field label="Content">{(id) => <textarea id={id} className="j-textarea pb-content" value={draft.content} onChange={(e) => set('content', e.target.value)} placeholder="Write it the way you would say it to yourself" />}</Field>

          <div className="pb-attach">
            <div className="pb-attach-head">
              <span className="j-label">Images</span>
              <button className="j-btn sm" onClick={() => imgInput.current?.click()}><ImagePlus /> Add images</button>
              <input ref={imgInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addImages(e.target.files); e.target.value = ''; }} />
            </div>
            {draft.images.length + pendingImgs.length > 0 ? (
              <div className="pb-thumbs">
                {draft.images.map((u, i) => (
                  <div key={u} className="pb-thumb"><button type="button" onClick={() => setLightbox(u)} aria-label={`Open image ${i + 1}`}><img src={u} alt={`Attached image ${i + 1}`} /></button><button type="button" className="x" aria-label="Remove image" onClick={() => set('images', draft.images.filter((x) => x !== u))}><X /></button></div>
                ))}
                {pendingImgs.map((p, i) => (
                  <div key={p.url} className="pb-thumb new"><img src={p.url} alt={`New image ${i + 1}`} /><button type="button" className="x" aria-label="Remove image" onClick={() => { URL.revokeObjectURL(p.url); setPendingImgs((l) => l.filter((x) => x !== p)); }}><X /></button></div>
                ))}
              </div>
            ) : <p className="j-meta">No images. Charts and screenshots are stored with your trade screenshots.</p>}
          </div>

          <div className="pb-attach">
            <div className="pb-attach-head">
              <span className="j-label">PDFs</span>
              <button className="j-btn sm" onClick={() => pdfInput.current?.click()}><Paperclip /> Add PDF</button>
              <input ref={pdfInput} type="file" accept="application/pdf" multiple hidden onChange={(e) => { addPdfs(e.target.files); e.target.value = ''; }} />
            </div>
            {draft.attachments.length + pendingPdfs.length > 0 ? (
              <div className="pb-files">
                {draft.attachments.map((u) => (
                  <div key={u} className="pb-file"><FileText /><a href={u} target="_blank" rel="noreferrer">{fileName(u)}</a><button type="button" className="j-icon-btn" aria-label="Remove PDF" onClick={() => set('attachments', draft.attachments.filter((x) => x !== u))}><X /></button></div>
                ))}
                {pendingPdfs.map((f) => (
                  <div key={f.name + f.size} className="pb-file"><FileText /><span>{f.name} <span className="j-dim">· uploads on save</span></span><button type="button" className="j-icon-btn" aria-label="Remove PDF" onClick={() => setPendingPdfs((l) => l.filter((x) => x !== f))}><X /></button></div>
                ))}
              </div>
            ) : <p className="j-meta">No documents attached.</p>}
          </div>
        </div>
      </Panel>
    </div>
  ) : (
    <Panel className="pb-detail" title="Note"><Empty>Pick a note on the left, or start a new one.</Empty></Panel>
  );

  return (
    <>
      {loadError && <ErrorBlock message={`Couldn't load your notes: ${loadError}`} onRetry={reload} />}
      <div className="pb-split">
        {(!isPhone || pane === 'list') && list}
        {(!isPhone || pane === 'note') && editor}
      </div>
      {confirms}
    </>
  );
}
