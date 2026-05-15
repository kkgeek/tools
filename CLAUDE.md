# CLAUDE.md — Wealth Suite

Modular personal-finance hub: 5 single-file HTML tools unified under a
Material Design 3 dashboard. **No build step.** Tailwind/React/D3 via
CDN where used. Deploys to GitHub Pages on every push to `main` via
`.github/workflows/pages.yml`.

End-user docs: [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) —
read first if unfamiliar with the suite.

## Tools (5 modules)

| File | Stack | Adapter |
|---|---|---|
| `TaxEstimatorV5.html` | React 18 + Tailwind + Babel inline | `assets/adapters/tax.js` (bidirectional with `taxSuiteInputs_v2`) |
| `TaxAssetCalcv4.html` | React 18 + Tailwind + D3 | `assets/adapters/asset.js` (opt-in "Apply" buttons) |
| `retirement_master_plan_2.html` | Vanilla JS + custom CSS vars | `assets/adapters/retirement.js` (RMD slider ↔ store; seeds projection chart from portfolio.totalValue + annualExpenses) |
| `portfolio_review.html` | Vanilla JS + custom CSS vars | `assets/adapters/portfolio.js` (DOM parse on load; scales Target Allocation table from portAtRetire; updates buffer target from annualExpenses) |
| `golden_ratio_portfolio_dashboard.html` | Vanilla JS + artifact tokens | `assets/adapters/golden.js` (read-only: seeds sI from portfolio.totalValue, sW from annualExpenses/totalValue) |

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
- `assets/suite.css?v=7` (index.html only — adds CSV dropdown styles)
- `assets/dashboard.js?v=8` (index.html only — adds CSV section export)

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

## Phase 3 candidates

- Refactor Portfolio Review to take portfolio data as input.
- Refactor Retirement Master Plan to compute projection inputs from
  household data (`port`, `spend`, etc. currently hardcoded).
- Extend Asset Calc tax-year support beyond 2024/2025.
- Golden φ adapter.
- Named scenarios ("retire at 55", "retire at 60") switchable from
  dashboard.
- CSV export per section.
- Vite migration — only if scope demands it.
