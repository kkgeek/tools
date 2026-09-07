# Release 5 — Design-handoff: app shell, Data Hub, Settings, live dashboard

*Shipped June–July 2026 (commits `c0ab0fa` … `5f717ca`). Implementation detail lives in CLAUDE.md Phases 13a–13aa (13y–13aa are the post-release bug batch below).*

This release implements the design handoff (`design/Wealth-Suite/design_handoff_wealth_suite/README.md`): one green/Roboto design system, a sidebar app shell with single-window navigation, a Data Hub as the single source of truth, a Settings page, and a dashboard whose every panel renders live data from the store.

## Theme (13a, 13k)
- `assets/theme.css` — shared token layer (handoff palette: green `#2E7D32` primary, Roboto/Roboto Mono, light + dark). Remaps the legacy `--md-sys-color-*` names so the shell and all vanilla tools repainted with no per-tool edits.
- `assets/tw-reskin.css` — re-points the 5 React tools' hardcoded Tailwind color utilities (blue/indigo → primary, emerald → positive, red → negative, amber → warning) at the tokens, so their internals match too and follow dark mode + accent automatically.
- Accent picker (green/blue/purple/teal) applies suite-wide via inline `--primary*` overrides (`localStorage['wealthSuite.accent']`).

## App shell + navigation (13b, 13c, 13f, 13l)
- `index.html` rebuilt as the handoff's sidebar shell: 240px collapsible sidebar (72px rail on desktop, off-canvas drawer ≤860px), 60px top bar (hamburger, title/date, theme cycle, household chip).
- **Single-window navigation**: hash router (`#tool.html`, sub-hash `#file.html#tab` supported) loads tools into an iframe — the sidebar never reloads. `suite.js` is embed-aware (skips its own topnav inside the shell). Cmd/Ctrl-click or "New tab ↗" still opens tools standalone.

## Data Hub (13d, 13g) — `data_hub.html`
Single source of truth (store schema v5: `accounts[]`, `otherAssets[]`):
- CSV holdings import: auto-map (Fidelity/Schwab/Vanguard/generic) → preview with New/Update/Check-acct status → commit; auto-registers accounts named in the CSV.
- Accounts registry, Other Assets, Liabilities (add/delete, persisted); Export Backup (full store JSON).
- Data-health strip, expense-import staleness, "Who Reads What" sync table.
- Data contract hardened: `holding.costBasis` is **per-share** ("…Total" CSV headers auto-divide), holdings carry `id`s, liabilities carry `type`.

## Settings (13e) — `settings.html`
Household profile (per-spouse birth year / target retire age), Scenarios (moved off the sidebar), Tax Profile (filing status, federal bracket, WA cap-gains excise), Appearance (theme / accent / currency / sidebar default), Alerts, Data Controls (export + two-step reset).

## Live dashboard (13f–13j) — every panel live-or-gated-sample
- KPI tiles: Total Net Worth, Investment Portfolio, Retirement Readiness, Monthly Spending.
- Net Worth Growth chart from daily snapshots (`localStorage['wealthSuite.nwHistory']`; accrues from daily visits; 1Y/3Y/5Y/All ranges).
- Asset Allocation donut from holdings by asset class.
- Retirement Readiness + Planning card: inline seeded 1,000-path Monte Carlo (success %, median at 85, retire year, real p10/p50/p90 fan chart).
- Spending vs Budget: per-category bars vs budgets, refunds netted.
- Performance table: real annualized returns from monthly adj-close history via the Cloudflare quote worker (actual-span annualization; benchmarks ^GSPC/VTI/VXUS; "—" where history doesn't reach).
- Empty store keeps the mockup's illustrative sample everywhere ("sample figures" ↔ "live from your data").

## New tool: Estate Plan (13m) — `estate_plan.html`
Extracted from the Retirement Master Plan's former Estate tab into its own standalone page (OBBBA federal exemption, WA estate tax SB 6347, millionaire tax, trust strategy, beneficiary audit). Sidebar entry + Retirement cluster sub-nav.

## Fixes (13l)
- **Asset & Cap-Gains was blank**: it loaded unpinned `@babel/standalone` (unpkg now serves Babel 8, which rejects raw `>` in JSX text). Pinned to 7.29.7 + escaped the text. *Gotcha: every React page must pin `@babel/standalone@7.29.7`.*
- Mobile: sidebar became an off-canvas drawer (previously covered the hamburger, untappable on phones).

## Removed from the home page
The old MD3 dashboard widgets (snapshot tiles, quick entry, scenario chips, AI chat, briefing) — along with per-section CSV export and Print Snapshot, which didn't survive the rebuild. Data entry lives in the Data Hub; scenarios and backups in Settings; the AI chat code remains in `assets/ai/` awaiting a new home (see backlog).

## Settings preferences consumed suite-wide (13n)
Settings stopped being write-only: `assets/suite.js` gained `fmtMoney()`
(honours `currencyFormat`) and `activeScenario()` helpers, consumed by
the household banner (scenario name, filing, tax year) and the
dashboard profile chip. Alert prefs wired in: `alerts.quarterlyTax` toggles
the Q2 tax banner, `alerts.staleData`/`staleDays` turn "live from your
data" into a stale-data warning. `fedBracket` seeds the Roth Conversion
Planner's target bracket; an active scenario's `targetRetireAge`/
`withdrawalRate` override the Roth/Monte Carlo adapters. Also fixed a
real bug: the dashboard called `store.subscribe(refreshAll)` with the
wrong arity, so cross-tab store edits never repainted it live.

## Data Hub polish (13o)
- **Column-mapping editor** in the CSV import preview — per-field column
  selects (Ticker/Shares/Cost basis/Account/Purchase date) plus a
  "lot total ÷ shares" checkbox, re-parsing live as you adjust it.
- **In-hub Refresh Prices** — same worker → query2 → query1 quote chain
  and 15-min cache as the Portfolio Tracker; updates `currentPrice`/
  `priceUpdatedAt` and recomputes `portfolio.totalValue`.
- **In-hub expense CSV import** — a real drop/browse zone mirroring
  `expenses.html`'s bank-format parser (Chase/Amex/Citi/generic),
  deduped against existing transactions, with an `importHistory` log.

## Estate Plan and Retirement Master Plan go live (13p, 13q)
- **Estate Plan** (`estate_plan.html`): estate size now uses the same
  net-worth formula as the dashboard; WA graduated estate tax over the
  $3M exclusion and federal 40% tax over the OBBBA thresholds ($30M
  MFJ / $15M single) compute live; the WA-vs-NV comparison table
  repositions its "← you" row to the matching tier. Empty store keeps
  the illustrative sample.
- **Retirement Master Plan** (`assets/adapters/retirement.js` v7): the
  remaining hardcoded copy (target-at-N header, buffer ladder, inflation
  schedule, savings roadmap) now derives from the store; `portAtRetire`
  includes future contributions; `window.runMC` and its charts are
  patched/re-labeled instead of showing a fixed $2.25M/age-62 sample.

## Purchase-date-aware Performance table (13r)
`holding.purchaseDate` (ISO, nullable) is now captured everywhere a
holding is created — Data Hub CSV import + mapping editor, and the
Portfolio Tracker's CSV import, add form, and an editable table column.
The dashboard's "Your Portfolio" row changed from a hypothetical
full-period backtest to a **monthly chain-linked, purchase-date-aware
return** — each lot enters the return calculation at its own purchase
month, and benchmark columns are clipped to the same window so the
comparison is apples-to-apples. No purchase date = old full-period
behavior.

## Shell cleanup and mobile fixes (13s, 13t)
Removed redundant topbar chrome (back/new-tab/theme-cycle/Import-Data
chips) and the sidebar's empty Review section now that navigation and
appearance settings live elsewhere. Fixed the mobile drawer: the Data
Hub promo / Settings / avatar footer was unreachable on phones (a
non-scrolling block clipped behind the browser's toolbar on `100vh`) —
moved inside the scrollable nav list with a `100dvh` fallback.

## Account names + tax-treatment tracking (13u)
`accounts[].taxTreatment` (`'Taxable' | 'Tax Free' | 'Tax Deferred'`) is
now tracked end-to-end: the Data Hub's registry has a Type/Tax-Treatment
select (inline-editable), the Portfolio Tracker captures an Account
field everywhere (CSV, add form, editable column with a registry
datalist) and shows a second tile row of Taxable/Tax Free/Tax Deferred
totals. Five follow-up fixes closed real gaps found in use: Account
Number vs. Account Name column collisions, "Tax Free"-named accounts
misclassified as Taxable, half-typed names getting auto-registered
mid-keystroke, an optional "Account Type" CSV column, and a self-heal
pass that re-guesses any un-curated account still stuck on the old
default whenever its name clearly signals otherwise.

## Dashboard chart rebuild (13v, 13w, 13x)
- **13v**: fixed a `growthAssumption` unit bug (the retirement Monte
  Carlo silently used 0.07% instead of 7% whenever the plan was
  populated), made Settings Reset and a new "Clear chart caches" button
  purge poisoned local caches, and made the NW Growth chart's range
  pills actually change the x-axis granularity instead of just
  re-windowing identical data.
- **13w**: replaced the NW Growth chart's daily-snapshot data source
  entirely — it now reconstructs value at each point from a background-
  downloaded, 24h-cached price history per held ticker (weekly points
  for 3mo, monthly to 1yr, quarterly beyond), respecting each lot's
  purchase date. Added a hover crosshair (value + date) shared with the
  retirement fan chart added next.
- **13x**: closed the last gap in the Retirement Planning card — Settings
  gained "Annual spending in retirement" and "Expected growth %/yr"
  inputs, the only two gate inputs that had no UI anywhere. The fan
  chart now renders full card width and gained the same hover crosshair
  ("Age N · median $X / p10 · p90").

With 13x, every dashboard panel is either live from the store or an
honestly-labeled sample explaining exactly which input is missing.

## Post-release bug batch (13y–13aa, 2026-09-07)
- **Data Hub headerless paste** (13y): a paste/CSV without a header row
  lost its first holding (eaten as the header) and never mapped Purchase
  Date / Account Name / Account Type. Bare rows are now detected and read
  positionally as Ticker, Shares, Cost Basis, Purchase Date, Account
  Name, Account Type; preview column renamed "Purchase Date".
- **Dashboard** (13z): the Spending vs Budget card now labels its sample
  state (static default + an explicit "no <Month> transactions yet" note
  when gated); the blank white panel under the footer was the hidden
  tool iframe still rendering (`.ws-frame[hidden]{display:none}`).
- **Net Worth tracker** (13aa): Assets card gets an icon + "Assets"
  title, "Stock Portfolio" rename, and both store-fed rows link to the
  Portfolio Tracker — routed through the shell's hash router when
  embedded (`nwGo()`, the pattern for future in-tool cross-links).
