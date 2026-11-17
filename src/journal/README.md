# IFVG Journal — front-end system

A trading journal for futures/forex traders who work ICT / iFVG setups: log a trade, tick the checklist, tag
the mistakes, then review edge by session, setup, confluence score and behaviour. Style: **data terminal**, dark.

Everything signed-in renders inside `ui/Shell.tsx` (56px icon rail, top bar with account scope switcher,
⌘K search, *Log trade*, bottom bar on phones). Pages return their content only: no layout, no sidebar.
The one exception is `/onboarding`: a full-screen first-run flow (sign up → verify email by 6-digit code →
add account → import trades or "Import later"). `onboarding/OnboardingGate.tsx` sends a user with no account
and no `profiles.has_completed_onboarding` there from anywhere in the app, and sends finished users away from it.

Open any screen on sample data without signing in: `http://localhost:8080/<route>?demo=1`
(sticks via localStorage until "Exit sample data"). Demo writes stay in memory.
`?demo` is only read when the page first loads, so an in-app link must call `startDemo()` before navigating
(see `DemoLink` in `pages/Landing.tsx`): a router `<Link to="/dashboard?demo=1">` just lands on the sign-in page.

## Access: the journal is members-only

The journal comes with the Blue Pill course (https://blueprint.ifvg.in/bluepill, ₹499 a month + taxes); it is not sold
on its own. Quote the offer from `access/bluepill.ts`, never retype it. Everything signed-in sits behind
`access/PremiumGate` (in `RequireAuth`, `App.tsx`); sample data is the one public preview and never touches the database.

- Who has access (`useSubscription().isPremium`): an active Blue Pill purchase (`bluepill_memberships`, matched on the user's
  verified email by `my_bluepill_membership()`), or an active `subscribers` row (`subscribed` and not past `subscription_end`),
  or `profiles.premium_access_override` (admin grant, invitations), or `profiles.role = 'admin'`. Anyone else sees "The journal comes with the Blue Pill".
- A purchase reaches the journal through the `bluepill-webhook` edge function (Razorpay events, or a signed plain call for a
  manual grant/revoke), keyed by email so it works whether the buyer signs up before or after paying. Setup, event rules and
  the "I paid but cannot get in" checklist: `docs/bluepill-webhook.md`. Never write `bluepill_memberships` from the client.
- `isLoading` is only the first answer for the signed-in user; refreshes (every 5 min, on tab focus) are silent. Do not make
  the gate depend on anything that flips during a refresh, or the app unmounts under someone who is using it.
- A failed check is `checkFailed`, shown as "could not check", never as "no membership".
- The gate is the interface half. Users must not be able to write their own access: `supabase/migrations/20261116090000_lock_premium_grants.sql`
  removes their write policies on `subscribers` and locks `profiles.premium_access_override` to admins. Do not add a client-side
  upsert to `subscribers`; access is granted by an admin or the server (service role).

## The look (do not drift from it)

- One ground `#171719`; panels are **darker** than the ground (`--surface #131217`), no borders on panels, one soft shadow.
  Separation between rows is a 1px `--rule` line; between header and body, `--line`.
- Type: **Public Sans** for text, **JetBrains Mono** for every figure (price, P&L, counts, dates in tables, R).
  Use class `j-num` (or `j-mono`) on any figure that is not already inside a table/`.j-kpi-value`. Tabular, aligned right in columns.
- Sizes: page title 26/700 (`PageHeader`), panel title 16/600, body 13, meta 12, nothing under 11. Sentence case. No uppercase labels.
- **Selection = a 1px accent line as wide as its label** (rail item, tab, range option, selected table row, selected calendar day).
  Never a filled pill, never a coloured segmented control.
- Colour is for data: results use `--positive` / `--negative` (P&L columns, calendar tint, bars), the equity line is `--sig`
  (accent blue). Everything else is white or grey. Primary action = white pill (`j-btn primary`), one per screen.
- No gradients, glows, glass, emoji, icons in tinted squares, sparklines in KPIs, rainbow charts, zebra rows,
  icon-topped cards, "Welcome back". Icons are lucide outline, 16–18px, grey.
- Radius: cards 6px, controls full pill (`j-btn`) or 8px (inputs). Gap 24, canvas pad 32 (16–18 on phone).
- Tokens (in `journal.css :root`): `--ground --surface --raised --active --line --rule --control --text --text-2 --dim --sig
  --positive --negative --warning --pos-ink`. **Do not use `--border`, `--muted`, `--accent`: those belong to shadcn.**
- Class names are `j-` prefixed. Never use bare Tailwind-colliding names (`inline`, `grid`, `row`, `card`).

## Building a screen

```tsx
import { useJournal } from '../JournalProvider';
import { PageHeader, Panel, Kpis, Tabs, Range, PnL, Signed, Pill, Avatar, Empty, ErrorBlock, Dialog, ConfirmDialog, RankList } from '../ui/kit';
import { LineChart, DailyBars, Histogram, RLadder, Matrix } from '../ui/charts';
import * as A from '../analytics';       // pure functions over Trade[]
import { money, signed, pct, rMult, isoDate, timeHM, duration, price } from '../format';
```

- `PageHeader title sub actions` — every screen has exactly one h1. `sub` is one sentence about the data (the finding),
  never about the interface.
- Layout: `<div className="j-grid">` (12 columns) + `<Panel className="j-span-8" title meta action>`; spans 3–9, 12.
  Add `top` (`j-grid top`) to let panels keep their own height; otherwise cards in a row stretch and must share a bottom edge
  (balance the content; the inspector flags `ragged-row` and `panel-void`). `Panel className="col"` + a child `.pin` pins an action to the foot.
- KPI strip: `<Kpis items=[{label, value, unit?, note?, lead?, tone?}] />` (one divided container, 4–6 cells, first may be `lead`).
- Tables: plain `<table>` inside `<div className="j-table-wrap">`; `th.n`/`td.n` right-align; `td.id` for the identity column;
  `tr.j-click` + `aria-selected` for selectable rows; two-line cell = `td.two` with `<span className="j-sub">`.
  Below 860px hide the table (`j-table-m`) and render a two-line list (`j-list-m`) instead, as `Overview` and the Journal do.
- Forms: `.j-field > label + .j-input | .j-select | .j-textarea`, `.j-hint`, `.j-err`; `.j-check`, `.j-switch`. Label above field, 36px inputs.
  Native selects are styled (`j-select`); date/time are native inputs.
- States: loading = the final layout with `Skel` bars at real size (no spinner pages); empty = `Empty` inside the frame, one sentence;
  error = `ErrorBlock` inside the block with Retry. Zero prints as zero, missing as `—`.
- Every relative figure names its baseline ("vs prior 30D"). Totals are computed from the rows shown. Sample numbers must reconcile.
- Phone (<860px): grid collapses to one column automatically; tables → two-line lists; touch targets ≥ 40px; no horizontal page scroll.

## Data

`useJournal()` returns: `accounts trades strategies confluenceItems tradeConfluence mistakes transactions`, `loading error refresh`,
`isDemo userId`, the scope (`scope setScope scopeAccounts scopeTrades`), the period (`period setPeriod viewTrades`: scope + period),
`startBalance`, and `saveTrade(trade, {confluence, mistakes}) deleteTrade(id)`.
Types are in `types.ts` (mirrors `supabase/migrations`). `Trade.pnl` is the reported result; R = `A.rOf(t)` = pnl / risk_amount.
Tables not covered by the provider (strategies CRUD, confluence items, notes, accounts, transactions, mistake_tags, profiles) are written
directly with `supabase.from(...)` then `await refresh()`; when `isDemo` is true skip the network and tell the user the change is not saved
(or keep it in local state). Never call `supabase` in demo mode.

## Amounts follow the header switch ($ / % / hidden)

The top bar's `$ % ⌀` switch (`ui/Shell.tsx` → `ViewSwitcher`, state in `view.ts`, saved in localStorage) changes how every amount prints:
**money** `$1,240.00`, **percent** `+2.48%` of the starting balance, **hidden** `•••` with each result still green or red.
It only works if amounts go through the formatters; never build a currency string by hand.

- Amounts: `money()`, `signedMoney()` (no currency sign: calendar cells, heat maps), `compact()`, `<PnL>`. R multiples, counts and win rate use `signed`, `rMult`, `pct` and never change.
- Percent divides by the starting balance of the scope. When a figure belongs to one account (an account's page or row, a trade, the scope list) pass `{ base: account.initial_balance }` (`<PnL base>`, `<LineChart base>`).
- A result shown as a plain string in `<Kpis>` also gets `result: <number>`, so hidden view can colour it. A share of the account (drawdown as % of the start) goes through `unlessHidden()`.
- `useMemo` that builds text with these functions needs `useJournal().view` in its deps, or it keeps the old view.
- A figure the user is typing or confirming (balance dialog, onboarding, the form's "Auto" hint) pins `{ mode: 'money' }`. CSV export and anything saved never uses these functions.
- The landing page and sign-in preview always show money: wrap them in `<PlainFigures>` and import `moneyPlain` / `compactPlain`.

## Checking your work

```bash
npx tsc --noEmit -p tsconfig.app.json
export CHROME_PATH=/private/tmp/claude-502/-Users-arjun-s-Downloads-ifvg-journal/748419bb-fa82-4e18-a65a-8735c2232cf6/scratchpad/pw/browsers/chromium_headless_shell-1148/chrome-mac/headless_shell
node .claude/skills/design-taste-frontend/scripts/inspect.mjs --app "http://localhost:8080/<route>?demo=1" --out .taste-skill/inspect-<name>
```
(the dev server is already running on :8080; if not: `npx vite --port 8080 --host 127.0.0.1`). Open the screenshots it lists
(`desktop-fold.jpg`, `desktop-page-01.jpg`, `tablet-*.jpg`, `mobile-*.jpg`) and look. Fix every FAIL; defend every WARN.
`node .claude/skills/design-taste-frontend/scripts/lint.mjs --app <your files>` lints source.
Reference implementation of everything above: `pages/Overview.tsx`. Rules in full: `.claude/skills/design-taste-frontend/references/app-screens.md`.
