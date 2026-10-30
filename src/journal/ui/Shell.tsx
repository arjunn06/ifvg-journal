import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, CalendarDays, ChartNoAxesColumn, ChevronDown, Crosshair, LayoutGrid, LogOut, Plus, Search, Wallet, MoreHorizontal, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useJournal, exitDemo } from '../JournalProvider';
import { accountEquity } from '../analytics';
import { money, isoDate, initials } from '../format';
import { Avatar, Mark, hueFor, usePopover } from './kit';
import { QuickLogProvider, useQuickLog } from '../quicklog/QuickLog';

const NAV = [
  { to: '/dashboard', label: 'Overview', icon: LayoutGrid, match: ['/dashboard'] },
  { to: '/trades', label: 'Journal', icon: BookOpen, match: ['/trades'] },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, match: ['/calendar'] },
  { to: '/reports', label: 'Reports', icon: ChartNoAxesColumn, match: ['/reports'] },
  { to: '/playbook', label: 'Playbook', icon: Crosshair, match: ['/playbook'] },
  { to: '/accounts', label: 'Accounts', icon: Wallet, match: ['/accounts'] },
];

const isActive = (path: string, match: string[]) => match.some((m) => path === m || path.startsWith(m + '/'));

function ScopeSwitcher() {
  const { accounts, trades, transactions, scope, setScope, scopeAccounts } = useJournal();
  const { open, setOpen, ref } = usePopover();
  const active = accounts.filter((a) => a.is_active);
  const label = scope === 'all' ? `All accounts (${active.length})` : scopeAccounts[0]?.name ?? 'Account';
  const idx = scope === 'all' ? 0 : Math.max(0, accounts.findIndex((a) => a.id === scope));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="j-scope" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} aria-label="Switch account">
        <Avatar name={scope === 'all' ? 'All' : label} hue={scope === 'all' ? 220 : hueFor(idx)} />
        <span className="j-scope-name">{label}</span>
        <ChevronDown />
      </button>
      {open && (
        <div className="j-pop" style={{ top: 36, left: 0, minWidth: 300 }} role="listbox">
          <div className="j-grp">Scope</div>
          <button role="option" aria-checked={scope === 'all'} onClick={() => { setScope('all'); setOpen(false); }}>
            <Avatar name="All" hue={220} /> <span style={{ flex: 1 }}>All active accounts</span>
          </button>
          <div className="j-sep" />
          {accounts.map((a, i) => (
            <button key={a.id} role="option" aria-checked={scope === a.id} onClick={() => { setScope(a.id); setOpen(false); }} style={{ opacity: a.is_active ? 1 : 0.55 }}>
              <Avatar name={a.name} hue={hueFor(i)} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                <span className="j-meta">{a.is_prop_firm ? 'Prop' : a.account_type === 'paper' ? 'Paper' : 'Live'} · {money(accountEquity(a, trades, transactions), a.currency, { decimals: 0 })}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const { isPremium } = useSubscription();
  const { isDemo } = useJournal();
  const nav = useNavigate();
  const { open, setOpen, ref } = usePopover();
  const name = (user?.user_metadata?.display_name as string) || user?.email?.split('@')[0] || (isDemo ? 'Sample trader' : 'Account');
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="j-icon-btn" onClick={() => setOpen(!open)} aria-label="Account menu" aria-expanded={open} style={{ color: 'var(--text)', fontSize: 11, fontWeight: 600, background: 'var(--raised)' }}>
        {initials(name)}
      </button>
      {open && (
        <div className="j-pop" style={{ top: 40, right: 0 }}>
          <div className="j-grp" style={{ textTransform: 'none' }}>{isDemo ? 'Sample data' : user?.email}</div>
          {!isPremium && !isDemo && <button onClick={() => { setOpen(false); nav('/upgrade'); }}><Sparkles size={15} /> Upgrade</button>}
          {isDemo ? (
            <button onClick={exitDemo}><X size={15} /> Exit sample data</button>
          ) : (
            <button onClick={async () => { await signOut(); nav('/auth'); }}><LogOut size={15} /> Sign out</button>
          )}
        </div>
      )}
    </div>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const { trades, accounts } = useJournal();
  const { open: openLog } = useQuickLog();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pages = NAV.map((n) => ({ key: n.to, label: n.label, hint: 'Go to', to: n.to }));
    pages.push({ key: '/trades/new', label: 'Log a trade', hint: 'Action', to: '/trades/new' });
    if (!s) return pages;
    const tr = trades
      .filter((t) => t.symbol.toLowerCase().includes(s) || (t.notes ?? '').toLowerCase().includes(s) || isoDate(t.entry_date).includes(s))
      .slice(0, 8)
      .map((t) => ({ key: t.id, label: `${t.symbol} ${t.trade_type} · ${isoDate(t.entry_date)}`, hint: accounts.find((a) => a.id === t.trading_account_id)?.name ?? 'Trade', to: `/trades/${t.id}` }));
    return [...pages.filter((p) => p.label.toLowerCase().includes(s)), ...tr];
  }, [q, trades, accounts]);
  useEffect(() => setI(0), [q]);
  const go = (to: string) => { onClose(); if (to === '/trades/new') openLog(); else nav(to); };
  return (
    <div className="j-app" style={{ display: 'block', minHeight: 0, background: 'none' }}>
      <div className="j-scrim" onClick={onClose} />
      <div className="j-dialog j-palette" role="dialog" aria-modal="true" aria-label="Search" onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
        if (e.key === 'Enter' && items[i]) go(items[i].to);
      }}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbols, notes, dates, pages" aria-label="Search" />
        <div className="list j-pop" style={{ position: 'static', boxShadow: 'none', background: 'transparent' }}>
          {items.map((it, n) => (
            <button key={it.key} aria-selected={n === i} onMouseEnter={() => setI(n)} onClick={() => go(it.to)}>
              <span style={{ flex: 1, color: 'var(--text)' }}>{it.label}</span>
              <span className="j-meta">{it.hint}</span>
            </button>
          ))}
          {!items.length && <div className="j-meta" style={{ padding: 16 }}>No match for “{q}”.</div>}
        </div>
      </div>
    </div>
  );
}

export function Shell() {
  return <QuickLogProvider><ShellInner /></QuickLogProvider>;
}

function ShellInner() {
  const { pathname } = useLocation();
  const { open: openLog } = useQuickLog();
  const nav = useNavigate();
  const { isDemo } = useJournal();
  const [palette, setPalette] = useState(false);
  const more = usePopover();
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="j-app">
      <aside className="j-rail" aria-label="Primary">
        <NavLink to="/dashboard" className="j-mark" aria-label="IFVG Journal home"><Mark /></NavLink>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="j-navlink" aria-label={n.label} aria-current={isActive(pathname, n.match) ? 'page' : undefined}>
              <n.icon /><span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="j-main">
        <header className="j-topbar">
          <ScopeSwitcher />
          <span className="j-spacer" />
          <button className="j-search" onClick={() => setPalette(true)} aria-label="Search">
            <Search /> <span>Search trades and pages</span> <kbd>⌘K</kbd>
          </button>
          <button className="j-btn primary" onClick={openLog}><Plus /> <span className="lbl">Log trade</span></button>
          <UserMenu />
        </header>
        <main className="j-canvas">
          {isDemo && (
            <div className="j-notice" role="status">
              <span>Sample data. Nothing here is saved.</span>
              <button className="j-link" onClick={exitDemo}>Exit sample data</button>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      <nav className="j-bottom-bar" aria-label="Primary">
        {[NAV[0], NAV[1]].map((n) => (
          <NavLink key={n.to} to={n.to} aria-current={isActive(pathname, n.match) ? 'page' : undefined}><n.icon /><span>{n.label}</span></NavLink>
        ))}
        <button onClick={openLog} aria-label="Log a trade"><Plus /><span>Log</span></button>
        <NavLink to="/calendar" aria-current={isActive(pathname, ['/calendar']) ? 'page' : undefined}><CalendarDays /><span>Calendar</span></NavLink>
        <div ref={more.ref} style={{ position: 'relative', display: 'contents' }}>
          <button onClick={() => more.setOpen(!more.open)} aria-label="More" aria-expanded={more.open}><MoreHorizontal /><span>More</span></button>
          {more.open && (
            <div className="j-pop" style={{ position: 'fixed', right: 8, bottom: 68 }}>
              {[NAV[3], NAV[4], NAV[5]].map((n) => <button key={n.to} onClick={() => { more.setOpen(false); nav(n.to); }}><n.icon size={16} /> {n.label}</button>)}
            </div>
          )}
        </div>
      </nav>
      {palette && <Palette onClose={() => setPalette(false)} />}
    </div>
  );
}
