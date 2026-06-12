# CLAUDE.md — Wealth Suite

Modular personal-finance hub: 5 single-file HTML tools unified under a
Material Design 3 dashboard. **No build step.** Tailwind/React/D3 via
CDN where used. Deploys to GitHub Pages on every push to `main` via
`.github/workflows/pages.yml`.

End-user docs: [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) —
read first if unfamiliar with the suite.

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
  assetClass }  // assetClass: 'equity'|'bond'|'cash'|'other'
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
