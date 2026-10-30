// /auth. Two panes: a read-only crop of the product on sample data, and one form that switches between
// sign in and create account. Behaviour mirrors the old screen: redirect when signed in (to where
// RequireAuth sent us from, else the dashboard), verification redirect after sign up, and the
// non-revealing message when an address is already registered.

import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { buildDemo } from '../demo';
import { equityCurve, summarize } from '../analytics';
import { money, pct, rMult } from '../format';
import { Kpis, Tabs } from '../ui/kit';
import { LineChart } from '../ui/charts';
import { Brand, Field, PasswordField } from '../auth/parts';

type Mode = 'signin' | 'signup';

/** Only follow same-site paths: "/trades/12", never "//evil.example" or a full URL. */
function safeFrom(from: unknown): string | null {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/auth') ? from : null;
}

function ProductCrop() {
  const sample = useMemo(() => {
    const d = buildDemo();
    const acc = d.accounts.find((a) => a.id === 'acc-eval') ?? d.accounts[0];
    const trades = d.trades.filter((t) => t.trading_account_id === acc.id);
    return { acc, summary: summarize(trades), curve: equityCurve(trades, acc.initial_balance) };
  }, []);
  const { acc, summary: s, curve } = sample;
  return (
    <figure data-ui className="auth-frag" aria-label="Sample data: equity curve and key figures">
      <div className="auth-frag-head">
        <h2>{acc.name}</h2>
        <span className="j-meta">Sample data</span>
      </div>
      <Kpis items={[
        { label: 'Net P&L', value: <span className="j-num">{money(s.net, acc.currency, { decimals: 0 })}</span>, note: `${s.count} closed trades` },
        { label: 'Win rate', value: <span className="j-num">{pct(s.winRate, 0)}</span>, note: `${s.wins} won, ${s.losses} lost` },
        { label: 'Average R', value: <span className="j-num">{rMult(s.avgR)}</span>, note: 'per trade' },
      ]} />
      <LineChart points={curve.map((p) => ({ t: p.t, v: p.v }))} height={232} currency={acc.currency} ariaLabel={`Equity curve of the sample account, ending at ${money(curve[curve.length - 1]?.v ?? 0, acc.currency, { decimals: 0 })}`} />
    </figure>
  );
}

export default function AuthPage() {
  const { user, signIn, signUp } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = safeFrom((loc.state as { from?: string } | null)?.from);

  const initial: Mode = /[?&](mode|tab)=(signup|register)/.test(loc.search) ? 'signup' : 'signin';
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (user) return <Navigate to={from ?? '/dashboard'} replace />;

  const switchMode = (m: Mode) => { setMode(m); setError(null); setNotice(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setNotice(null);
    if (mode === 'signin') {
      const { error: err } = await signIn(email, password);
      if (err) setError(err.message || 'Could not sign in.');
    } else {
      const { error: err } = await signUp(email, password, displayName);
      if (err) {
        // signUp answers an already-registered address with a neutral message, not an error to alarm about.
        if (/^If this email is not already registered/.test(err.message)) setNotice(err.message);
        else setError(err.message || 'Could not create the account.');
      } else {
        window.location.href = `/verify-email?email=${encodeURIComponent(email)}`;
        return;
      }
    }
    setLoading(false);
  };

  const signup = mode === 'signup';
  return (
    <div className="j-auth">
      <aside className="j-auth-side" aria-label="About IFVG Journal">
        <Brand />
        <div className="auth-side-mid">
          <ProductCrop />
        </div>
        <div>
          <p className="auth-side-copy">Log the trade, tick the checklist, tag the mistake. See where your edge is.</p>
          <p className="auth-side-note">Figures above are generated sample data, not a real account.</p>
        </div>
      </aside>

      <main className="j-auth-form">
        <div className="auth-pane">
          <Brand className="auth-brand-m" />
          <div className="auth-head">
            <h1>{signup ? 'Create your journal' : 'Sign in to your journal'}</h1>
            <p>{signup ? 'Free to start. Your trades stay yours.' : 'Pick up where your last session ended.'}</p>
          </div>

          <div>
            <Tabs<Mode> label="Account" value={mode} onChange={switchMode}
              items={[{ key: 'signin', label: 'Sign in' }, { key: 'signup', label: 'Create account' }]} />
          </div>

          <form onSubmit={submit} aria-label={signup ? 'Create account' : 'Sign in'}>
            {signup && <Field label="Full name" name="name" value={displayName} onChange={setDisplayName} autoComplete="name" disabled={loading} />}
            <Field label="Email" name="email" type="email" value={email} onChange={setEmail} autoComplete="email" disabled={loading} />
            <PasswordField
              label="Password" name="password" value={password} onChange={setPassword} disabled={loading} error={!!error}
              autoComplete={signup ? 'new-password' : 'current-password'} hint={signup ? 'Use at least 6 characters.' : undefined}
            />
            {!signup && <Link to="/forgot-password" className="auth-link" style={{ justifySelf: 'start' }}>Forgot password?</Link>}

            {error && <p className="auth-err" role="alert">{error}</p>}
            {notice && <p className="auth-msg" role="status">{notice}</p>}

            <div className="auth-actions">
              <button type="submit" className="j-btn primary" disabled={loading}>
                {loading ? (signup ? 'Creating account…' : 'Signing in…') : signup ? 'Create account' : 'Sign in'}
              </button>
              <div className="auth-or" aria-hidden="true">or</div>
              <button type="button" className="j-btn" onClick={() => nav('/dashboard?demo=1')}>Explore with sample data</button>
            </div>
          </form>

          <p className="auth-fine">
            By continuing you agree to the <Link to="/terms">Terms</Link>. See the <Link to="/refund">Refund policy</Link> for paid plans.
          </p>
        </div>
      </main>
    </div>
  );
}
