# CLAUDE.md — Wealth Suite

Modular personal-finance hub: 5 single-file HTML tools unified under a
Material Design 3 dashboard. **No build step.** Tailwind/React/D3 via
CDN where used. Deploys to GitHub Pages on every push to `main` via
`.github/workflows/pages.yml`.

End-user docs: [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) —
read first if unfamiliar with the suite.

**Backlog / resume point: [`docs/BACKLOG.md`](docs/BACKLOG.md)** — the
ordered list of what's next plus known issues. When resuming work with
no specific instruction, start there. Release-level feature log:
[`docs/releases/release-5.md`](docs/releases/release-5.md) summarizes
the Phase 13 design-handoff arc recorded in detail below.

## Tools (11 modules)

| File | Stack | Adapter |
|---|---|---|
| `TaxEstimatorV5.html` | React 18 + Tailwind + Babel inline | `assets/adapters/tax.js` (bidirectional with `taxSuiteInputs_v2`) |
| `TaxAssetCalcv4.html` | React 18 + Tailwind + D3 | `assets/adapters/asset.js` (opt-in "Apply" buttons) |
| `retirement_master_plan_2.html` | Vanilla JS + custom CSS vars | `assets/adapters/retirement.js` (RMD slider ↔ store; seeds projection chart from portfolio.totalValue + annualExpenses) |
| `portfolio_review.html` | Vanilla JS + custom CSS vars | `assets/adapters/portfolio.js` (DOM parse on load; scales Target Allocation table from portAtRetire; updates buffer target from annualExpenses) |
| `golden_ratio_portfolio_dashboard.html` | Vanilla JS + artifact tokens | `assets/adapters/golden.js` (read-only: seeds sI from portfolio.totalValue, sW from annualExpenses/totalValue) |
| `roth_conversion.html` | React 18 + Tailwind + Babel inline | `assets/adapters/roth.js` (read-only seed via `window.__rothSeed`) |
| `portfolio_tracker.html` | React 18 + Tailwind + D3 + Babel inline | `assets/adapters/tracker.js` (store bootstrap; component handles its own reads/writes) |
| `social_security.html` | Vanilla JS + Chart.js | `assets/adapters/ss.js` (seeds current age from household.spouses) |
| `net_worth.html` | Vanilla JS + Chart.js | — (reads/writes store directly; schema v2 liabilities) |
| `monte_carlo.html` | Vanilla JS + Chart.js | `assets/adapters/mc.js` (seeds sim params from store) |
| `expenses.html` | React 18 + Tailwind + Chart.js + Babel inline | `assets/adapters/expenses.js` (store bootstrap; component reads/writes `expenses` directly, localStorage fallback standalone; tab deep-links via `#month/#transactions/#trend`) |

## Suite shell

- `index.html` — MD3 dashboard. Snapshot widget (5 tiles) +
  Export/Import/Reset action chips + module grid.
- `assets/suite.css` — MD3 tokens, snapshot tiles, action buttons.
- `assets/suite.js` — theme cycler + sticky topbar injection.
  **Critical**: extends `window.WealthSuite` via `Object.assign`
  (never reassign with `=` — would clobber `.store`).
- `assets/suite-state.js` — central store at `window.WealthSuite.store`.
  API: `.get/.set/.update/.subscribe/.export/.import/.reset`. Persists
  to `localStorage.wealthSuite.state`. Cross-tab sync via `storage`
  event. Schema versioned at `meta.version: 1`. `reset()` leaves
  `meta.lastUpdated: null` so dashboard renders empty state.
- `assets/dashboard.js` — Snapshot widget + Export/Import/Reset
  handlers + transient aria-live status line.
- `assets/adapters/*.js` — one file per tool that wires the tool to
  the store **without modifying the tool's internals**.

## Suite store schema (v1, per-spouse)

```js
{
  meta: { version: 1, lastUpdated, lastEditedBy: 'tax'|'retirement'|'portfolio'|'asset'|'import'|'reset' },
  household: { filingStatus: 'mfj'|'single', spouses: [{name,age},{name,age}], location: { state: 'WA' } },
  income: { salary:{s1,s2}, bonus:{s1,s2}, rsuVests:{s1,s2}, capitalGains:{shortTerm,longTerm} },
  retirement: {
    contributions: { traditional401k:{s1,s2}, roth401k:{s1,s2}, afterTax401k:{s1,s2}, catchup:{s1,s2}, ira:{s1,s2}, hsa },
    balances: { total, breakdown: {} },
    plan: { targetRetireAge, annualExpenses, growthAssumption },
  },
  portfolio: { totalValue, allocations: {}, holdings: [] },
  deductions: { method: 'standard'|'itemized', mortgage, salt, charitable },
  preferences: { taxYear },
}
```

Per-spouse `{s1,s2}` was chosen over a normalized `people[]` array.
Bumping `version` requires a migration step in `migrate()` in
`suite-state.js`.

## Adapter pattern

1. Read suite store on load. Decide who's authoritative this session
   (this tool vs another via `meta.lastEditedBy`).
2. If suite has data from another tool → seed THIS tool from suite.
   Else mirror this tool's state into suite.
3. Subscribe to store changes → re-render any household banner; show
   "stale data" indicator when appropriate.
4. Optionally write back to suite on local edits (debounce ~250ms,
   dedup against echo writes).
5. Tool's own UI/state code is NEVER modified. Adapter is the only
   contact surface.

Reference adapters: `tax.js` (most complex — bidirectional with React
+ setItem patch), `retirement.js` (slider mirror), `portfolio.js`
(DOM parse one-shot), `asset.js` (rAF-throttled MutationObserver +
opt-in apply).

## Cache-buster cadence

Every shared asset has `?v=N` on its `<script>` / `<link>` tag in
every HTML page that references it. Bump `?v=N+1` whenever you change
the file content; update the version in EVERY HTML page that
references it (Python http.server sends no cache headers, so stale
copies serve indefinitely otherwise).

End of Phase 2:
- `assets/suite-state.js?v=4`
- `assets/suite.js?v=3`
- `assets/suite.css?v=5` (only index.html on v=5; tools on v=3)
- `assets/dashboard.js?v=6` (index.html only)
- `assets/adapters/tax.js?v=4` (TaxEstimatorV5.html only)
- `assets/adapters/retirement.js?v=3` (retirement_master_plan_2.html only)
- `assets/adapters/portfolio.js?v=3` (portfolio_review.html only)
- `assets/adapters/asset.js?v=5` (TaxAssetCalcv4.html only)

Phase 3 additions:
- `assets/adapters/golden.js?v=1` (golden_ratio_portfolio_dashboard.html only)
- `assets/adapters/retirement.js?v=4` (retirement_master_plan_2.html only)
- `assets/adapters/portfolio.js?v=4` (portfolio_review.html only)
- `assets/suite.css?v=8` (index.html only — v=4 on all tool pages after dark-mode extension)
- `assets/dashboard.js?v=8` (index.html only — adds CSV section export)

Phase 4 P1 additions:
- `assets/suite.js?v=4` (all pages — adds Roth to MODULES registry)
- `assets/adapters/roth.js?v=1` (roth_conversion.html only)

Phase 4 P2 additions:
- `assets/suite.js?v=5` (all pages — adds Tracker to MODULES registry)
- `assets/adapters/tracker.js?v=1` (portfolio_tracker.html only)

Phase 5 additions:
- `assets/suite.js?v=6` (all pages — adds SS to MODULES registry)
- `assets/adapters/ss.js?v=1` (social_security.html only)

Phase 6 additions (P3 — compact mode + P3 completions):
- `assets/suite.css?v=10` (index.html only — adds compact entry panel styles)
- `assets/dashboard.js?v=12` (index.html only — adds Quick entry compact panel)

Phase 7 additions (Monte Carlo):
- `assets/suite.js?v=9` (all pages — adds Monte Carlo to MODULES registry)
- `assets/adapters/mc.js?v=1` (monte_carlo.html only)

Phase 8 additions (cluster nav + MD3 unification):
- `assets/suite.js?v=10` (all pages — CLUSTERS registry, two-tier topnav)
- `assets/suite.css?v=12` (index.html) / `?v=6` (tool pages) — sub-nav,
  semantic `--status-*` vars, Inter font

Phase 9 additions (Expense Tracker):
- `assets/suite-state.js?v=6` (all pages — schema v3: `expenses` block)
- `assets/suite.js?v=11` (all pages — adds Expenses to Tracking cluster)
- `assets/dashboard.js?v=13` (index.html only — "Spend this month" tile)
- `assets/adapters/retirement.js?v=6` (retirement_master_plan_2.html only —
  "Adopt actual spend" pill from trailing-12-mo Expense Tracker average)
- `assets/adapters/expenses.js?v=1` (expenses.html only)

Phase 10 additions (daily briefing, computed layer):
- `assets/ai/briefing.js?v=2` (index.html only — renders into
  `#suite-briefing`; Yahoo benchmark + holdings quotes, sessionStorage
  series cache 15 min, same-day stale fallback in
  `localStorage.wealthSuite.briefingStats`, outage note card on total
  outage)
- `assets/suite.css?v=13` (index.html only — `.suite-briefing__*` styles)

Phase 11 additions (GenAI chat):
- `assets/suite-state.js?v=7` (all pages — schema v4: `preferences.aiProvider`
  'off'|'gemini'|'local'; Gemini key deliberately NOT in store — export()
  would leak it — lives at `localStorage['wealthSuite.aiKey']`)
- `assets/ai/chat.js?v=1` (index.html only — chat panel in `#suite-chat`;
  GeminiProvider = gemini-2.5-flash with native function calling over a
  9-tool read-only store registry; WebLLMProvider = Llama-3.2-3B via
  esm.run/@mlc-ai/web-llm lazy import, grounds by stuffing all tool slices
  into the system prompt instead of tool calls; history in sessionStorage)
- `assets/ai/briefing.js?v=3` (index.html only — Gemini 2-sentence
  narrative when provider is 'gemini', cached per trading day in
  `localStorage.wealthSuite.briefingNarrative`)
- `assets/suite.css?v=14` (index.html only — `.suite-chat__*` styles +
  `.suite-briefing__narrative`)

Phase 12 additions (chat polish):
- `assets/ai/chat.js?v=2` (index.html only — conversation export/import
  as JSON, "Open: <tool>" deep-link chips derived from tools used in an
  answer, store-conditioned suggested-prompt daily rotation, settings
  modal focus trap + Esc close + focus restore, `role="log"` live region)
- `assets/suite.css?v=15` (index.html only — `.suite-chat__open` link
  chip + focus-visible outlines on chat buttons/links/inputs)

Phase 13 additions (design-handoff retheme — step 1 of
`design/Wealth-Suite/design_handoff_wealth_suite/README.md`):
- `assets/theme.css?v=1` (ALL pages — linked immediately AFTER
  `suite.css` so it wins the `:root` cascade). New shared theme layer:
  ships the handoff design tokens (`--bg`/`--surface`/`--primary` green
  `#2E7D32`/`--text`… + light & dark) and REMAPS the legacy
  `--md-sys-color-*` / `--status-*` names onto them via `var()`, so the
  injected shell topbar + every vanilla tool (which already consume
  those vars) repaint to the new look with no per-tool edits. Also
  `@import`s Roboto / Roboto Mono and sets the base UI font.
  Load-order is load-bearing: legacy remaps share `:root` specificity
  with suite.css and rely on being declared later. The 5 Tailwind tools
  (portfolio_tracker, expenses, TaxEstimatorV5, roth_conversion,
  TaxAssetCalcv4) pick up the topbar + page chrome only; their internal
  utility-class colours still need the deferred pixel-perfect reskin
  (handoff steps 2–4).

Phase 13b (app-shell rebuild — the new Dashboard home):
- `index.html` rebuilt from the horizontal cluster-topnav into the
  design-handoff **sidebar app shell** (Dashboard.dc.html): 240px
  collapsible sidebar (↔72px icon rail, `html[data-ws-collapsed="1"]`,
  persisted in `localStorage['ws-shell-nav']`) with logo header +
  TRACK / PLAN / OPTIMIZATION TOOLS / REVIEW nav sections + Data Hub
  promo/Settings/avatar footer; 60px top bar with hamburger, page
  title + date, theme cycle button, household profile chip.
- **index.html deliberately no longer loads `assets/suite.js`** — it
  owns its own shell + inline theme cycler (same `wealthSuite.themePreference`
  key, so preference stays in sync with tool pages). Nav items are plain
  `href` links to the tool pages (multi-page, not the mockup's iframe
  SPA). All tool pages still load suite.js and its injected topnav,
  untouched. Shell styles are inline in index.html (not suite.css) to
  avoid a suite-wide cache-buster bump.
- The full `Dashboard.dc.html` content is now recreated in `.ws-content`
  with the mockup's **placeholder** figures (per the handoff: "all
  numbers shown are placeholder; real values come from the user's
  data"): page header + Customize/Add Entry, 4-tile KPI row, Net Worth
  Growth multi-line SVG chart, Asset Allocation 3D pie, Performance
  table (built by an inline script mirroring the mockup's `renderVals`
  — annualized rates × comparison basis, leader highlighting), the
  Retirement/Monte-Carlo fan chart + stat tiles, Spending-vs-Budget
  bars, and the Q2 tax-alert banner. Every card carries a
  `data-ws-metric` hook so the computed layer (handoff step 4, fed by
  the Data Hub) can target and populate it with real values.
- Because the content is the mockup (not the old widget set),
  `index.html` **no longer loads `dashboard.js` or `chat.js`** — only
  `suite-state.js` (for the household profile chip / future wiring).
  This dropped the old dashboard's Export/Import/CSV/Reset, scenario
  chips, quick-entry panel, and AI chat from the home page; that data
  management migrates to the Data Hub (step 2) / Settings (step 3), and
  chat can be re-homed later. The top-bar "Import Data" / "Add Entry" /
  "Customize" buttons are placeholders (titled "coming with the Data
  Hub") until step 2 wires them.
- Site Map / Data Hub / Settings render as visible but non-navigating
  "Soon" items until handoff steps 2–3 build those pages.

Phase 13c (single-window navigation — tools open inside the shell):
- `index.html` gained a hash-based router: clicking any in-suite tool
  link loads that tool into a full-height `<iframe id="ws-frame">` inside
  the persistent shell, so the sidebar + top bar **never reload** and the
  collapse state truly stays put during navigation. Route = `#<file.html>`
  (deep-linkable, native back/forward via `hashchange`). Top bar swaps to
  "← Dashboard · <tool title> · New tab ↗" when a tool is open. A
  delegated `click` handler routes any `a[href$=".html"]` that maps to a
  known tool (sidebar items, dashboard cross-link chips, the tax-alert
  CTA); Cmd/Ctrl/middle-click and the "New tab" chip still open the tool
  standalone.
- `assets/suite.js?v=12` (ALL tool pages — bumped from v=11): now
  detects when it is embedded (`window.self !== window.top`) and, if so,
  **skips its own topnav injection** and zeroes `body.paddingTop` so the
  tool renders flush inside the shell with no double chrome / no gap.
  Also added a `storage` listener so a theme change in the shell (or any
  tab) re-applies live in the embedded tool. index.html still does NOT
  load suite.js.
- Follow-up: the tool pages still work standalone (opened directly, they
  render their own topnav as before) — only the embedded case changes.

Phase 13d (Data Hub — handoff step 2):
- `data_hub.html` (NEW) — the "single source of truth" page from
  Data Hub.dc.html, rendered in the shell (route `#data_hub.html`; the
  sidebar promo, top-bar "Import Data", and dashboard "Add Entry" all
  point here). Loads suite.css/theme.css + suite.js?v=12 (embed-aware)
  + suite-state.js?v=8. Functional and store-backed:
  - **Export Backup** downloads `store.export()` as JSON (restores the
    backup path dropped from the dashboard).
  - **Import Stock Assets** — CSV upload / drag-drop / paste → auto-maps
    Ticker/Shares/Cost Basis/Account columns (Fidelity/Schwab/Vanguard/
    generic headers) → preview with per-row New/Update/Check-acct status
    → Commit merges into `portfolio.holdings[]` by ticker+account,
    recomputes `portfolio.totalValue`, and auto-registers any unknown
    accounts named in the CSV.
  - **Accounts Registry** (`accounts[]`), **Other Assets**
    (`otherAssets[]`), **Liabilities** (`liabilities.items[]`) — add/
    delete, persisted. Other Assets totals are mirrored into the scalar
    `assets` block so the current net_worth tool keeps working until its
    step-4 refactor.
  - Data-health strip, Expense-Import panel (links to the Expense
    Tracker + shows staleness), and a "Who Reads What" sync table are all
    derived live from the store.
  - **Refresh Prices** is a v1 stub (live quotes still fetched in the
    Portfolio Tracker).
- `assets/suite-state.js?v=8` (ALL pages — schema v4 → v5): adds
  `accounts: []` and `otherAssets: []` with a v4→v5 `migrate()` step.
- Not yet done for the Data Hub: brokerage column-mapping editor UI,
  in-hub expense CSV parsing (still done in the Expense Tracker), and
  live price refresh from the hub.

Phase 13e (Settings — handoff step 3):
- `settings.html` (NEW) — the Settings page from Settings.dc.html,
  rendered in the shell (route `#settings.html`; sidebar Settings item
  no longer "Soon"). Store-backed:
  - **Household Profile** — per-spouse name / birth year / target
    retirement age → `household.spouses[i]` (adds `birthYear`, derives
    `age = currentYear − birthYear`, `targetRetireAge`); the primary's
    target mirrors into `retirement.plan.targetRetireAge`.
  - **Scenarios** (moved off the sidebar) — `preferences.scenarios[]` +
    `preferences.activeScenarioId`; New Scenario / Set active / delete.
    "Set active" applies the scenario's `targetRetireAge` to the plan.
    With none stored a synthetic "Base case" ACTIVE row shows — visiting
    Settings does NOT mutate the store (keeps the dashboard empty-state).
  - **Tax Profile** — `household.filingStatus`, `preferences.fedBracket`,
    `preferences.waCapGainsExcise` (WA state fixed).
  - **Appearance** — Theme segmented (Light/Dark/Auto → `WealthSuite.setPreference`,
    global), **Accent** swatches (green/blue/purple/teal), currency
    format (`preferences.currencyFormat`), sidebar default (`ws-shell-nav.collapsed`).
  - **Alerts** — `preferences.alerts.{quarterlyTax,staleData,rebalanceDrift,staleDays}`.
  - **Data Controls** — Export JSON download, Price source (Yahoo), and
    a two-click-to-confirm Reset (`store.reset()`; no blocking dialog).
- **Accent is global via JS, not a stylesheet edit**: `assets/suite.js?v=13`
  (v=12 → v=13, ALL tool pages + data_hub) gained `applyAccent()` — it
  overrides the `--primary*` tokens inline (theme-aware, beats theme.css)
  from `localStorage['wealthSuite.accent']`, re-applied on theme change
  and on `storage` events; `WealthSuite.getAccent/setAccent` added.
  index.html + data_hub.html + settings.html carry a matching pre-paint
  accent snippet (index has no suite.js) and re-apply on cross-document
  `storage` changes, so picking an accent in Settings repaints the shell
  and every embedded tool live. New `preferences.*` keys
  (fedBracket / waCapGainsExcise / currencyFormat / alerts / scenarios)
  are additive — no schema bump needed (they survive migrate()).
- Consumption follow-ups (step 4): tools reading `currencyFormat`,
  `fedBracket`, active-scenario assumptions, and the alert thresholds;
  and surfacing the active scenario name in the top-bar profile chip.

Phase 13f (mobile drawer fix + step 4 start — KPI wiring):
- **Mobile sidebar drawer** (index.html): below 860px the sidebar was
  `position:absolute` and covered the top-bar hamburger, so it couldn't
  be tapped. Now the sidebar is an off-canvas drawer (`transform:
  translateX(-100%)`); the hamburger toggles `.ws-shell.is-mobnav-open`
  (mobile) vs `data-ws-collapsed` (desktop, unchanged), a `#ws-backdrop`
  dismisses it, and navigating or resizing to desktop closes it. Labels
  stay visible in the drawer even if the collapse flag is set.
- **Step 4 (first slice) — live KPI tiles**: index.html now computes
  Total Net Worth (`portfolio.totalValue` + `otherAssets` + retirement
  balances − liabilities), Investment Portfolio, and Monthly Spending
  (current-month `expenses.transactions` vs summed category budgets)
  from the store and fills the `data-ws-metric` tiles, flipping the
  subline note to "live from your data". An empty store keeps the
  illustrative sample. Reactively re-renders via `store.subscribe`.
  Retirement Readiness and the Net-Worth-Growth / Allocation charts are
  still illustrative — next slice (they need history / a computed layer).
- Step 4 remaining: charts + readiness from real data; refactor each
  tool to READ the hub (holdings/accounts/household/scenario/prefs)
  instead of its own inputs.

Phase 13g (step 4 slice 2 — hub↔tool data contract):
- **`holding.costBasis` is PER-SHARE** — that's the store convention set
  by the Portfolio Tracker (its CSV import divides Vanguard "…Total"
  columns by shares; Fidelity/Schwab/generic cost headers are already
  per-share, and its table edits/valuations all assume per-share). The
  Data Hub originally committed lot TOTALS into the same field, which
  would have over-valued hub-imported holdings by ~shares× in the
  tracker. Fixed in data_hub.html:
  - `parseCSV()` mirrors the tracker rule (header contains /total/i →
    divide by shares) and commits per-share `costBasis`.
  - Preview still displays the lot total (mockup style); paste
    placeholder + hint now show per-share examples.
  - New hub-committed holdings get an `id` (`TICKER-ts-rand`) — the
    tracker keys row edit/delete/quote-merge on `h.id`, so id-less rows
    would mis-target edits.
  - `holdingValue()` helper (= (currentPrice||costBasis)×shares) now
    used by acctValue/recompute/net-of-liabilities; same fix applied to
    the dashboard KPI fallback in index.html.
  - Hub liability form gained a `type` select matching net_worth's
    options (mortgage/auto/student/credit/other) — rows previously
    rendered "undefined" type in Net Worth.
- Verified end-to-end (headless): hub paste of generic per-share CSV +
  Vanguard-style "Cost Basis Total" CSV → store holds cb=165.34 / cb=50
  with ids; Portfolio Tracker mounts them, renders both rows correctly,
  re-syncs totalValue=24840.8. Hub-entered Home $680K + Mortgage $312K
  → Net Worth shows assets $680K / liab $312K / net worth $368K (matches
  hub's "Net of liabilities").
- Tracker/Net Worth are hub-fed now (tracker reads `portfolio.holdings`
  on mount; net_worth reads the `assets.*` mirror + `liabilities.items`
  and subscribes). Tracker still has its own CSV import + doesn't
  live-subscribe to store changes while open — acceptable in the shell
  (iframe remounts per navigation).

Phase 13h (step 4 slice 3 — dashboard charts + retirement readiness):
- **Net Worth Growth chart** now draws from real history once ≥2 daily
  snapshots exist. Snapshots (`{d, nw, inv, ret, home}`, one per day,
  updated in place same-day, capped 1100) are recorded by the dashboard
  in `localStorage['wealthSuite.nwHistory']` — deliberately OUTSIDE the
  store (derived data; keeps export/import lean). History accrues from
  dashboard visits; the 1Y/3Y/5Y/All range pills window it. Callout,
  delta pill (green/red by sign), legend values, y-axis, and month
  labels all recompute; <2 points keeps the illustrative sample.
- **Asset Allocation** renders a dynamic flat donut from holdings
  grouped by `assetClass` (equity/bond/cash/other, valued at
  currentPrice||costBasis × shares) with a $total center label — the
  mockup's fixed 3-D pie stays for the sample state only (its slice
  paths aren't parameterisable).
- **Retirement Readiness tile + Retirement Planning card** run an
  inline seeded Monte Carlo (1,000 paths, ~O(45yr), mulberry32 seeded
  from inputs so re-renders are stable): balance = portfolio +
  retirement.balances.total, annual contributions summed from
  retirement.contributions until targetRetireAge, then
  −plan.annualExpenses (fallback: monthly budget ×12), growth
  N(plan.growthAssumption||7%, 15%), horizon age 95, currentAge = min
  spouse age. Outputs: success % (funds last to 95) → tile meter +
  On Track/Tight/At Risk at 80/60 thresholds; median at 85; retire
  year; real p10/p50/p90 fan-chart paths + Retire@age marker. Gated on
  age + retireAge + balance + expenses all present; else sample stays.
- Footer reworded (no longer claims sample when data is live).
- Note: allocation card totals derive from holdings, while the KPI tile
  prefers stored `portfolio.totalValue` — tracker/hub recompute keeps
  those consistent in real flows.

Phase 13i (step 4 slice 4 — Spending vs Budget card):
- The dashboard's Spending-vs-Budget card now renders live: this month's
  `expenses.transactions` grouped by `category` vs each category's
  `budgetMonthly`. Top 5 categories by spend; per-row states: at/under
  budget (pos/primary bar), over budget (red spent + ↑N% chip +
  warn→neg gradient bar at the budget cut point), no budget (spend
  shown with a relative-width cat2 bar). Total row + header badge
  ("$N left" green / "$N over" red) recompute; subtitle shows the
  month. Gated on monthSpend > 0, else the sample stays.
- Sign convention (matches the Expense Tracker): negative amount =
  spend, positive = refund/credit — refunds are NETTED per category
  AND in the month total (the KPI tile's monthSpend was fixed to net
  refunds too; legacy `type:'expense'` positive rows still count as
  spend).
- Step 4 still open: Performance table (needs benchmark quote history
  via the quote worker), scenario/fedBracket/currencyFormat consumption
  in tools, Data Hub polish (mapping editor, in-hub price refresh).

Phase 13j (step 4 slice 5 — live Performance table):
- The dashboard Performance table now computes real annualized returns
  from monthly adj-close history fetched via the quote worker
  (`v8/finance/chart/{t}?interval=1mo&range=max&includeAdjustedClose=true`
  — the worker's `/v[678]/finance/` allowlist already permits this, no
  worker change). Candidate chain worker → query2 → query1, same
  privacy stance as the tracker (only public ticker symbols leave the
  browser). Caching: sessionStorage 15-min TTL per ticker + same-day
  fallback in `localStorage['wealthSuite.perfSeries']` (also the test
  seam — seed it to render without network).
- "Your Portfolio" = buy-and-hold of the CURRENT holdings mix: top 8
  tickers by value; per period, weights renormalized over tickers whose
  history reaches back; benchmarks ^GSPC / VTI / VXUS. Cells render "—"
  when a series doesn't reach the period (e.g. VXUS pre-2011).
- **Annualization is over the ACTUAL elapsed span** of the chosen
  monthly start point (`growthFor()`), not the nominal period — naive
  nominal-year division showed a ~0.7pp bias in verification (true 8%
  CAGR rendered +7.3% at 1Y); actual-span recovers CAGRs exactly. The
  period factor for the $-growth column is re-derived from that rate.
- Sample table (mockup rates) renders immediately via the shared
  `renderPerfTable()`; the live pass replaces it only on success (total
  quote outage keeps the sample). Subtitle switches to "your current
  holdings mix … dividends included". Gated on holdings + basis.
- Verified: seeded synthetic series (VTI 8%/16y, ^GSPC 10%/16y, VXUS
  5%/4y) render +8.0/+10.0/+5.0 exactly in every reachable column with
  "—" beyond VXUS's history; live worker probe returned ^GSPC monthly
  adj-close to 1984.
- With this, EVERY dashboard panel is live-or-gated-sample. Step 4
  remaining: scenario/fedBracket/currencyFormat consumption in tools;
  Data Hub polish.

Phase 13k (Tailwind tool reskin):
- `assets/tw-reskin.css?v=1` (NEW — linked after theme.css on the 5
  React/Tailwind tools: portfolio_tracker, expenses, TaxEstimatorV5,
  roth_conversion, TaxAssetCalcv4). Re-points their hardcoded Tailwind
  color utilities at the shared theme tokens WITHOUT touching any
  tool's markup: blue/indigo/purple/violet → `--primary` family
  (solid 600s also force `color: var(--on-primary)`), emerald/green →
  `--pos`, red → `--neg`, amber/orange → `--warn`; hover/active/
  disabled/focus-ring variants covered; native radio/checkbox/range
  get `accent-color: var(--primary)`. Neutral gray/slate untouched.
- **`!important` is load-bearing**: the Tailwind Play CDN injects its
  stylesheet at runtime (after any static `<link>`), so specificity
  alone can't win. The selector list is the exact class inventory of
  the 5 tools — extend it if a tool gains new color utilities.
- Because everything maps to tokens, the internals follow the accent
  picker AND the dark palette automatically (verified: accent=blue +
  dark renders tracker buttons in the dark-blue accent token).
- Verified renders: tracker, expenses, TaxEstimatorV5, roth all green
  in light mode. TaxAssetCalcv4 blanks in HEADLESS Chrome both before
  and after the change (heavy Babel+D3 page vs virtual-time budget) —
  pre-existing headless limitation, not a regression; the reskin is
  pure CSS.
- Charts inside tools (Chart.js/D3 JS-set colors) keep their own
  palettes — only class-styled UI was reskinned.

Phase 13l (fixes: Asset Calc Babel pin + Estate Plan sidebar route):
- **TaxAssetCalcv4.html was blank** (React never mounted): it loaded
  UNPINNED `@babel/standalone` from unpkg — missed by the earlier
  suite-wide pin (aa7ee7c) — and unpkg now serves Babel 8, which
  rejects raw `>` in JSX text (`assets held > 1 year`, inline script
  629:153). Fixed: pinned to 7.29.7 like every other React page AND
  escaped the `>` to `&gt;`. Gotcha reinforced: any new React tool must
  pin @babel/standalone@7.29.7.
- **Estate Plan is now its own sidebar destination**: the Estate tab
  button was removed from retirement_master_plan_2.html's tab bar
  (pane `#est` kept), the tool gained expenses-style hash deep-links
  (`activateTabFromHash`: `#ov/#proj/#est/…`; `showTab` tolerates a
  null button; an emptied/unknown hash mid-session resets to Overview —
  that's what shell-nav Estate → Retirement produces, since only the
  fragment changes and the iframe doesn't reload).
- **Shell router supports sub-hash routes**: ROUTES may key
  `file.html#subtab` (Estate Plan = `retirement_master_plan_2.html#est`);
  `routeFromHref/resolveRoute` normalize (incl. %23-encoded pasted
  URLs), setActive does exact route matching so Retirement Plan and
  Estate Plan highlight independently.

Phase 13m (Estate Plan extracted to a standalone page):
- The 13l sub-hash approach still showed the Retirement banner + tab
  bar around the estate content — not what the user wanted. The estate
  pane is now **its own page, `estate_plan.html`** (12th tool): the
  `#est` pane markup was moved out of retirement_master_plan_2.html
  verbatim, wrapped with a copy of that tool's `<style>` block, its own
  green `.hdr` banner (fed exemption / WA exclusion / est. WA tax
  stats), and the standard suite chrome (suite.css/theme.css +
  suite-state + suite.js; no adapter — static content).
- retirement_master_plan_2.html no longer contains the pane (tabs:
  Overview/3-yr buffer/Projection/Roth+SS/Tax strategy/RMD/Timeline).
  Its hash-tab deep-link support (13l) remains for the other tabs.
- Router: `estate_plan.html` is a normal ROUTES entry (the sub-hash
  route mechanism stays but has no entries). Sidebar Estate Plan →
  estate_plan.html.
- `assets/suite.js?v=14` (ALL pages): Estate Plan added to the
  Retirement cluster so the standalone topnav sub-nav shows
  Master Plan / Estate Plan / Monte Carlo.
- The page content is copy-heavy static analysis (OBBBA, WA SB 6347,
  millionaire tax, trust strategy, beneficiary audit) — candidates for
  store-driven figures later (estate size from net worth, etc.).

Phase 13n (step 4 — Settings preferences consumed by shell + tools):
- `assets/suite.js?v=15` (ALL tool pages + data_hub + settings): new
  shared helpers `WealthSuite.fmtMoney(n)` (honours
  `preferences.currencyFormat` — 'full' → exact dollars, else compact)
  and `WealthSuite.activeScenario()` (activeScenarioId match, else
  first stored — mirrors Settings' fallback; null = implicit "Base
  case"). `renderHouseholdBanner` formats via fmtMoney, appends the
  active scenario name, and "retire in N yrs" honours the scenario's
  targetRetireAge override.
- `index.html`: profile-chip sub line = active scenario name · filing
  · taxYear ("Base case" when none stored). Alert prefs consumed:
  `alerts.quarterlyTax === false` hides the Q2 tax banner (Dismiss is
  a this-visit hide on top); `alerts.staleData`/`staleDays` turn the
  "live from your data" note into "· last updated N days ago" (warn)
  when `meta.lastUpdated` is older than the threshold. `money()`
  honours currencyFormat 'full' in KPI tiles/legends/stat tiles; chart
  axes stay compact via `moneyC()`. **Fixed a real re-render bug**:
  the dashboard called `store.subscribe(refreshAll)` but the API is
  `subscribe(path, fn)` (registration landed as key=fn, cb=undefined),
  and the DOMContentLoaded boot path — the one that actually runs,
  since suite-state.js is a defer script loaded after the inline shell
  — never subscribed at all. Cross-document store edits now repaint
  the dashboard live (verified headless via storage event).
- `assets/adapters/roth.js?v=2`: retireAge prefers the active
  scenario; `preferences.fedBracket` seeds the "fill through bracket"
  select, snapped to the tool's 12/22/24/32 options (35%+ caps at 32).
  `roth_conversion.html`'s `__rothSeed` hook accepts `targetBracket`.
- `assets/adapters/mc.js?v=2`: retire age prefers the active scenario;
  a scenario `withdrawalRate` > 0 overrides the withdrawal with
  rate% × starting balance.
- Asset & Cap-Gains deliberately unchanged: it has no bracket input
  (it computes marginal rates progressively from income), so
  fedBracket has nothing to default there.
- currencyFormat coverage = dashboard + the household banner on every
  tool page; tools' own internals keep their native formatters.

Phase 13o (Data Hub polish — backlog item 1):
- All three sub-items land in `data_hub.html` only (no shared-asset
  cache-buster bumps):
  - **Column-mapping editor** — the import preview gained an
    "Edit mapping" toggle: per-field selects (Ticker/Shares/Cost basis/
    Account over the CSV's headers) + a "Cost column is a lot total
    (÷ shares)" checkbox. Raw parsed cells are kept (`rawImport`) so
    mapping edits re-parse instantly; moving the cost-basis column
    re-derives the lot-total heuristic from the new header; any manual
    edit flips the badge to "Custom mapping". Zero-row mappings keep
    the editor open instead of falling back to the empty state.
  - **In-hub Refresh Prices** (stub removed) — same candidate chain as
    the tracker (worker → query2 → query1 → public proxies) AND the same
    `yf_<TICKER>` sessionStorage 15-min cache, so hub and tracker share
    quotes. Updates `holdings[].currentPrice/priceUpdatedAt/name`,
    recomputes `portfolio.totalValue`, disables the button while
    in-flight, reports "updated N of M tickers".
  - **In-hub expense CSV import** — the Expense Import card is now a
    real drop/browse zone (link-out demoted to a "review in the Expense
    Tracker" link). Parser mirrors expenses.html exactly (Chase/Amex/
    Citi/generic detection, sign conventions, bank-category mapping,
    keyword auto-categorization incl. learned `merchantMap`), dedupes on
    `date|amount|normMerchant` against existing transactions, appends an
    `importHistory` entry (`importedAt`/`source`/`count`/`fileName`).
- **Bug fixed**: the hub read `importHistory` freshness via `r.at||r.date`
  and labels via `r.name||r.file`, but the Expense Tracker writes
  `importedAt`/`fileName` — so expense staleness NEVER registered in the
  health strip / sync table. Now reads `importedAt` first.
- Known parity quirks (inherited from expenses.html, deliberately kept):
  a category-less generic CSV is detected as Amex and gets its amounts
  sign-flipped; "COSTCO GAS" hits the groceries keyword rule before
  transport.
- `.claude/skills/verify/SKILL.md` (NEW) — repo verify recipe: serve
  root + same-origin harness page driving the iframe'd tool in headless
  Chrome (`--virtual-time-budget`), synthetic DataTransfer drops, store
  assertions.

Phase 13p (Estate Plan live figures — backlog item 1):
- `estate_plan.html` only: hardcoded sample figures now compute from the
  store, gated exactly like the dashboard (empty store keeps the sample;
  subtitle flips to "live from your data"). `data-est="…"` hooks + an
  inline script (no adapter file; page stays self-contained).
- **Estate size mirrors the dashboard net-worth formula** (index.html
  `refreshKPIs`): portfolio.totalValue (fallback per-share holdings sum)
  + otherAssets + retirement.balances.total − liabilities. Gate:
  any asset component > 0.
- **WA estate tax**: graduated pre-2025 table on the excess over the $3M
  exclusion (10/14/15/16/18/19/19.5/20% over 1/1/1/1/2/1/2M/∞ slices —
  $500k excess ≈ $50k, matching the old sample). **Federal**: 40% over
  $30M MFJ / $15M single (`household.filingStatus`); OBBBA card + header
  + narrative note re-render (below vs ABOVE wording).
- **WA-vs-NV table**: tier rows carry `data-tier-max`; the highlighted
  "← you" row is repositioned under the matching tier and its label/
  strategy/delta/recommendation cells re-render from per-tier templates
  with the computed WA tax. ILIT "both spouses at 51" → live ages.
- Verified via the verify-skill harness: empty store keeps sample;
  $3.6M MFJ → ~$600k/~$60k under <$5M tier; $12M → ~$1.5M, 10–20M tier;
  $18M single → fed ~$1.2M ABOVE wording + $15M header; persists across
  reload.

Phase 13q (Retirement Master Plan live figures — backlog item 2):
- `assets/adapters/retirement.js?v=7` (retirement_master_plan_2.html
  only). The tool's remaining hardcoded copy is now store-driven, same
  gate as everything else (empty store keeps the age-45/$90k sample):
  header subtitle + document title, "Target at N" header stat + overview
  tile (25× annualExpenses, 4% SWR), buffer-ladder card (tier amounts,
  Total/interest subtitle, title age), inflation-schedule tiles
  (retireAge +0/+5/+10/+15, last tile nets SS when ≥70), the age-70 SS
  note, and the savings-roadmap card (kv rows rebuilt from store
  contributions — 401k-family/IRA/HSA rows, zero rows omitted, taxable
  row dropped since the store has no such field; on/behind-pace title +
  surplus/shortfall note).
- **portAtRetire now includes contributions**: `_port` = portfolio
  compounded + ordinary-annuity FV of summed `retirement.contributions`
  — matches the dashboard readiness model and the roadmap card, so the
  "Projected at age N" tile, projection chart, and roadmap total agree.
- **`window.runMC` is now patched** (it kept hardcoded $2.25M/$90k/62
  even when everything else was live) with the same closure inputs;
  `buildMCChart`/`buildProjChart` are wrapped to re-label the hardcoded
  62-based x-axis from `_retireAge` (MC path length = retire→90, so the
  "success (age 90)" tile label stays truthful at any retire age).
- **Fixed two silently-dead tile updates**: the adapter looked up
  'Projected at age 55' / 'Starting portfolio (age 55)' but the tool's
  labels say age 62 — new `findScByPrefix()` matches the label prefix
  and rewrites the age in the label too.
- **SS base aligned to the current tool**: patch used $124,872 (the
  pre-rewrite tool's estimate, inflated from current age); tool bakes
  $69,600 in at-retirement dollars (both spouses at 70). Shared `ssAt()`
  now feeds calcPortfolio, runMC, and the buffer figures consistently.
- Verified via the verify-skill harness: empty store keeps sample
  (subtitle Age 45, $2.5M target, $90k tiers, tool's own runMC);
  $2M/65/$120k/mfj + 23k 401k + 8.3k HSA → subtitle/title Age 48,
  target $3.00M, projected $7.28M (= 2M·1.07¹⁷ + $709k + $256k — the
  $709k matches the tool's own sample math), tiers $215k, buffer note
  $256k→$173k, MC paths 26 pts starting 7.28 at ages 65..90, rate 97%.

Phase 13r (purchase dates + since-purchase Performance table):
- **`holding.purchaseDate` added** (ISO 'YYYY-MM-DD', nullable —
  additive, no schema bump). Captured in BOTH entry points:
  - `data_hub.html` — CSV auto-map ('Purchase Date' / 'Date Acquired' /
    'Acquisition Date' / 'Trade Date' / 'Open Date' headers), a
    "Purchase date" select in the mapping editor, a Purchased column in
    the preview (6-col grid now), and commit writes it (update rows only
    overwrite when the CSV provides a date). `parseDate()` normalizes
    MM/DD/YYYY / M/D/YY / ISO.
  - `portfolio_tracker.html` — same header detection in `parseCSV`
    (`parseDateISO`), import merge preserves an existing date when the
    CSV lacks one, add-form "Purchased" date field, and an editable
    Purchased date column in the holdings table.
- **Dashboard Performance table (index.html) is now purchase-aware.**
  Previously "Your Portfolio" was a hypothetical backtest: current
  position weights × each ticker's full-period market return. Now it's a
  **monthly chain-linked (time-weighted) return where each lot enters at
  the first month boundary on/after its purchaseDate** — the buy-in
  itself never counts as return; month returns are value-weighted
  (shares × that month's adj-close); annualized over the ACTUAL span the
  portfolio existed within the period; the $-growth column uses the
  actual chained factor. Prices matched across tickers by 'YYYY-MM' key
  (tolerates timestamp misalignment).
- **Benchmarks are clipped to the same window per column**
  (`growthFrom(series, windowStart)`), so each cell compares you vs the
  index over the identical window — a 2-yr-old portfolio's "10Y" column
  shows 2-yr annualized returns for BOTH rows. When your cell is absent
  the benchmark falls back to the full period.
- **No purchase dates = old behavior** (lots held for the whole period;
  a short-history benchmark like VXUS still renders "—" beyond its
  data). Subtitle switches between "since purchase …" and the old
  "current holdings mix …" wording (the latter now hints to add dates).
- Verified via the perfSeries test seam (synthetic VTI 8%/16y, ^GSPC
  10%/16y, VXUS 5%/4y): purchase 24 mo ago → every column +8.0% you /
  +10.0% S&P / +5.0% VXUS (same window); no dates → full-period with
  VXUS "—" at 5Y/10Y/All. Hub paste (US + ISO dates) → preview + commit
  → tracker mounts with populated date inputs → tracker CSV re-import
  updates dates → store round-trip intact.

Phase 13s (dashboard shell UI cleanup — per user screenshot):
- index.html only. Removed from the topbar: the "← Dashboard" back
  chip + "New tab" chip (tool navigation is the sidebar now — the
  router's showTool/showDashboard no longer toggle them), the theme
  cycle button (theme is set in Settings → Appearance; the shell still
  APPLIES the preference — `applyTheme` kept, along with the mql and
  cross-document `storage` listeners), and the "Import Data" button
  (duplicated the Data Hub promo). Removed from the sidebar: the whole
  REVIEW section (its only item was the deferred Site Map "Soon" chip).
- Dead CSS pruned (.ws-back/.ws-newtab/.ws-themebtn/.ws-importbtn/
  .is-soon/.ws-badge--soon); `.ws-badge`/`--q2` kept (Tax Plan chip).
- Verified headless: elements gone, hamburger/bell/profile/Data Hub/
  Settings intact, theme still applied from the stored preference,
  sidebar→tool→Dashboard routing works, KPI sample renders.

Phase 13t (mobile sidebar fix — Data Hub/Settings unreachable):
- index.html only. On phones/iPads the sidebar footer (Data Hub promo +
  Settings + avatar) sat in a separate non-scrolling flex block below
  the scrollable nav, AND the drawer used `height:100vh` — which iOS/
  Android measure behind the browser toolbar — so the footer was
  clipped offscreen with no way to scroll to it.
- Fix: the footer content moved INSIDE `.ws-nav` as `.ws-navfoot`
  (`margin-top:auto` pins it to the bottom when the list is short;
  scrolls with the list when the viewport is short — reachable either
  way), `.ws-sidefoot` container/CSS removed (`.ws-sidefoot__row` class
  kept — collapsed-rail rules reference it), and `height:100dvh` added
  (with 100vh fallback) on body/shell/drawer. `.ws-navfoot` also pads
  `env(safe-area-inset-bottom)`.
- Verified headless at 390×600: drawer opens, nav scrolls (712 >
  527px), hub was at y=661 (offscreen) pre-scroll and both chips fully
  visible after; desktop 1500×950 renders pinned-bottom, unchanged.

Phase 13u (account names + tax-treatment tracking):
- **Convention: `accounts[].taxTreatment` = 'Taxable' | 'Tax Free' |
  'Tax Deferred'** (human labels; consumers normalize case/spacing and
  fall back to `type` — Roth/HSA → tax-free, Traditional → tax-deferred
  — then to a name-based guess: /roth/, /hsa/, /401|403|457|ira|trad…/).
  Holdings link to the registry by `holding.account` (name string).
- `data_hub.html`: the registry's free-text Tax Treatment input is now
  a select with those three values; manual add with treatment blank
  derives it from the account type; CSV-commit auto-register now
  guesses type + treatment from the account name (was always
  'Taxable' + empty treatment).
- `portfolio_tracker.html`: captures `account` everywhere — CSV import
  (`account` header; merge keys on ticker+account when the CSV names
  one, matching the hub), add-form Account field, and an editable
  Account column (2nd, after Ticker) with a `<datalist>` of registry
  names + a live treatment sublabel. The tracker loads `accounts[]` on
  mount and **auto-registers unknown account names** into the registry
  on sync (same guess as the hub) so hub/tracker stay linked.
- **Second tile row in the tracker** (only when holdings exist):
  Taxable / Tax Free / Tax Deferred totals + "% of portfolio", valued
  at (currentPrice||costBasis)×shares; a "No Account Set" tile appears
  only when unassigned holdings exist.
- Verified headless end-to-end: hub CSV with Schwab Brokerage / My
  Roth IRA / Fidelity 401k → registry Taxable / Tax Free / Tax
  Deferred; manual Roth add with blank treatment → Tax Free; tracker
  tiles $20,000/$7,500/$3,000 (exact), datalist lists all registry
  names, typing "New HSA Account" into a row auto-registers HSA/Tax
  Free within the 400ms sync debounce.
- **13u follow-up 5 — self-heal for poisoned auto-registrations** (user
  repro persisted; verified their exact flow passes on current code —
  the residue was pre-fix registry entries in their store): tracker
  mount + hub init now re-guess UNCURATED accounts stuck on the old
  Taxable default whose name strongly signals otherwise (roth/hsa/
  tax-free/401k…). `curated: true` marks anything user-set — hub
  inline edit, hub manual add, explicit CSV Account Type — and is
  never healed. Hub's `guessAcct` lifted from commit() to script scope
  (shared with `healAutoRegistered`). Verified: poisoned
  "Tax Free"=Taxable heals to Tax Free on either page's load ($20k
  tile), curated conflicting entry untouched, plain taxable untouched.
- **13u follow-up 4 — inline registry editing** (user still saw
  Taxable after follow-up 3): the registry LOOKUP deliberately beats
  the name guess, so accounts auto-registered as Taxable by the
  pre-fix guesser stayed Taxable — and the registry only offered
  delete + re-add. The hub's Accounts Registry rows now render Type
  and Tax Treatment as inline `.dh-rowsel` selects (delegated `change`
  handler → `store.set('accounts')`; unknown legacy values are kept as
  an extra option). Tools pick edits up on their next load. Verified:
  stale "Tax Free"=Taxable entry flipped via the select → tracker tile
  reclassifies $20k to Tax Free on reload.
- **13u follow-up 3 — "Tax Free" account names not recognized** (user
  report): the name guesser only knew roth/hsa/401k-style patterns, so
  an account literally named "… Tax Free …" classified as Taxable.
  Both guessers (tracker + hub) now match tax-free / tax-exempt / 529
  → Tax Free and tax-deferred → Tax Deferred. Also: the tracker's
  registry lookup is now case/whitespace-insensitive (`acctKey`) so a
  typed variant of a curated account resolves; and auto-registration
  moved OUT of the debounced sync (which registered half-typed names
  on a >400ms typing pause) to complete-name moments only — add-form
  submit, CSV import, and Account-input blur (`registerAccounts`).
- **13u follow-up 2 — optional "Account Type" import column**: hub
  import/paste accepts an "Account Type" / "Tax Treatment" column
  (normalized via `normTreatLabel` — taxable/cash, tax free/roth/hsa,
  tax deferred/traditional → the three canonical labels; unrecognized
  → name-based guess). On commit it sets the treatment for newly
  auto-registered accounts and FILLS blank treatments on existing
  registry entries (never overwrites a curated value). Mapping editor
  gained an "Account type" select; paste placeholder + Accepted-columns
  hint document the full column set (and that Account Number is never
  used).
- **13u follow-up fixes** (user found import/paste gaps): both column
  detectors now prefer "Account Name" and NEVER auto-map "Account
  Number" (Fidelity/Schwab carry both; the number column comes first
  in the file, so bare 'account' substring matching grabbed opaque
  numbers). And both merge paths gained a **backfill rule**: a CSV row
  that only matches on ticker ADOPTS the CSV's account when the
  existing holding has none, instead of duplicating the position —
  re-importing the same file with an Account column now fills accounts
  in place (hub preview's New/Update status matches). Verified: tracker
  CSV plain-account + Fidelity-style dual-column (names not numbers,
  auto-registered treatments), tracker + hub backfill each keep 1 row,
  hub paste never leaks the account number.

Phase 13v (dashboard chart fixes — user-reported):
- **NW Growth "stale data"**: the chart draws `wealthSuite.nwHistory`
  (device-local daily snapshots), which faithfully includes test-era
  junk — and `store.reset()` never touched it, so a cleaned store kept
  charting old values. Settings Reset now also clears the device
  caches (nwHistory/perfSeries/briefingStats/briefingNarrative) via
  `clearDeviceCaches()`, and Data Controls gained a standalone
  **"Clear chart history"** button (fix a poisoned chart without
  losing real data; history re-accrues from the next dashboard visit).
- **Range pills**: they always re-windowed the data, but with < 1 yr
  of snapshots every window is identical — invisible. Now the x-axis
  granularity follows the VISIBLE window's actual span (≤70d → "Jul
  18", ≤550d → months, ≤1500d → quarters "Q3 '25", else years;
  consecutive duplicates blanked), and the card subtitle (`#ws-nw-sub`)
  states the selected range AND recorded span ("1Y view · 9 days of
  daily snapshots …") so "no effect" is self-explaining.
- **Retirement Planning card**: three fixes. (1) retire age now falls
  back active scenario → plan.targetRetireAge → spouses'
  targetRetireAge (index.html doesn't load suite.js, so the scenario
  precedence is replicated inline, matching the Roth/MC adapters).
  (2) **growthAssumption unit bug**: the card did `(v||7)/100`, but
  the store convention is a FRACTION (0.07) → mean 0.0007 silently
  wrecked the simulation whenever the plan was populated; now
  normalized (>1 → percent, else fraction, default 0.07). (3) When
  still gated on a non-empty store, `#ws-ret-sub` names the missing
  inputs ("Sample — add household ages + annual expenses …") instead
  of silently showing the mockup.
- Verified headless: 24-mo seeded history → 1Y pill months axis +
  "+$219K", All pill quarters axis + "+$300K", callout tracks the
  store's live NW; 6-day history → day labels + honest subtitle;
  scenario-only retire age + 0.07 growth → live card (96%, $6.25M
  median at 85); missing ages → explanatory sample note; Settings
  clear-history and Reset both purge the right keys.
- **13v follow-up — live from day one** (user still saw samples): the
  NW chart required ≥2 snapshots, so the first visit after "Clear
  chart history" re-showed the SAMPLE for a day; now 1 snapshot
  renders live as a flat line at today's real value (sample only with
  zero history = truly empty store, since recordHistory is gated on
  hasData). Retirement card: `annualExpenses` falls back to the
  trailing-12-mo Expense Tracker average (mirrors the retirement
  adapter's "Adopt actual spend"), and the gated state is unmistakable
  — badge flips to gray "Sample" and the KPI readiness tile hint
  lists the missing inputs. Ages + retire age remain hard
  requirements (can't be derived from portfolio data).

Phase 13w (NW Growth chart reconstructed from price history — user
feature request; design choices confirmed via AskUserQuestion:
positions-only history / undated = held forever / computed replaces
snapshots):
- **The Growth chart no longer draws daily snapshots** — it
  reconstructs portfolio value at each point as Σ shares × RAW close
  (adjusted close would distort past values for dividend payers) for
  positions already purchased. Lots enter at `purchaseDate`; undated =
  held forever (Performance-table convention). Final point is always
  the live store value; callout = today's full net worth; legend shows
  today's buckets (retirement/home have no price history — they're
  numbers, not lines). The chart recomputes on every store change, so
  add/delete/shares edits update it immediately.
- **Background price download + cache**: `wealthSuite.priceHist`
  (24h TTL per symbol) holds `1wk/6mo` + `1mo/max` RAW-close series
  per held ticker, fetched via the worker → query2 → query1 chain on
  dashboard load (`ensurePriceHist`); symbols no longer held are
  pruned from the cache (delete-a-stock requirement). Re-render fires
  when the background download completes.
- **Point grid = the requested tiers**: weekly points for the last 3
  months, monthly to 1 year, quarterly beyond. Window start = chip
  range, clipped to the earliest purchase when all positions are
  dated ("All" = since first purchase).
- **X-axis fixed**: time-scaled x positions (was index-based) with
  ticks drawn IN-SVG at exact x — months for the 1Y chip, quarters
  for 3Y/5Y, span-based for All (days/months/quarters/years). The old
  flex label row (`#ws-nw-months`) is cleared — it could never align
  with data points.
- Settings "Clear chart history" → "Clear chart caches" (also removes
  priceHist); Reset clears it too. Daily snapshots are still recorded
  (cheap, future use) but nothing reads them for this chart.
- Verified headless: seeded flat-price cache (VTI $100 ×100sh dated
  −2y, AAPL $200 ×50sh dated −6mo) → 1Y delta EXACTLY +$10K (+100.0%)
  (the AAPL entry step), month ticks Aug–Jul; 3Y/All clip to the
  first purchase with quarter ticks Q4'24–Q3'26; unheld MSFT pruned
  from cache; live fetch pulled 302 monthly + 27 weekly points per
  symbol in the background.
- **13w follow-up — hover crosshair**: pointermove on the chart SVG
  draws a dashed vertical guide + dot + "$value · date" pill snapped
  to the nearest data point (screen→viewBox via `getScreenCTM`, so it
  survives responsive scaling; label flips sides near the right edge;
  pointerleave clears; the mockup sample stays inert since `nwHover`
  is only set by a live render).

Phase 13x (Retirement Planning widget — complete the inputs + chart UX):
- **Root cause of "still sample"**: the gate's fourth input, annual
  retirement spending, had NO input surface in Settings — it only came
  from the Retirement tool's "Adopt actual spend", budgets, or expense
  history. (Also: the Monte Carlo page is read-only BY DESIGN — its
  adapter seeds FROM the store; edits there never write back.)
- `settings.html`: Household Profile card gained **"Annual spending in
  retirement"** (→ `retirement.plan.annualExpenses`) and **"Expected
  growth %/yr"** (→ `plan.growthAssumption`, stored as a FRACTION —
  input 7 → 0.07, displayed back as 7). With birth years + retirement
  age already there, Settings alone can now fully light up the widget.
- `index.html`: the live fan chart re-sizes its own geometry to the
  full card width (viewBox 660×128; the mockup sample keeps its
  original 420-wide viewBox — live render sets the attribute), and
  gained a **hover crosshair**: guide line + dot with a two-line pill
  "Age N · median $X" / "p10 $Y · p90 $Z" at the hovered age (same
  getScreenCTM pattern as the NW chart; sample state inert).
- Verified headless: client-like store (portfolio + ages + retire age,
  no expenses) → Settings fields write 80000/0.07 and repopulate as
  80000/7 → dashboard flips live (On Track, retire 2043), svg 660×128,
  hover "Age 71 · median $2.46M / p10 $708K · p90 $6.61M", clears on
  leave.

## Constraints to preserve

- **Zero build step.** No Vite/Webpack until scope demands it.
- **Tools stay self-contained.** If `suite-state.js` doesn't load,
  each tool still works standalone.
- **Privacy: client-side only.** No data leaves the browser.
- **Don't break `taxSuiteInputs_v2`.** Existing user data there;
  tax adapter migrates on first load.
- **MFJ + Single only.** No Married Filing Separately.
- **WA only** for state tax. Federal logic is general.
- **GitHub Pages public repo.**

## Common gotchas

- `window.WealthSuite` namespace — always
  `Object.assign(window.WealthSuite, {...})`, never reassign with `=`.
- `Number(null) === 0` — must check for null/undefined explicitly
  before `Number()` conversion (e.g. `dashboard.js` `sumSpouse`).
- MutationObserver on React subtrees fires on every keystroke.
  Throttle via `requestAnimationFrame` (see `asset.js`).
- Babel-standalone processes `<script type="text/babel">` on
  DOMContentLoaded. Defer scripts run before that, but React headings
  aren't in DOM yet at adapter-load time — use MutationObserver or
  polling.
- Browser caches `.html` files under Python http.server. When
  updating shared assets, bump `?v=N` everywhere.
- `html2canvas` can't parse `color-mix(in oklab, ...)`. For doc
  screenshots, use headless Chrome
  (`google-chrome --headless --screenshot=...`).
- Asset Calc supports tax years 2024, 2025, 2026 — adapter clamps to latest supported year if store has a newer value.
- **Pin `@babel/standalone@7.29.7`** on every React page. Unpinned CDN
  URLs now serve Babel 8, which hard-errors on raw `>`/`<` in JSX text
  → blank page (React never mounts). Also escape `>` as `&gt;` in JSX.

## Workflow

- Branch from `main` for any non-trivial change.
- New branches default `@{u}` to `origin/main` — **always push with
  explicit refspec**: `git push -u origin <branch>:<branch>`.
- Open PR with `gh pr create --base main --head <branch>`.
- Merge with `gh pr merge <num> --rebase --delete-branch` to keep
  linear history.
- Pages workflow auto-deploys on push to main, ~45s end-to-end.
- Pages workflow path filter skips `.claude/**`, `*.md`, `.gitignore`,
  but `docs/` IS deployed.

## Phase 3 candidates (all complete)

- ~~Refactor Portfolio Review to take portfolio data as input.~~ ✓
- ~~Refactor Retirement Master Plan to compute projection inputs from
  household data.~~ ✓
- ~~Extend Asset Calc tax-year support beyond 2024/2025.~~ ✓ (2024–2026)
- ~~Golden φ adapter.~~ ✓
- ~~Named scenarios switchable from dashboard.~~ ✓
- ~~CSV export per section.~~ ✓
- ~~Dashboard compact mode — inline key fields for fast data-entry.~~ ✓
- Vite migration — deferred indefinitely.

## Phase 4 plan

### P1 — Roth Conversion Planner (`roth_conversion.html`)

Standalone single-file tool (React 18 + Tailwind, same stack as Asset
Calc). Seeded from suite store on load; writes back target conversion
schedule.

**Inputs (from store + user):**
- Current traditional IRA / 401k balance (from `retirement.balances`)
- Current income & filing status (from `income`, `household`)
- Ages, target retire age (from `household`, `retirement.plan`)
- User-adjustable: annual conversion cap, expected return, future
  ordinary income in retirement

**Outputs:**
- Year-by-year conversion schedule: amount converted, marginal bracket
  used, tax owed
- Side-by-side projection: no-conversion vs. optimal-conversion —
  RMDs, total tax drag, net Roth balance at retirement
- Break-even year chart (D3)

**Suite adapter:** `assets/adapters/roth.js` — reads store on load,
writes `retirement.plan.rothConversionSchedule` on calculate.

---

### P2 — Portfolio Tracker (`portfolio_tracker.html`)

New standalone tool. Replaces the static `portfolio_review.html`
hardcoded data with live holdings and projections.

**Brokerage CSV import** — parser handles four formats:
| Brokerage | Key columns |
|---|---|
| Fidelity | `Symbol`, `Quantity`, `Current Value`, `Average Cost Basis` |
| Schwab | `Symbol`, `Quantity`, `Market Value`, `Cost Basis` |
| Vanguard | `Symbol`, `Shares`, `Current Value`, `Cost Basis Total` |
| Generic | `ticker`, `shares`, `cost_basis` (3-col, any brokerage) |

**Live prices** — Yahoo Finance public endpoint
(`https://query1.finance.yahoo.com/v8/finance/chart/{ticker}`).
Fetched client-side; no API key required. Cached in
`sessionStorage` for 15 min to avoid hammering the endpoint.
Quote data (price, day change %) is public market data — no personal
info leaves the browser.

**Holdings store:** `portfolio.holdings[]` array, each entry:
```js
{ ticker, name, shares, costBasis, currentPrice, priceUpdatedAt,
  purchaseDate,  // ISO 'YYYY-MM-DD' or null (Phase 13r; feeds the
                 // dashboard Performance table's since-purchase returns)
  assetClass }   // assetClass: 'equity'|'bond'|'cash'|'other'
```

**Dashboard panels:**
1. Holdings table — ticker, shares, cost basis, current value,
   day $ / day %, total gain/loss %
2. Allocation donut — current vs. target (reads `portfolio.allocations`)
3. Projection chart (D3 line) — 1 / 3 / 5 / 10 / 15 yr at
   configurable CAGR per asset class (default: equity 7%, bond 3.5%,
   cash 0.5%)
4. Daily P&L summary tile

**Suite adapter:** `assets/adapters/tracker.js` — on holdings change,
recomputes `portfolio.totalValue` and `portfolio.allocations` from
live holdings and pushes to store.

**Constraints:**
- Yahoo Finance endpoint is unofficial and may change. Wrap in a
  try/catch; fall back to last known price from holdings store if
  fetch fails (show "stale" badge).
- GitHub Pages serves from `https://` so mixed-content blocks HTTP
  fetches — Yahoo Finance endpoint must be HTTPS (it is).
- Add `portfolio_tracker.html` to the module grid in `index.html`
  and to the topnav in `suite.js`.

---

### P3 candidates (post-tracker)

- **Monte Carlo retirement projections** — replace single growth-assumption
  line in Retirement Planner with p10/p50/p90 distribution of outcomes.
- **Social Security estimator** — age-based benefit curves, breakeven
  analysis vs. early retirement age.
- **Net worth tracker / liabilities** — add liabilities side (mortgage
  balance, loans) to complement the asset picture; requires
  `suite-state.js` schema v2 migration with liabilities fields.
- **Asset Calc: AMT** — Alternative Minimum Tax calculation; NIIT is
  already there, AMT is the next relevant complexity for RSU-heavy
  households.
- **Print / PDF snapshot** — clean single-page household summary suitable
  for a financial advisor meeting; note `html2canvas` can't parse
  `color-mix(in oklab,...)` so use headless Chrome or a CSS print
  stylesheet instead.
- **Stale-data indicators** — warning chip on each snapshot tile when
  that section hasn't been updated in >30 days (compare
  `meta.lastUpdated` per section once schema supports per-section
  timestamps).
- **Shared household banner** — each adapter currently reimplements the
  banner independently; extract to a shared renderer in `suite.js` or a
  new `assets/banner.js` to reduce drift.
- **Dashboard compact mode** — collapse module cards, surface key input
  fields inline on the dashboard for fast data-entry without opening
  each tool.

### Deferred indefinitely

- Vite migration — only if scope demands it.
