// Trade form (new + edit). The question it answers: "Did I take what my plan said, and what did it cost me?"
// Biggest block: the four panels at the left. The score and the one data-backed prompt sit in the pinned Summary.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, ImagePlus, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useJournal } from '../JournalProvider';
import { CONFLUENCE_TIERS, accountEquity, byConfluence, bySymbol, isClosed } from '../analytics';
import { currencySign, dec2, isoDate, money, relativeDay } from '../format';
import { SESSIONS, type Side, type Trade } from '../types';
import { ConfirmDialog, Empty, ErrorBlock, PageHeader, Panel, PnL, Signed, Skel } from '../ui/kit';
import {
  DEFAULT_MISTAKES, EMOTIONS, MAX_SHOTS, MAX_SHOT_BYTES, POINT_VALUE, autoResult, autoRisk, baseSymbol, blankState, clearDraft,
  confluenceScore, defaultAccount, fingerprint, num, plannedRR, readDraft, sideWarnings, stateFromTrade, toIso, validate, writeDraft,
  type Errors, type FieldKey, type FormState, type Severity,
} from './tradeform/logic';
import './TradeForm.css';

const FIELD_ORDER: FieldKey[] = ['account', 'symbol', 'side', 'entryDate', 'entryTime', 'exitDate', 'exitTime', 'entry', 'exit', 'size', 'result'];
const SEVERITIES: { key: Severity; label: string }[] = [{ key: 'low', label: 'Low' }, { key: 'medium', label: 'Medium' }, { key: 'high', label: 'High' }];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- small controls ----------

/** Radio group drawn as two or three buttons; the chosen one carries a 1px accent line as wide as its label. */
function Choice<T extends string>({ id, label, value, onChange, options, big, invalid, describedBy }: {
  id: string; label: string; value: T | ''; onChange: (v: T) => void;
  options: { key: T; label: string; icon?: ReactNode }[]; big?: boolean; invalid?: boolean; describedBy?: string;
}) {
  return (
    <div id={`tf-${id}`} role="radiogroup" aria-label={label} aria-invalid={invalid || undefined} aria-describedby={describedBy} className={`tf-toggle ${big ? 'big' : ''}`}>
      {options.map((o) => (
        <label key={o.key} className="tf-opt">
          <input type="radio" name={`tf-${id}`} value={o.key} checked={value === o.key} onChange={() => onChange(o.key)} />
          <span className="in">{o.icon}<span className="t">{o.label}</span></span>
        </label>
      ))}
    </div>
  );
}

function Field({ id, label, err, hint, className = '', required, children }: {
  id: string; label: string; err?: string; hint?: ReactNode; className?: string; required?: boolean; children: ReactNode;
}) {
  return (
    <div className={`j-field ${className}`}>
      <label htmlFor={`tf-${id}`}>{label}{required && <span className="tf-star" aria-hidden="true"> *</span>}</label>
      {children}
      {err ? <div className="j-err" id={`tf-${id}-err`} role="alert">{err}</div> : hint ? <div className="j-hint" id={`tf-${id}-hint`}>{hint}</div> : null}
    </div>
  );
}

/** props shared by every text-like control so errors and hints are read with the field. */
const wire = (id: string, err?: string, hint?: boolean) => ({
  id: `tf-${id}`, 'aria-invalid': err ? true : undefined,
  'aria-describedby': err ? `tf-${id}-err` : hint ? `tf-${id}-hint` : undefined,
});

function Loading() {
  return (
    <>
      <PageHeader title="New trade" sub={<Skel w={280} />} />
      <div className="tf">
        <div className="tf-main">
          {[300, 240, 280].map((h, i) => <div key={i} className="j-panel" style={{ height: h }} />)}
        </div>
        <div className="j-panel tf-side" style={{ height: 320 }} />
      </div>
    </>
  );
}

// ---------- page ----------

export default function TradeForm() {
  const { id } = useParams();
  const J = useJournal();
  if (J.loading) return <Loading />;
  const existing = id ? J.trades.find((t) => t.id === id) ?? null : null;
  if (id && !existing) {
    return (
      <>
        <PageHeader title="Edit trade" sub="That trade is not in this journal." />
        <Panel><Empty>It may have been deleted. Open the journal to find it.</Empty></Panel>
      </>
    );
  }
  if (!J.accounts.length) {
    return (
      <>
        <PageHeader title="New trade" sub="A trade belongs to an account, so the journal needs one first." />
        <Panel title="No accounts yet"><AddAccount /></Panel>
      </>
    );
  }
  // key: a new route param or a finished load starts the form from scratch
  return <Form key={existing?.id ?? 'new'} existing={existing} />;
}

function AddAccount() {
  const nav = useNavigate();
  return <button className="j-btn primary" onClick={() => nav('/accounts')}>Add an account</button>;
}

function Form({ existing }: { existing: Trade | null }) {
  const nav = useNavigate();
  const J = useJournal();
  const { accounts, trades, strategies, confluenceItems, tradeConfluence, mistakes, transactions, scope, isDemo, userId, saveTrade, deleteTrade } = J;
  const editing = !!existing;

  // ----- initial state: the trade, a restored draft, or sensible defaults -----
  const init = useRef<{ state: FormState; restored: boolean } | null>(null);
  if (!init.current) {
    if (existing) init.current = { state: stateFromTrade(existing, tradeConfluence, mistakes), restored: false };
    else {
      const draft = readDraft(userId);
      const fallback = defaultAccount(accounts, scope);
      const ok = draft && accounts.some((a) => a.id === draft.account);
      init.current = { state: ok ? draft : blankState(fallback), restored: !!ok };
    }
  }
  const [f, setF] = useState<FormState>(init.current.state);
  const [restored, setRestored] = useState(init.current.restored);
  const baseline = useRef(fingerprint(restored ? blankState(init.current.state.account) : init.current.state));
  const set = useCallback((patch: Partial<FormState>) => setF((p) => ({ ...p, ...patch })), []);

  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shotError, setShotError] = useState<string | null>(null);
  const [leave, setLeave] = useState<{ to: string; discard: boolean } | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [userTags, setUserTags] = useState<string[]>([]);
  const savedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = fingerprint(f) !== baseline.current;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty && !savedRef.current;

  // ----- drafts (new trades only) -----
  useEffect(() => {
    if (editing || savedRef.current) return;
    if (!dirty) return;
    const t = window.setTimeout(() => writeDraft(userId, f), 400);
    return () => window.clearTimeout(t);
  }, [f, dirty, editing, userId]);

  // ----- leaving with unsaved work -----
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    const click = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self')) return;
      const u = new URL(a.href, window.location.href);
      if (u.origin !== window.location.origin || u.pathname === window.location.pathname) return;
      e.preventDefault(); e.stopPropagation();
      setLeave({ to: u.pathname + u.search + u.hash, discard: false });
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', click, true); };
  }, []);

  // ----- the user's own mistake tags -----
  useEffect(() => {
    if (isDemo) { setUserTags([...new Set(mistakes.map((m) => m.mistake_tag))]); return; }
    if (!userId) return;
    let alive = true;
    Promise.resolve(supabase.from('mistake_tags').select('tag_name').eq('user_id', userId))
      .then(({ data }) => { if (alive && data) setUserTags((data as { tag_name: string }[]).map((r) => r.tag_name)); })
      .catch(() => { /* the defaults are enough */ });
    return () => { alive = false; };
  }, [isDemo, userId, mistakes]);

  // ----- derived -----
  const account = accounts.find((a) => a.id === f.account);
  const cur = account?.currency ?? 'USD';
  const sign = currencySign(cur);
  const items = useMemo(() => confluenceItems.filter((c) => c.is_active), [confluenceItems]);
  const score = useMemo(() => confluenceScore(items, f.conf), [items, f.conf]);
  const errors: Errors = useMemo(() => validate(f), [f]);
  const warn = sideWarnings(f);
  const show = (k: FieldKey) => ((attempted || touched[k]) ? errors[k] : undefined);
  const touch = (k: FieldKey) => () => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const pv = POINT_VALUE[baseSymbol(f.symbol) ?? ''];
  const aRes = f.status === 'closed' ? autoResult(f) : null;
  const aRisk = autoRisk(f);
  const effRisk = num(f.risk) ?? aRisk;
  const effRes = f.status === 'closed' ? num(f.result) ?? aRes : null;
  const rr = plannedRR(f);
  const resultR = effRes != null && effRisk ? effRes / effRisk : null;

  const equity = useMemo(() => {
    if (!account) return null;
    const own = existing && existing.trading_account_id === account.id && isClosed(existing) ? existing.pnl ?? 0 : 0;
    return accountEquity(account, trades, transactions) - own;
  }, [account, trades, transactions, existing]);
  const riskPct = effRisk != null && equity ? (effRisk / equity) * 100 : null;

  const symbols = useMemo(() => {
    const mine = bySymbol(trades).map((r) => r.key);
    return [...mine, ...Object.keys(POINT_VALUE).filter((s) => !mine.includes(s))];
  }, [trades]);

  const tags = useMemo(() => {
    const all = [...DEFAULT_MISTAKES];
    for (const t of [...userTags, ...f.mistakes.map((m) => m.tag)]) if (!all.some((x) => x.toLowerCase() === t.toLowerCase())) all.push(t);
    return all;
  }, [userTags, f.mistakes]);

  const conf = useMemo(() => byConfluence(trades.filter((t) => t.id !== existing?.id)), [trades, existing]);
  const insight = useMemo(() => {
    if (!score.count || !items.length) return null;
    const tier = CONFLUENCE_TIERS.find((x) => score.pct >= x.lo && score.pct < x.hi);
    const row = conf.find((r) => r.key === tier?.key);
    if (!tier || !row || row.count < 4) return null;
    if (tier.key === 'low') {
      return { warn: row.losses / row.count >= 0.5, text: `Trades below 50% confluence have lost in ${row.losses} of ${row.count} here.` };
    }
    return { warn: false, text: `Trades scored ${row.label.toLowerCase()} have won ${row.winRate != null ? Math.round(row.winRate) : 0}% of ${row.count} here.` };
  }, [conf, score, items.length]);
  const strat = strategies.find((s) => s.id === f.strategy);
  const belowMin = strat?.min_risk_reward != null && rr != null && rr < strat.min_risk_reward;

  const stratOptions = strategies.filter((s) => s.is_active || s.id === f.strategy);
  const acctOptions = accounts.filter((a) => a.is_active || a.id === f.account);

  // ----- handlers -----
  const setStatus = (status: 'open' | 'closed') => {
    const now = new Date();
    set(status === 'closed' && !f.exitDate ? { status, exitDate: isoDate(now), exitTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` } : { status });
  };
  const toggleMistake = (tag: string) =>
    set({ mistakes: f.mistakes.some((m) => m.tag === tag) ? f.mistakes.filter((m) => m.tag !== tag) : [...f.mistakes, { tag, severity: 'medium', note: '' }] });
  const patchMistake = (tag: string, p: Partial<{ severity: Severity; note: string }>) =>
    set({ mistakes: f.mistakes.map((m) => (m.tag === tag ? { ...m, ...p } : m)) });

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...f.shots];
    const problems: string[] = [];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith('image/')) { problems.push(`${file.name} is not an image.`); continue; }
      if (file.size > MAX_SHOT_BYTES) { problems.push(`${file.name} is over 5 MB.`); continue; }
      if (next.length >= MAX_SHOTS) { problems.push(`Only ${MAX_SHOTS} screenshots fit on a trade.`); break; }
      next.push({ id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`, url: URL.createObjectURL(file), file });
    }
    setShotError(problems.length ? [...new Set(problems)].join(' ') : null);
    set({ shots: next });
    if (fileRef.current) fileRef.current.value = '';
  };
  const removeShot = (sid: string) => {
    const s = f.shots.find((x) => x.id === sid);
    if (s?.file) URL.revokeObjectURL(s.url);
    setShotError(null);
    set({ shots: f.shots.filter((x) => x.id !== sid) });
  };

  const focusFirst = (errs: Errors) => {
    const k = FIELD_ORDER.find((x) => errs[x]);
    if (!k) return;
    const el = document.getElementById(`tf-${k}`);
    const target = el?.matches('input,select,textarea,button') ? el : el?.querySelector('input');
    (target as HTMLElement | null)?.focus();
  };

  const uploadShots = async (): Promise<string[]> => {
    const out: string[] = [];
    for (const s of f.shots) {
      // Demo mode never talks to the network: the local preview URL stays on the in-memory trade.
      if (!s.file || isDemo) { out.push(s.url); continue; }
      const ext = s.file.name.split('.').pop() || 'png';
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
      const { error } = await supabase.storage.from('trade-screenshots').upload(path, s.file);
      if (error) throw error;
      out.push(supabase.storage.from('trade-screenshots').getPublicUrl(path).data.publicUrl);
    }
    return out;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setAttempted(true);
    const errs = validate(f);
    if (Object.keys(errs).length) { focusFirst(errs); return; }
    setSaving(true); setSaveError(null);
    try {
      const urls = await uploadShots();
      const closed = f.status === 'closed';
      const payload = {
        ...(existing ? { id: existing.id } : {}),
        symbol: f.symbol.trim().toUpperCase(),
        trade_type: f.side as Side,
        session: (f.session || null) as Trade['session'],
        entry_price: num(f.entry)!,
        quantity: num(f.size)!,
        stop_loss: num(f.stop),
        take_profit: num(f.target),
        entry_date: toIso(f.entryDate, f.entryTime).toISOString(),
        exit_date: closed ? toIso(f.exitDate, f.exitTime).toISOString() : null,
        trading_account_id: f.account,
        strategy_id: f.strategy || null,
        notes: f.notes.trim() || null,
        emotions: f.emotion || null,
        risk_amount: effRisk,
        risk_reward_ratio: rr != null ? Math.round(rr * 100) / 100 : null,
        status: closed ? 'closed' : 'open',
        screenshots: urls.length ? urls : null,
        commission: num(f.commission),
        swap: num(f.swap),
        exit_price: closed ? num(f.exit) : null,
        pnl: closed ? effRes : null,
        confluence_score: items.length ? score.pct : null,
        ...(existing ? {} : { source: 'manual' }),
      } as Partial<Trade>;
      const confluence = { ...f.conf, ...Object.fromEntries(items.map((c) => [c.id, !!f.conf[c.id]])) };
      const newId = await saveTrade(payload, {
        confluence,
        mistakes: f.mistakes.map((m) => ({ tag: m.tag, severity: m.severity, description: m.note.trim() || null })),
      });
      savedRef.current = true;
      clearDraft(userId);
      nav(`/trades/${newId}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong while saving.');
      setSaving(false);
    }
  };

  const cancel = () => {
    const to = existing ? `/trades/${existing.id}` : '/trades';
    if (dirtyRef.current) setLeave({ to, discard: true });
    else nav(to);
  };
  const confirmLeave = () => {
    if (!leave) return;
    savedRef.current = true; // stop guarding while we leave
    if (leave.discard && !editing) clearDraft(userId);
    const to = leave.to;
    setLeave(null);
    nav(to);
  };
  const discardDraft = () => {
    clearDraft(userId);
    const fresh = blankState(defaultAccount(accounts, scope));
    baseline.current = fingerprint(fresh);
    setF(fresh); setRestored(false); setAttempted(false); setTouched({});
  };
  const doDelete = async () => {
    if (!existing) return;
    try {
      savedRef.current = true;
      await deleteTrade(existing.id);
      nav('/trades');
    } catch (err) {
      savedRef.current = false;
      setDelOpen(false);
      setSaveError(err instanceof Error ? err.message : 'Could not delete the trade.');
    }
  };

  // ----- copy -----
  const lastIn = useMemo(() => trades.filter((t) => t.trading_account_id === f.account).sort((a, b) => +new Date(b.entry_date) - +new Date(a.entry_date))[0], [trades, f.account]);
  const sub = existing
    ? `${existing.symbol} ${cap(existing.trade_type)} · ${isoDate(existing.entry_date)} · ${accounts.find((a) => a.id === existing.trading_account_id)?.name ?? 'Account'}`
    : lastIn ? `${account?.name ?? 'Account'} · last trade ${relativeDay(lastIn.entry_date).toLowerCase()}, ${lastIn.symbol} ${lastIn.trade_type}` : `${account?.name ?? 'Account'} · your first entry`;
  const scoreText = items.length ? `${score.count} of ${score.of} · ${score.pct}%` : 'No checklist';
  const errCount = Object.keys(errors).length;

  const autoHint = (value: number | null, current: string, apply: () => void, tail: string) => {
    if (value == null) return null;
    const same = num(current) === value;
    return (
      <span className="tf-auto">
        <span className="tf-tag">Auto</span> <span className="j-num">{money(value, cur)}</span> {same ? 'matches your prices' : tail}
        {!same && <> · <button type="button" className="j-link" onClick={apply}>Use</button></>}
      </span>
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader title={editing ? 'Edit trade' : 'New trade'} sub={sub} />
      {restored && !editing && (
        <p className="j-meta tf-draft" role="status">Draft restored · <button type="button" className="j-link" onClick={discardDraft}>Discard</button></p>
      )}
      {saveError && <ErrorBlock message={saveError} />}

      <div className="tf">
        <div className="tf-main">
          {/* ---------- Trade ---------- */}
          <Panel className="tf-panel" title="Trade">
            <div className="tf-g">
              <div className="tf-c6">
                <Field id="account" label="Account" required err={show('account')}>
                  <select className="j-select" {...wire('account', show('account'))} aria-required="true" value={f.account} onBlur={touch('account')} onChange={(e) => set({ account: e.target.value })}>
                    {!f.account && <option value="">Choose an account</option>}
                    {acctOptions.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
                  </select>
                </Field>
              </div>
              <div className="tf-c6">
                <Field id="symbol" label="Instrument" required err={show('symbol')}>
                  <input className="j-input mono tf-sym" {...wire('symbol', show('symbol'))} aria-required="true" list="tf-symbols" autoComplete="off" autoCapitalize="characters" spellCheck={false}
                    placeholder="NQ, MES, EURUSD" value={f.symbol} onBlur={touch('symbol')} onChange={(e) => set({ symbol: e.target.value })} />
                  <datalist id="tf-symbols">{symbols.map((s) => <option key={s} value={s} />)}</datalist>
                </Field>
              </div>

              <div className="tf-c6">
                <div className="j-field">
                  <span className="j-label" id="tf-side-l">Side <span className="tf-star" aria-hidden="true">*</span></span>
                  <Choice<Side> id="side" label="Side" big value={f.side} onChange={(v) => { set({ side: v }); touch('side')(); }}
                    invalid={!!show('side')} describedBy={show('side') ? 'tf-side-err' : undefined}
                    options={[{ key: 'long', label: 'Long', icon: <ArrowUpRight /> }, { key: 'short', label: 'Short', icon: <ArrowDownRight /> }]} />
                  {show('side') && <div className="j-err" id="tf-side-err" role="alert">{show('side')}</div>}
                </div>
              </div>
              <div className="tf-c6">
                <div className="j-field">
                  <span className="j-label" id="tf-status-l">Status</span>
                  <Choice<'open' | 'closed'> id="status" label="Status" big value={f.status} onChange={setStatus}
                    options={[{ key: 'open', label: 'Open' }, { key: 'closed', label: 'Closed' }]} />
                </div>
              </div>

              <div className="tf-c6">
                <Field id="session" label="Session">
                  <select className="j-select" id="tf-session" value={f.session} onChange={(e) => set({ session: e.target.value })}>
                    <option value="">Not set</option>
                    {SESSIONS.map((s) => <option key={s.key} value={s.key}>{s.label} · {s.window}</option>)}
                  </select>
                </Field>
              </div>
              <div className="tf-c6">
                <Field id="strategy" label="Strategy">
                  <select className="j-select" id="tf-strategy" value={f.strategy} onChange={(e) => set({ strategy: e.target.value })}>
                    <option value="">No strategy</option>
                    {stratOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              </div>

              <div className={f.status === 'closed' ? 'tf-c3' : 'tf-c6'}>
                <Field id="entryDate" label="Entry date" required err={show('entryDate')}>
                  <input type="date" className="j-input" {...wire('entryDate', show('entryDate'))} aria-required="true" value={f.entryDate} onBlur={touch('entryDate')} onChange={(e) => set({ entryDate: e.target.value })} />
                </Field>
              </div>
              <div className={f.status === 'closed' ? 'tf-c3' : 'tf-c6'}>
                <Field id="entryTime" label="Entry time" required err={show('entryTime')}>
                  <input type="time" className="j-input" {...wire('entryTime', show('entryTime'))} aria-required="true" value={f.entryTime} onBlur={touch('entryTime')} onChange={(e) => set({ entryTime: e.target.value })} />
                </Field>
              </div>
              {f.status === 'closed' && (
                <>
                  <div className="tf-c3">
                    <Field id="exitDate" label="Exit date" required err={show('exitDate')}>
                      <input type="date" className="j-input" {...wire('exitDate', show('exitDate'))} aria-required="true" value={f.exitDate} min={f.entryDate || undefined} onBlur={touch('exitDate')} onChange={(e) => set({ exitDate: e.target.value })} />
                    </Field>
                  </div>
                  <div className="tf-c3">
                    <Field id="exitTime" label="Exit time" required err={show('exitTime')}>
                      <input type="time" className="j-input" {...wire('exitTime', show('exitTime'))} aria-required="true" value={f.exitTime} onBlur={touch('exitTime')} onChange={(e) => set({ exitTime: e.target.value })} />
                    </Field>
                  </div>
                </>
              )}
            </div>
          </Panel>

          {/* ---------- Prices ---------- */}
          <Panel className="tf-panel" title="Prices" meta={pv != null ? `${baseSymbol(f.symbol)} · ${sign}${pv} a point` : f.symbol.trim() ? 'Result and risk are typed for this symbol' : undefined}>
            <div className="tf-g">
              {(() => {
                const col = f.status === 'closed' ? 'tf-c4' : 'tf-c3';
                const price = (k: 'entry' | 'exit' | 'size' | 'stop' | 'target', label: string, o: { required?: boolean; warn?: string; step?: string } = {}) => (
                  <div className={col}>
                    <Field id={k} label={label} required={o.required} err={show(k as FieldKey)} hint={o.warn ? <span className="tf-warn">{o.warn}</span> : undefined}>
                      <input type="number" inputMode="decimal" step={o.step ?? 'any'} className="j-input" {...wire(k, show(k as FieldKey), !!o.warn)} aria-required={o.required || undefined}
                        value={f[k]} onBlur={touch(k as FieldKey)} onChange={(e) => set({ [k]: e.target.value } as Partial<FormState>)} />
                    </Field>
                  </div>
                );
                return (
                  <>
                    {price('entry', 'Entry price', { required: true })}
                    {f.status === 'closed' && price('exit', 'Exit price', { required: true })}
                    {price('size', 'Size', { required: true })}
                    {price('stop', 'Stop', { warn: warn.stop })}
                    {price('target', 'Target', { warn: warn.target })}
                    <div className={col}>
                      <Field id="risk" label={`Risk amount (${cur})`} hint={autoHint(aRisk, f.risk, () => set({ risk: String(aRisk) }), '· saved if blank')}>
                        <input type="number" inputMode="decimal" step="any" className="j-input" {...wire('risk', undefined, aRisk != null)} min="0" value={f.risk} onChange={(e) => set({ risk: e.target.value })} />
                      </Field>
                    </div>
                    <div className={col}>
                      <Field id="commission" label={`Commission (${cur})`}>
                        <input type="number" inputMode="decimal" step="any" className="j-input" id="tf-commission" value={f.commission} onChange={(e) => set({ commission: e.target.value })} />
                      </Field>
                    </div>
                    <div className={col}>
                      <Field id="swap" label={`Swap (${cur})`}>
                        <input type="number" inputMode="decimal" step="any" className="j-input" id="tf-swap" value={f.swap} onChange={(e) => set({ swap: e.target.value })} />
                      </Field>
                    </div>
                    {f.status === 'closed' && (
                      <div className={col}>
                        <Field id="result" label={`Result (${cur})`} required err={show('result')} hint={autoHint(aRes, f.result, () => set({ result: String(aRes) }), 'before fees · saved if blank')}>
                          <input type="number" inputMode="decimal" step="any" className="j-input" {...wire('result', show('result'), aRes != null)} aria-required="true" value={f.result} onBlur={touch('result')} onChange={(e) => set({ result: e.target.value })} />
                        </Field>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </Panel>

          {/* ---------- Checklist ---------- */}
          <Panel className="tf-panel" title="Checklist" meta={<span className="j-num">{scoreText}</span>}>
            {items.length ? (
              <>
                <div className="j-track tf-score-track" role="img" aria-label={`Checklist score ${score.pct} percent`}><i style={{ width: `${score.pct}%` }} /></div>
                <ul className="tf-checks">
                  {[...items].sort((a, b) => (a.category ?? '~').localeCompare(b.category ?? '~')).map((c) => (
                    <li key={c.id}>
                      <label className="j-check tf-crow">
                        <input type="checkbox" checked={!!f.conf[c.id]} onChange={(e) => set({ conf: { ...f.conf, [c.id]: e.target.checked } })} />
                        <span className="tf-cname">
                          <span className="n">{c.name}</span>
                          {c.description && <span className="d">{c.description}</span>}
                        </span>
                        <span className="tf-ccat">{c.category ?? 'General'}{(c.weight ?? 1) !== 1 && <span className="j-num"> · ×{c.weight}</span>}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Empty>No checklist items yet. Add the things you need to see before an entry in Playbook.</Empty>
            )}
          </Panel>

          {/* ---------- Review ---------- */}
          <Panel className="tf-panel" title="Review">
            <div className="tf-review">
              <div className="j-field">
                <span className="j-label" id="tf-emotion-l">How did you feel going in</span>
                <div className="tf-chips" role="group" aria-labelledby="tf-emotion-l">
                  {EMOTIONS.map((x) => (
                    <button key={x} type="button" className="tf-chip" aria-pressed={f.emotion === x} onClick={() => set({ emotion: f.emotion === x ? '' : x })}>{cap(x)}</button>
                  ))}
                </div>
              </div>

              <div className="j-field">
                <span className="j-label" id="tf-mistake-l">Mistakes</span>
                <div className="tf-chips" role="group" aria-labelledby="tf-mistake-l">
                  {tags.map((x) => (
                    <button key={x} type="button" className="tf-chip" aria-pressed={f.mistakes.some((m) => m.tag === x)} onClick={() => toggleMistake(x)}>{x}</button>
                  ))}
                </div>
                {f.mistakes.length > 0 && (
                  <div className="tf-mrows">
                    {f.mistakes.map((m, mi) => (
                      <div key={m.tag} className="tf-mrow">
                        <span className="tf-mtag">{m.tag}</span>
                        <Choice<Severity> id={`sev-${mi}`} label={`Severity of ${m.tag}`} value={m.severity} onChange={(v) => patchMistake(m.tag, { severity: v })} options={SEVERITIES} />
                        <input className="j-input" aria-label={`Note on ${m.tag}`} placeholder="What happened (optional)" value={m.note} onChange={(e) => patchMistake(m.tag, { note: e.target.value })} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Field id="notes" label="Notes">
                <textarea className="j-textarea" id="tf-notes" placeholder="What did you see, what did you do, what would you change?" value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
              </Field>

              <div className="j-field">
                <span className="j-label" id="tf-shots-l">Screenshots</span>
                <div className="tf-shots">
                  {f.shots.map((s, i) => (
                    <div key={s.id} className="tf-shot">
                      <img src={s.url} alt={`Screenshot ${i + 1}`} loading="lazy" />
                      <button type="button" className="rm" aria-label={`Remove screenshot ${i + 1}`} onClick={() => removeShot(s.id)}><X /></button>
                    </div>
                  ))}
                  <button type="button" className="j-btn" id="tf-shots" aria-describedby="tf-shots-hint" aria-labelledby="tf-shots-l tf-shots" disabled={f.shots.length >= MAX_SHOTS} onClick={() => fileRef.current?.click()}>
                    <ImagePlus /> Add images
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden tabIndex={-1} onChange={(e) => addFiles(e.target.files)} />
                </div>
                <div className="j-hint" id="tf-shots-hint">Up to {MAX_SHOTS} images, 5 MB each · {f.shots.length} of {MAX_SHOTS} added{isDemo && f.shots.some((s) => s.file) ? ' · kept in this session only' : ''}</div>
                {shotError && <div className="j-err" role="alert">{shotError}</div>}
              </div>
            </div>
          </Panel>
        </div>

        {/* ---------- Summary ---------- */}
        <aside className="tf-side" aria-label="Summary">
          <Panel title="Summary" meta={equity != null ? <>Equity <span className="j-num">{money(equity, cur, { decimals: 0 })}</span></> : undefined}>
            <dl className="j-kv tf-kv">
              <dt>Planned R:R</dt><dd className="j-num">{rr != null ? `1 : ${dec2(rr)}` : '—'}</dd>
              <dt>Risk</dt><dd className="j-num">{effRisk != null ? money(effRisk, cur) : '—'}{riskPct != null && <span className="j-dim"> · {dec2(riskPct)}%</span>}</dd>
              <dt>Result</dt><dd className="j-num">{effRes != null ? <PnL v={effRes} currency={cur} /> : <span className="j-dim">{f.status === 'open' ? 'Open' : '—'}</span>}</dd>
              <dt>Result in R</dt><dd>{resultR != null ? <Signed v={resultR} digits={2} suffix="R" /> : <span className="j-dim">—</span>}</dd>
              <dt>Checklist</dt><dd className="j-num">{scoreText}</dd>
            </dl>
            {items.length > 0 && <div className="j-track tf-score-track" aria-hidden="true"><i style={{ width: `${score.pct}%` }} /></div>}
            <div className="tf-note" aria-live="polite">
              {!items.length ? null : !score.count ? (
                <p className="j-meta">Tick what you can see on the chart. Your score and what it has meant for you show here.</p>
              ) : insight ? (
                <p className={insight.warn ? 'tf-warn-line' : 'j-meta'}>{insight.text}</p>
              ) : null}
              {belowMin && strat && <p className="tf-warn-line">Planned {dec2(rr!)}R is under the {strat.min_risk_reward}R minimum in {strat.name}.</p>}
            </div>
            <div className="tf-actions">
              {attempted && errCount > 0 && <p className="j-err" role="alert">{errCount === 1 ? 'One field needs attention.' : `${errCount} fields need attention.`}</p>}
              <button type="submit" className="j-btn primary tf-save" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save trade'}</button>
              <button type="button" className="j-btn tf-cancel" onClick={cancel} disabled={saving}>Cancel</button>
              {editing && (
                <button type="button" className="j-btn danger tf-del" onClick={() => setDelOpen(true)} disabled={saving}><Trash2 /> Delete trade</button>
              )}
            </div>
          </Panel>
        </aside>
      </div>

      {/* phone: the summary collapses to a bar that stays in view */}
      <div className="tf-bar">
        <div className="tf-bar-fig">
          <span className="j-num tf-bar-score">{items.length ? `${score.pct}%` : '—'}</span>
          <span className="j-meta">{items.length ? `${score.count} of ${score.of} checked` : 'No checklist'}{rr != null ? ` · 1 : ${dec2(rr)}` : ''}</span>
        </div>
        <button type="submit" className="j-btn primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save trade'}</button>
      </div>

      <ConfirmDialog
        open={!!leave} onClose={() => setLeave(null)} onConfirm={confirmLeave}
        title={editing ? 'Discard your changes?' : leave?.discard ? 'Discard this draft?' : 'Leave without saving?'}
        confirmLabel={editing || leave?.discard ? 'Discard' : 'Leave'}
        body={editing ? 'The edits to this trade have not been saved.' : leave?.discard ? 'The trade you started will be cleared.' : 'Your draft stays on this device and will be here when you come back.'}
      />
      <ConfirmDialog
        open={delOpen} onClose={() => setDelOpen(false)} onConfirm={doDelete}
        title={existing ? `Delete ${existing.symbol} ${existing.trade_type} from ${isoDate(existing.entry_date)}?` : 'Delete trade?'}
        body="The trade, its checklist and its mistake tags are removed from your journal and from every report. This cannot be undone."
      />
    </form>
  );
}
