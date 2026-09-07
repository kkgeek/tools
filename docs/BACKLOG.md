# Wealth Suite — Backlog

*Updated 2026-09-07, after Phase 13aa (post-release bug batch: headerless
paste import, Spending sample label, blank frame, Net Worth Assets card;
see CLAUDE.md Phase 13 log). This file is the resume point: pick the top
unchecked item unless directed otherwise.*

## Up next (roughly by value)

1. **AI chat re-homing** — `assets/ai/chat.js` + `briefing.js` still exist
   but nothing loads them since the Phase 13b shell rebuild. Decide: chat
   panel inside the shell? Delete briefing? (Needs a user product
   decision.)

2. **Data Hub health strip: flag orphaned `portfolio.totalValue`** — when
   the scalar is set but `portfolio.holdings` is empty, show a stale-data
   warning in the hub's health strip with a one-tap "recompute from
   holdings" fix (writes `total || null`, same as the hub's existing
   `recompute()`). Context: legacy pre-hub paths (old dashboard
   quick-entry) wrote the scalar without holdings, and the tracker only
   writes `totalValue` when > 0 — deleting all holdings orphans the last
   value (seen live on the user's phone, 2026-07-10: "$4.75M · 0
   holdings"). Optional companion fix: make the tracker always write
   `totalValue` (null when holdings empty). Still open as of Phase 13aa.

3. **Feed "Retirement accounts" in the Net Worth tracker from the
   tracker's Tax Deferred + Tax Free account totals** — the row reads
   `retirement.balances.total`, which nothing in the Data Hub / Settings /
   Tracker flow writes (only the legacy Retirement/Tax paths), so it shows
   "—" even when the Portfolio Tracker's second tile row shows real Tax
   Deferred / Tax Free totals (Phase 13u). Plan: compute Σ (currentPrice||
   costBasis)×shares over holdings whose `account` resolves (registry →
   type → name guess, same chain as the tracker) to Tax Deferred or Tax
   Free, and either (a) have the tracker write it to
   `retirement.balances.total` on sync, or (b) have net_worth.html derive
   it live. Watch the double-count: "Stock Portfolio" = `portfolio.
   totalValue` already INCLUDES those same holdings, so the Assets card
   must subtract retirement-account holdings from the Stock Portfolio row
   (or relabel it "Taxable brokerage") when this lands. The dashboard KPI
   net-worth formula (portfolio + otherAssets + retirement.balances.total)
   has the same double-count exposure. Requested 2026-09-07.

## Known issues / watchlist
- **TaxAssetCalcv4 renders blank in *headless* Chrome** (Babel+D3 vs virtual-time). Fine in real browsers since the 7.29.7 pin. Don't chase it in headless tests.
- **Babel pin**: every React page must use `@babel/standalone@7.29.7` (Babel 8 rejects raw `>` in JSX text → blank page).
- `holding.costBasis` is **per-share** everywhere. Never write lot totals.
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
- Site Map page (sidebar "Review → Site Map" stays a "Soon" chip; spec: `Site Map.dc.html` in the design handoff bundle) — deferred by user 2026-07-08
- Vite migration (only if scope demands it)
- Cloudflare Pages + Access privacy migration (see memory: quote-infra-and-privacy-plan)

## Done recently (context for resuming)
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
