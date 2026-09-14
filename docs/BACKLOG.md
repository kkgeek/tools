# Wealth Suite — Backlog

*Updated 2026-09-14, after Phase 13ad (purchase lots: CSV rows sharing a
ticker + account are kept as `holding.lots[]`; see CLAUDE.md Phase 13
log). This file is the resume point: pick the top
unchecked item unless directed otherwise.*

## Up next (roughly by value)

1. **Local-data mode for calculator-style tools** — the Settings
   "Empty-state display → Local data only" toggle (Phase 13ab) nulls every
   store-driven surface (dashboard, Estate Plan, Retirement Master Plan,
   Net Worth, Data Hub). The tools whose defaults are *inputs* rather than
   sample data — Tax Estimator, Roth, Monte Carlo, Social Security, Asset
   Calc, Portfolio Review, Golden φ — still show their built-in example
   figures with an empty store. Decide per tool whether local mode should
   blank the seeded inputs/outputs (or show an explicit "no household data
   — example inputs" notice) and wire it through each adapter's existing
   `meta.lastUpdated` gate. Note: `retirement.balances.total` is now
   IGNORED by the net-worth formulas whenever tax-advantaged holdings
   exist (double-count rule, Phase 13ab) — the Roth adapter still reads
   the scalar as the traditional balance; consider deriving it from
   Tax Deferred holdings too.

2. **AI chat re-homing** — `assets/ai/chat.js` + `briefing.js` still exist
   but nothing loads them since the Phase 13b shell rebuild. Decide: chat
   panel inside the shell? Delete briefing? (Needs a user product
   decision — moved to last on 2026-09-07.)

## Known issues / watchlist
- **Adapters never seed the store from a tool's defaults/sample copy on
  load** (Phase 13ac rule). Only user action, or a re-sync of data the
  tool already owns (`meta.lastEditedBy` = that tool), may write. New
  adapters must follow this — a load-time write reopens the "$1.25M
  with 0 holdings after visiting Review" bug class.
- **TaxAssetCalcv4 renders blank in *headless* Chrome** (Babel+D3 vs virtual-time). Fine in real browsers since the 7.29.7 pin. Don't chase it in headless tests.
- **Babel pin**: every React page must use `@babel/standalone@7.29.7` (Babel 8 rejects raw `>` in JSX text → blank page).
- `holding.costBasis` is **per-share** everywhere. Never write lot totals.
- **`holding.lots[]`** (Phase 13ad) holds a position's purchase lots
  (`{id, shares, costBasis per-share, purchaseDate}`) — present only when
  there is more than one. The holding's flat `shares`/`costBasis`/
  `purchaseDate` are ALWAYS the aggregate (Σ / weighted avg / earliest);
  keep them in sync when writing lots (use the page's `withLots`/
  `aggLots`). CSV import REPLACES a position's lots (snapshot semantics);
  the tracker add form APPENDS one. Dashboard charts expand lots.
- `holding.purchaseDate` is ISO `YYYY-MM-DD` or null. Null = "held forever"
  in the dashboard Performance table (full-period return) and in the NW
  Growth chart (Phase 13w — the lot is treated as always-held).
- `accounts[].taxTreatment` is `'Taxable' | 'Tax Free' | 'Tax Deferred'`;
  holdings link to the registry via `holding.account` (name string).
  Consumers fall back to `type`, then a name-based guess. `curated: true`
  marks anything user-set (hub inline edit, manual add, explicit CSV
  Account Type) — curated entries are never auto-healed by the
  name-guess self-heal (Phase 13u follow-up 5).
- **NW Growth chart no longer reads daily snapshots** (Phase 13w) — it
  reconstructs portfolio value at each point from cached price history
  (`localStorage['wealthSuite.priceHist']`, 24h TTL) × held shares, gated
  on `purchaseDate`. Daily snapshots (`wealthSuite.nwHistory`) are still
  recorded but nothing reads them for this chart anymore (kept for
  possible future use). Settings → Data Controls → "Clear chart caches"
  clears both.
- Tracker doesn't live-subscribe to store changes while open (iframe remount covers the shell case).

## Deferred indefinitely
- Site Map page (sidebar "Review → Site Map" stays a "Soon" chip; spec: `Site Map.dc.html` in the design handoff bundle, archived at `/mnt/data/Code/wealth-suite-design-handoff-2026-09-07.tar.gz`) — deferred by user 2026-07-08
- Vite migration (only if scope demands it)
- Cloudflare Pages + Access privacy migration (see memory: quote-infra-and-privacy-plan)

## Done recently (context for resuming)
- Phase 13ad: purchase lots — both CSV importers grouped rows by ticker +
  account but overwrote shares row-by-row, so only the LAST lot of a
  ticker survived. Rows now accumulate into `holding.lots[]` with the
  holding carrying the aggregate; Data Hub preview shows per-position lot
  counts; Portfolio Tracker rows gained a ▸ toggle that expands an
  editable per-lot table (add form appends a lot to an existing
  ticker+account); dashboard Performance table + NW Growth chart enter
  each lot at its own purchase date.
- Phase 13ac: critical — visiting Portfolio Review wrote its static
  "$1,250,000" header into an empty store (adapter now read-only), and
  the Tax Estimator's mount-time save mirrored default/stale inputs into
  an empty store (adapter now mirrors only after a user interaction or
  when the store is already tax-owned).
- Phase 13ab: Settings → Data Controls "Empty-state display" radio —
  Sample figures vs Local data only (`localStorage['wealthSuite.dataMode']`,
  `WealthSuite.getDataMode/setDataMode/isLocalData`); local mode renders
  "—"/empty on the dashboard (per card, partial data nulls only the gated
  cards), Estate Plan, and Retirement Master Plan (empty charts), and
  documents reload on a cross-document flip. Data Hub health strip flags
  an orphaned `portfolio.totalValue` (scalar set, 0 holdings) with a
  one-tap "Recompute from holdings"; the tracker now always writes
  `totalValue` (null when empty). Net Worth "Retirement accounts" =
  Tax Deferred + Tax Free holdings via `WealthSuite.holdingsByTreatment`
  and "Stock Portfolio" excludes them; the dashboard KPI + estate size
  ignore `retirement.balances.total` whenever such holdings exist.
- Phase 13aa: Net Worth tracker Assets card — icon + "Assets" title,
  "Stock Portfolio" rename, both store-fed rows link to the Portfolio
  Tracker (routes through the shell when embedded via `nwGo()`).
- Phase 13z: Dashboard — Spending vs Budget card now labels its sample
  state (static default + explicit "no <Month> transactions yet" when
  gated); the blank white frame below the footer was the `hidden`
  tool iframe still rendering (`.ws-frame[hidden]{display:none}`).
- Phase 13y: Data Hub paste/CSV without a header row now imports every
  row (first row was being eaten as the header) with Purchase Date /
  Account Name / Account Type read positionally; preview column
  renamed "Purchase Date".
- Phase 13x: Retirement Planning widget completion — Settings gained the
  last two missing gate inputs ("Annual spending in retirement",
  "Expected growth %/yr", stored as a fraction), the live fan chart
  resizes to the card's full width, and both the fan chart and the NW
  Growth chart gained a hover crosshair ("Age N · median $X / p10 $Y ·
  p90 $Z").
- Phase 13w (+ follow-up): NW Growth chart rebuilt from cached price
  history instead of daily snapshots — background download/cache of
  weekly/monthly price series per held ticker, time-scaled x-axis with
  in-SVG ticks, and a hover crosshair with value + date.
- Phase 13v (+ follow-up): Dashboard chart fixes — Settings Reset and a
  new standalone "Clear chart history" button purge poisoned local caches
  (nwHistory/perfSeries/briefingStats/briefingNarrative); range-pill axis
  granularity now follows the visible window's actual span; fixed a
  `growthAssumption` unit bug (fraction vs. percent) that silently broke
  the retirement Monte Carlo; a single snapshot now renders live instead
  of falling back to the sample.
- Phase 13u (+ 5 follow-ups): Account names + tax-treatment tracking —
  `accounts[].taxTreatment` convention, Portfolio Tracker gained an
  Account column + a second tile row (Taxable/Tax Free/Tax Deferred
  totals), Data Hub gained inline registry editing and an optional
  "Account Type" CSV column, and several import-matching bugs were fixed
  (Account Number vs. Account Name collisions, "Tax Free"-named accounts
  misclassified, poisoned auto-registrations self-heal on load).
- Phase 13t: Mobile sidebar fix — the Data Hub/Settings/avatar footer was
  unreachable on phones (non-scrolling block below the fold, `100vh`
  clipped behind the browser toolbar). Moved inside the scrollable nav
  list with `100dvh` fallback.
- Phase 13s: Dashboard shell UI cleanup — removed the topbar's
  back/new-tab/theme-cycle/Import-Data chips (redundant with sidebar nav
  and Settings → Appearance) and the sidebar's empty Review section.
- Phase 13r: purchase dates + since-purchase Performance table —
  `holding.purchaseDate` captured in the Data Hub (CSV auto-map +
  mapping editor + preview column) and Portfolio Tracker (CSV, add
  form, editable table column); dashboard "Your Portfolio" row is now a
  monthly chain-linked return where each lot enters at its purchase
  date, benchmarks clipped to the same window per column; no dates =
  old full-period behavior.
- Phase 13n–13q: Settings preferences consumed suite-wide (active
  scenario, fedBracket, currencyFormat, alert thresholds), Data Hub
  polish (column-mapping editor, in-hub price refresh, in-hub expense CSV
  import), Estate Plan live figures, and Retirement Master Plan live
  figures — all summarized in [Release 5](releases/release-5.md).
- Release 5: theme → shell → single-window nav → Data Hub (schema v5) →
  Settings → fully live dashboard → Tailwind reskin → Babel-pin fix →
  Estate Plan standalone → account/tax-treatment tracking → chart
  rebuilds. All PRs #12–#43 merged; linear history on `main`. Full detail
  in [`docs/releases/release-5.md`](releases/release-5.md).
