import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';

const MAX_SHOTS = 3;
const MAX_SHOT_BYTES = 5 * 1024 * 1024;
interface Shot { id: string; url: string; file: File }
import { supabase } from '@/integrations/supabase/client';
import { useJournal } from '../JournalProvider';
import { accountEquity } from '../analytics';
import { money } from '../format';
import type { Side, Trade } from '../types';
import { MoodOrb } from './MoodOrb';
import { LOSS_REASONS, MOODS, R_CHIPS, WIN_NOTES, afterNote, moodAt, recentSymbols, sessionNow, usualRisk, type Result } from './logic';
import './quicklog.css';

const Ctx = createContext<{ open: () => void }>({ open: () => undefined });
export const useQuickLog = () => useContext(Ctx);

export function QuickLogProvider({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);
  const open = useCallback(() => setOn(true), []);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {on && createPortal(<QuickLog onClose={() => setOn(false)} />, document.body)}
    </Ctx.Provider>
  );
}

type Step = 'mode' | 'account' | 'pair' | 'side' | 'setup' | 'result' | 'size' | 'mood' | 'why' | 'save' | 'done';

function QuickLog({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const J = useJournal();
  const { accounts, trades, strategies, mistakes, scope, saveTrade, isDemo, userId } = J;
  const active = accounts.filter((a) => a.is_active);

  const [account, setAccount] = useState(() => (scope !== 'all' && active.some((a) => a.id === scope) ? scope : active[0]?.id ?? ''));
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<Side | null>(null);
  const [strategy, setStrategy] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [r, setR] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [mood, setMood] = useState(50);
  const [reasons, setReasons] = useState<string[]>([]);
  const [wins, setWins] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const [shots, setShots] = useState<Shot[]>([]);
  const [shotErr, setShotErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('mode');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState<{ id: string; text: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const acc = accounts.find((a) => a.id === account);
  const currency = acc?.currency ?? 'USD';
  const risk = useMemo(() => usualRisk(trades, account), [trades, account]);
  const symbols = useMemo(() => recentSymbols(trades.filter((t) => !account || t.trading_account_id === account)), [trades, account]);

  const askAccount = scope === 'all' && active.length > 1;
  const hasSetups = strategies.some((x) => x.is_active);
  const flow: Step[] = useMemo(
    () => ['mode', ...(askAccount ? ['account' as Step] : []), 'pair', 'side', ...(hasSetups ? ['setup' as Step] : []), 'result',
      ...(result === 'flat' ? [] : ['size' as Step]), 'mood', ...(result === 'flat' ? [] : ['why' as Step]), 'save'],
    [result, askAccount, hasSetups],
  );
  const idx = Math.max(0, flow.indexOf(step));

  // P&L: a typed amount wins; otherwise R times the usual risk.
  const typed = parseFloat(amount.replace(',', '.'));
  const pnl = result === 'flat' ? 0
    : Number.isFinite(typed) && typed > 0 ? (result === 'loss' ? -typed : typed)
    : r != null && risk ? Math.round(r * risk * 100) / 100 : null;
  const rShown = result === 'flat' ? 0 : r != null ? r : pnl != null && risk ? Math.round((pnl / risk) * 100) / 100 : null;
  const chosenReasons = LOSS_REASONS.filter((x) => reasons.includes(x.key));
  const clean = reasons.includes('clean');
  const customText = custom.trim().replace(/^./, (c) => c.toUpperCase());

  const can: Record<Step, boolean> = {
    mode: true, account: !!account, pair: !!symbol.trim(), side: !!side, setup: true, result: !!result,
    size: pnl != null && pnl !== 0, mood: true, why: result === 'win' ? true : reasons.length > 0 || !!customText, save: pnl != null, done: true,
  };
  const next = () => { const n = flow[idx + 1]; if (n) setStep(n); };
  /** After a one-tap answer, move on once the choice has been seen. */
  const advance = () => setTimeout(() => setStep((cur) => flow[flow.indexOf(cur) + 1] ?? cur), 170);
  const back = () => { const p = flow[idx - 1]; if (p) setStep(p); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  useEffect(() => { (box.current?.querySelector<HTMLElement>('[data-autofocus]') ?? box.current)?.focus({ preventScroll: true }); }, [step]);

  const pick = (res: Result) => { setResult(res); setR(null); setAmount(''); setReasons([]); setWins([]); setCustom(''); setTimeout(() => setStep(res === 'flat' ? 'mood' : 'size'), 140); };
  const toggleReason = (key: string) => setReasons((cur) => {
    if (key === 'clean') { setCustom(''); return cur.includes('clean') ? [] : ['clean']; }
    const without = cur.filter((x) => x !== 'clean');
    return without.includes(key) ? without.filter((x) => x !== key) : [...without, key];
  });

  const save = async () => {
    if (!acc || !side || !result || pnl == null) return;
    setSaving(true); setErr('');
    const m = moodAt(mood);
    const wentRight = WIN_NOTES.filter((x) => wins.includes(x.key)).map((x) => x.label);
    const parts = [
      note.trim(),
      result === 'loss' && (chosenReasons.length || customText) ? `What cost it: ${[...chosenReasons.map((x) => x.label), customText].filter(Boolean).join(', ')}.` : '',
      result === 'win' && (wentRight.length || customText) ? `What went right: ${[...wentRight, customText].filter(Boolean).join(', ')}.` : '',
      `Mood when taking it: ${m.label.toLowerCase()}.`,
    ].filter(Boolean);
    const now = new Date();
    const trade: Partial<Trade> = {
      trading_account_id: acc.id, symbol: symbol.trim().toUpperCase(), trade_type: side, status: 'closed',
      session: sessionNow(now), // a quick log has no prices or size: stored as NULL (needs migration 20261030120100)
      entry_price: null as unknown as number, quantity: null as unknown as number, exit_price: null, stop_loss: null, take_profit: null,
      entry_date: now.toISOString(), exit_date: now.toISOString(), pnl,
      risk_amount: risk ?? null, risk_reward_ratio: null, commission: null, swap: null,
      strategy_id: strategy, notes: parts.join('\n'), emotions: m.emotion, confluence_score: null, screenshots: null, source: 'quick',
    };
    const tags = [
      ...chosenReasons.filter((x) => x.tag).map((x) => ({ tag: x.tag!, severity: x.severity })),
      ...(result === 'loss' && customText ? [{ tag: customText.slice(0, 60), severity: 'medium' as const }] : []),
    ];
    try {
      const urls = await uploadShots();
      if (urls.length) trade.screenshots = urls;
      const text = afterNote({ result, trades, mistakes, accountId: acc.id, tags: tags.map((t) => t.tag), clean: clean && !customText, pnl, currency });
      const id = await saveTrade(trade, { mistakes: tags });
      setSaved({ id, text }); setStep('done');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally { setSaving(false); }
  };

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const next: Shot[] = [];
    let problem = '';
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) { problem = 'Only images can be attached.'; continue; }
      if (file.size > MAX_SHOT_BYTES) { problem = `${file.name || 'That image'} is over 5 MB.`; continue; }
      if (shots.length + next.length >= MAX_SHOTS) { problem = `Up to ${MAX_SHOTS} screenshots.`; break; }
      next.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, url: URL.createObjectURL(file), file });
    }
    setShotErr(problem);
    if (next.length) setShots((c) => [...c, ...next]);
  };
  const removeShot = (id: string) => setShots((c) => { const x = c.find((y) => y.id === id); if (x) URL.revokeObjectURL(x.url); return c.filter((y) => y.id !== id); });
  // paste a screenshot straight from the clipboard while the save step is open
  useEffect(() => {
    if (step !== 'save') return;
    const onPaste = (e: ClipboardEvent) => { const f = Array.from(e.clipboardData?.files ?? []).filter((x) => x.type.startsWith('image/')); if (f.length) { e.preventDefault(); addFiles(f); } };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });
  const uploadShots = async (): Promise<string[]> => {
    const out: string[] = [];
    for (const sh of shots) {
      // sample data never touches the network: the local preview stays on the in-memory trade
      if (isDemo) { out.push(sh.url); continue; }
      const ext = sh.file.name.split('.').pop() || 'png';
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
      const { error } = await supabase.storage.from('trade-screenshots').upload(path, sh.file);
      if (error) throw error;
      out.push(supabase.storage.from('trade-screenshots').getPublicUrl(path).data.publicUrl);
    }
    return out;
  };

  const resetForAnother = () => {
    shots.forEach((x) => URL.revokeObjectURL(x.url)); setShots([]); setShotErr('');
    setSymbol(''); setSide(null); setStrategy(null); setResult(null); setR(null); setAmount(''); setMood(50);
    setReasons([]); setWins([]); setCustom(''); setNote(''); setSaved(null); setErr(''); setStep(askAccount ? 'account' : 'pair');
  };

  const m = moodAt(mood);
  const resEmoji = result === 'win' ? '🏆' : result === 'loss' ? '💀' : '🤝';

  return (
    <div className="j-app ql-root" style={{ display: 'block', minHeight: 0, background: 'none' }}>
      <div className="j-scrim" onClick={onClose} />
      <div ref={box} tabIndex={-1} className={`ql ${step === 'mood' ? 'is-mood' : ''}`} role="dialog" aria-modal="true" aria-labelledby="ql-title" data-step={step}
        style={step === 'mood' ? { ['--mh' as string]: m.hue } : undefined}
        onKeyDown={(e) => { if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement) && step !== 'done' && step !== 'mode' && can[step]) { e.preventDefault(); step === 'save' ? save() : next(); } }}>
        <header className="ql-top">
          <button className="ql-circle" onClick={back} aria-label="Back" disabled={idx === 0 || step === 'done'} style={{ visibility: idx === 0 || step === 'done' ? 'hidden' : 'visible' }}><ArrowLeft /></button>
          <div className="ql-steps" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={flow.length - 1} aria-valuenow={step === 'done' ? flow.length - 1 : idx}>
            <i style={{ width: `${step === 'done' ? 100 : (idx / (flow.length - 1)) * 100}%` }} />
          </div>
          <button className="ql-circle" onClick={onClose} aria-label="Close"><X /></button>
        </header>

        <div className="ql-body" key={step}>
          {step === 'mode' && (
            <>
              <h2 id="ql-title">How do you want to journal this one?</h2>
              <div className="ql-cards">
                <button className="ql-card" onClick={next}>
                  <span className="e">⚡</span><b>Quick log</b><span>Pair, result and how you felt. About 20 seconds, no prices.</span>
                </button>
                <button className="ql-card" onClick={() => { onClose(); nav('/trades/new'); }}>
                  <span className="e">📝</span><b>Full journal</b><span>Prices, checklist, screenshots and the whole story.</span>
                </button>
              </div>
            </>
          )}

          {step === 'account' && (
            <>
              <h2 id="ql-title">Which account? 🏦</h2>
              <div className="ql-list" role="group" aria-label="Account">
                {active.map((a) => (
                  <button key={a.id} className={`ql-pick ${account === a.id ? 'on' : ''}`} aria-pressed={account === a.id} onClick={() => { setAccount(a.id); advance(); }}>
                    <b>{a.name}</b><span>{a.is_prop_firm ? 'Prop evaluation' : a.account_type === 'paper' ? 'Paper' : 'Live'}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'pair' && (
            <>
              <h2 id="ql-title">What did you trade? 📊</h2>
              <div className="ql-row" role="group" aria-label="Pair">
                {symbols.map((x) => <button key={x} className={`ql-chip big ${symbol === x ? 'on' : ''}`} aria-pressed={symbol === x} onClick={() => { setSymbol(x); advance(); }}>{x}</button>)}
              </div>
              <input data-autofocus={symbols.length ? undefined : true} className="ql-input wide ql-sym" value={symbols.includes(symbol) ? '' : symbol} placeholder={symbols.length ? 'Or type another pair' : 'Type the pair, e.g. NQ or EURUSD'}
                onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9._/-]/g, ''))} aria-label="Pair or symbol" maxLength={14} />
            </>
          )}

          {step === 'side' && (
            <>
              <h2 id="ql-title">{symbol}: long or short?</h2>
              <div className="ql-two" role="group" aria-label="Side">
                <button className={`ql-side long ${side === 'long' ? 'on' : ''}`} aria-pressed={side === 'long'} onClick={() => { setSide('long'); advance(); }}><span>📈</span> Long</button>
                <button className={`ql-side short ${side === 'short' ? 'on' : ''}`} aria-pressed={side === 'short'} onClick={() => { setSide('short'); advance(); }}><span>📉</span> Short</button>
              </div>
            </>
          )}

          {step === 'setup' && (
            <>
              <h2 id="ql-title">Which setup was it? 🎲</h2>
              <div className="ql-list" role="group" aria-label="Setup">
                {strategies.filter((x) => x.is_active).map((x) => (
                  <button key={x.id} className={`ql-pick ${strategy === x.id ? 'on' : ''}`} aria-pressed={strategy === x.id} onClick={() => { setStrategy(x.id); advance(); }}>
                    <b>{x.name}</b>{x.timeframe && <span>{x.timeframe}</span>}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'result' && (
            <>
              <h2 id="ql-title">How did it end? 🎬</h2>
              <div className="ql-cards three">
                <button className={`ql-card win ${result === 'win' ? 'on' : ''}`} onClick={() => pick('win')}><span className="e">🏆</span><b>Winner</b><span>Took money off the table</span></button>
                <button className={`ql-card loss ${result === 'loss' ? 'on' : ''}`} onClick={() => pick('loss')}><span className="e">💀</span><b>Loser</b><span>The market said no</span></button>
                <button className={`ql-card flat ${result === 'flat' ? 'on' : ''}`} onClick={() => pick('flat')}><span className="e">🤝</span><b>Breakeven</b><span>In and out, nothing lost</span></button>
              </div>
            </>
          )}

          {step === 'size' && result && (
            <>
              <h2 id="ql-title">{result === 'win' ? 'How much did it pay? 💰' : 'How deep was the damage? 🩹'}</h2>
              {risk ? (
                <>
                  <div className="ql-row" role="group" aria-label="Result in R">
                    {R_CHIPS[result].map((x) => (
                      <button key={x} className={`ql-chip big ${r === x && !amount ? 'on' : ''}`} aria-pressed={r === x && !amount}
                        onClick={() => { setR(x); setAmount(''); }}>{x > 0 ? '+' : '−'}{Math.abs(x)}R</button>
                    ))}
                  </div>
                  <p className="ql-help">1R is your usual risk on {acc?.name}: <b className="j-num">{money(risk, currency, { decimals: 0 })}</b></p>
                </>
              ) : (
                <p className="ql-help">No history on {acc?.name} yet, so type the amount.</p>
              )}
              <label className="ql-amount">
                <span>{risk ? 'Or the exact amount' : 'Amount'}</span>
                <input data-autofocus={risk ? undefined : true} inputMode="decimal" className="ql-input wide j-num" placeholder="0.00" value={amount}
                  onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.,]/g, '')); setR(null); }} aria-label={`Amount ${result === 'loss' ? 'lost' : 'won'} in ${currency}`} />
              </label>
              <div className={`ql-result ${pnl == null ? '' : pnl >= 0 ? 'pos' : 'neg'}`} aria-live="polite">
                {pnl == null ? 'Pick a size above' : <><b className="j-num">{money(pnl, currency, { sign: true })}</b>{rShown != null && risk ? <span className="j-num">{rShown > 0 ? '+' : rShown < 0 ? '−' : ''}{Math.abs(rShown)}R</span> : null}</>}
              </div>
            </>
          )}

          {step === 'mood' && (
            <>
              <h2 id="ql-title">How were you feeling when you took it?</h2>
              <MoodOrb value={mood} onChange={setMood} />
            </>
          )}

          {step === 'why' && result === 'loss' && (
            <>
              <h2 id="ql-title">What cost you the trade? 🔍</h2>
              <p className="ql-help">Be honest, nobody is watching. Pick all that apply.</p>
              <div className="ql-grid" role="group" aria-label="What cost the loss">
                {LOSS_REASONS.map((x, i) => (
                  <button key={x.key} className={`ql-reason ${reasons.includes(x.key) ? 'on' : ''} ${x.key === 'clean' ? 'clean' : ''}`} aria-pressed={reasons.includes(x.key)} onClick={() => toggleReason(x.key)}>
                    <span className="e">{x.emoji}</span><b>{x.label}</b><span>{x.hint}</span>
                  </button>
                ))}
              </div>
              <label className="ql-amount">
                <span>✍️ Something else? <i>in your own words</i></span>
                <input className="ql-input wide" maxLength={60} value={custom} placeholder="Froze, fat-fingered the order, news spike…"
                  onChange={(e) => { setCustom(e.target.value); if (e.target.value && reasons.includes('clean')) setReasons((c) => c.filter((x) => x !== 'clean')); }} />
              </label>
            </>
          )}

          {step === 'why' && result === 'win' && (
            <>
              <h2 id="ql-title">What went right? ✨</h2>
              <p className="ql-help">Optional. Repeating what works is half of the job.</p>
              <div className="ql-grid" role="group" aria-label="What went right">
                {WIN_NOTES.map((x, i) => (
                  <button key={x.key} className={`ql-reason win ${wins.includes(x.key) ? 'on' : ''}`} aria-pressed={wins.includes(x.key)}
                    onClick={() => setWins((c) => (c.includes(x.key) ? c.filter((y) => y !== x.key) : [...c, x.key]))}><span className="e">{x.emoji}</span><b>{x.label}</b></button>
                ))}
              </div>
              <label className="ql-amount">
                <span>✍️ Something else? <i>in your own words</i></span>
                <input className="ql-input wide" maxLength={80} value={custom} placeholder="Scaled out at the high, waited for the retest…" onChange={(e) => setCustom(e.target.value)} />
              </label>
            </>
          )}

          {step === 'save' && (
            <>
              <h2 id="ql-title">Ready to log it? 📓</h2>
              <div className="ql-sum">
                <span className="e">{resEmoji}</span>
                <div>
                  <b>{symbol} {side}</b>
                  <span className="j-num">{pnl != null ? money(pnl, currency, { sign: true }) : ''}{rShown != null && risk && result !== 'flat' ? ` · ${rShown > 0 ? '+' : rShown < 0 ? '−' : ''}${Math.abs(rShown)}R` : ''}</span>
                </div>
                <div className="r">
                  <span>{m.emoji} {m.label}</span>
                  {result === 'loss' && <span>{[...chosenReasons.map((x) => x.emoji), ...(customText ? ['✍️'] : [])].join(' ')}</span>}
                </div>
              </div>
              <label className="ql-amount">
                <span>One line to remember it by <i>optional</i></span>
                <textarea data-autofocus className="ql-input wide" rows={2} maxLength={240} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sweep, shift, iFVG retest, then I hesitated…" />
              </label>
              <div className="ql-shots">
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                {shots.map((x) => (
                  <span key={x.id} className="ql-shot"><img src={x.url} alt="Attached screenshot" /><button type="button" onClick={() => removeShot(x.id)} aria-label="Remove screenshot"><X /></button></span>
                ))}
                {shots.length < MAX_SHOTS && (
                  <button type="button" className="ql-add" onClick={() => fileRef.current?.click()} aria-describedby="ql-shot-hint">
                    <span>📸</span> {shots.length ? 'Add another' : 'Add a screenshot'}
                  </button>
                )}
              </div>
              <p className="ql-help" id="ql-shot-hint" style={{ marginTop: -10 }}>{shotErr || `Optional. Up to ${MAX_SHOTS} images, 5 MB each. You can also paste one.`}</p>
              {err && <p className="j-err" role="alert">{err}</p>}
            </>
          )}

          {step === 'done' && saved && (
            <div className="ql-done">
              <div className="burst" aria-hidden="true">{[result === 'win' ? '🎉' : '📓', '✨', result === 'win' ? '🏆' : '💪', '✨', '🎯'].map((e, i) => <span key={i} style={{ ['--i' as string]: i }}>{e}</span>)}</div>
              <h2 id="ql-title">Logged ✅</h2>
              <p>{saved.text}</p>
            </div>
          )}
        </div>

        <footer className="ql-foot">
          {step === 'mode' && null}
          {step === 'pair' && symbol && !symbols.includes(symbol) && <button className="ql-next" onClick={next}>Continue</button>}
          {step === 'setup' && <button className="ql-ghost" onClick={() => { setStrategy(null); next(); }}>Skip, I'll add it later</button>}
          {['size', 'mood'].includes(step) && <button className="ql-next" disabled={!can[step]} onClick={next}>Continue</button>}
          {step === 'why' && <button className="ql-next" disabled={!can.why} onClick={next}>{result === 'win' && wins.length === 0 && !customText ? 'Skip' : 'Continue'}</button>}
          {step === 'save' && <button className="ql-next" disabled={saving || !can.save} onClick={save}>{saving ? 'Saving…' : 'Save to journal'}</button>}
          {step === 'done' && saved && (
            <div className="ql-two">
              <button className="ql-ghost" onClick={() => { onClose(); nav(`/trades/edit/${saved.id}`); }}>Add the details</button>
              <button className="ql-next" onClick={resetForAnother}>Log another</button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
