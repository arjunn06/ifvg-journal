# IFVG Journal — front-end system

A trading journal for futures/forex traders who work ICT / iFVG setups: log a trade, tick the checklist, tag
the mistakes, then review edge by session, setup, confluence score and behaviour. Style: **data terminal**, dark.

Everything signed-in renders inside `ui/Shell.tsx` (56px icon rail, top bar with account scope switcher,
⌘K search, *Log trade*, bottom bar on phones). Pages return their content only: no layout, no sidebar.

Open any screen on sample data without signing in: `http://localhost:8080/<route>?demo=1`
(sticks via localStorage until "Exit sample data"). Demo writes stay in memory.

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
