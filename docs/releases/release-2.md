# Release 2 — Suite Shell & Shared State

> **Phase 2** · Cross-tool state synchronisation, JSON backup, end-user docs

All five tools now share a single household snapshot stored in `localStorage`. Enter income in the Tax Estimator and the Retirement Planner, Portfolio Review, and Asset Calculator see the same numbers automatically — no copy-pasting.

---

## New infrastructure

### Central store (`assets/suite-state.js`)

A 200-line vanilla-JS module that is the backbone of the suite.

```
window.WealthSuite.store
  .get('income.salary.s1')          // dotted-path read
  .set('retirement.plan.targetRetireAge', 60, { editedBy: 'retirement' })
  .update(patch)                    // shallow merge
  .subscribe('income', callback)    // path-scoped change listener
  .export()                         // returns full state snapshot
  .import(json)                     // validates + merges + notifies all listeners
  .reset()                          // wipes to empty state, preserves theme
```

Persistence: writes to `localStorage.wealthSuite.state` on every change. Cross-tab sync via `window.addEventListener('storage', …)`.

Schema version: `meta.version = 1`. A `migrate()` function handles future schema bumps.

Store schema (abbreviated):
```js
{
  meta: { version, lastUpdated, lastEditedBy },
  household: { filingStatus, spouses: [{name, age}, …], location: { state } },
  income: { salary: {s1, s2}, bonus: {s1, s2}, rsuVests: {s1, s2}, capitalGains: {shortTerm, longTerm} },
  retirement: {
    contributions: { traditional401k: {s1,s2}, roth401k: {s1,s2}, … hsa },
    balances: { total, breakdown: {} },
    plan: { targetRetireAge, annualExpenses, growthAssumption },
  },
  portfolio: { totalValue, allocations: {}, holdings: [] },
  deductions: { method, mortgage, salt, charitable },
  preferences: { taxYear },
}
```

---

## New adapters

Each adapter is a separate `assets/adapters/*.js` file that wires a tool to the store **without modifying the tool's internals**. Tools remain fully functional standalone.

### Tax adapter (`adapters/tax.js`)

The most complex adapter — bidirectional sync with the React-based Tax Estimator.

- **On load:** reads `taxSuiteInputs_v2` from `localStorage` (Tax Estimator's own save key); mirrors spouse names, ages, income, contributions, capital gains, filing status into the suite store
- **Bidirectional write-back:** patches `taxSuiteInputs_v2` via `localStorage.setItem` so Tax Estimator's own state stays in sync; the Tax Estimator adapter listens for `storage` events to detect external changes
- **Cross-tab detection:** when the suite store is updated in another tab (e.g. an import), a yellow "Data updated in JSON import — Reload to pull the latest" banner appears under the Tax Estimator's topbar

### Retirement adapter (`adapters/retirement.js`)

- **RMD slider → store:** the traditional-IRA balance slider in the RMD Calculator writes `retirement.balances.total` to the suite store in real time; the dashboard "Retirement balance" tile reflects the slider position
- **Household banner:** a small all-caps subtitle under the page title shows household income, contributions, and ages from the store

### Portfolio adapter (`adapters/portfolio.js`)

- **DOM parse on load:** the adapter reads the portfolio total from the page's HTML header and writes `portfolio.totalValue` + a coarse `portfolio.allocations` map to the store
- One-shot, no write-back required (Portfolio Review is a static report)

### Asset Calculator adapter (`adapters/asset.js`)

- **Apply buttons:** two banners appear above the Capital Gains and Asset Allocation forms — one showing the suite's household income/gains, one showing portfolio value — each with an "Apply" button that pre-fills the form below from the store
- The adapter uses a `requestAnimationFrame`-throttled `MutationObserver` to detect when React has mounted the form before injecting the banner

---

## Dashboard enhancements

### 5-tile Snapshot widget

The dashboard Snapshot card now displays five live tiles sourced from the store:

| Tile | Source |
|---|---|
| **Household** | names, filing status, state — from Tax Estimator |
| **Projected income** | salary + bonus + RSU + capital gains (both spouses) |
| **Retirement contributions** | 401(k) + IRA + HSA totals this year |
| **Retirement balance** | `retirement.balances.total` from RMD slider |
| **Portfolio value** | `portfolio.totalValue` from Portfolio Review visit |

The tile section also shows "Last updated by [tool] · [timestamp]" to help track data freshness.

### Export / Import / Reset actions

Three chips next to the Snapshot title:

- **Export JSON** — downloads `wealth-suite-export-YYYY-MM-DD.json`, a self-contained backup of the entire state.
- **Import JSON** — prompts for file selection, validates the envelope (`wealth-suite-export-v1` or raw `meta.version` object), confirms before overwriting.
- **Reset** — wipes snapshot and `taxSuiteInputs_v2`. Shows a confirm dialog first. Theme preference and IRS rates cache are preserved.

---

## End-user docs

`docs/GETTING_STARTED.md` added: 5-minute walkthrough, backup guide, tips & gotchas, troubleshooting. Screenshots at `docs/screenshots/`.

---

## Cross-tab edit detection

When any tool's adapter writes to the store, and the same store is open in another tab:

1. `localStorage`'s `storage` event fires in the other tab
2. The store re-parses state and emits to all subscribers
3. The active tool adapter receives the callback and can show a "stale data" indicator

This means entering data in Tax Estimator in Tab A automatically refreshes the Snapshot in Tab B's dashboard without a page reload.
