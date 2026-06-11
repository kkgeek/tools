# Wealth Suite Revamp — IA + Expenses + GenAI + MD3

> **Status:** Proposal · Not yet implemented  
> **Scope:** Reorganise navigation around tracking-vs-tools, add expense tracking, embed a GenAI chat grounded on store data, ship a daily briefing, unify on Material Design 3.

---

## 1. Goals

| # | Goal | Outcome |
|---|---|---|
| 1 | Reorganise IA into 5 clusters (Home, Tracking, Retirement, Tax, Tools) | Faster mental model — trackers vs. calculators |
| 2 | Add expense tracking with CSV import | Actual spend feeds retirement assumption |
| 3 | Embed GenAI chat (Gemini default, WebLLM toggle) | Natural-language queries grounded on store data |
| 4 | Daily portfolio briefing on dashboard | At-a-glance day/week/MTD/YTD vs SPX |
| 5 | Unify all 11 tools on Material Design 3 tokens | End the per-tool styling drift |

---

## 2. New information architecture

```
Wealth Suite
├── 🏠 Home (Dashboard)
│     ├─ Daily briefing (top)
│     ├─ GenAI chat
│     ├─ Snapshot tiles
│     └─ Quick Entry
├── 📊 Tracking
│     ├─ Portfolio Tracker  (live holdings)
│     ├─ Portfolio Review   (concentration analysis)
│     ├─ Net Worth Tracker
│     └─ Expenses           ⭐ NEW
├── 🎯 Retirement
│     ├─ Retirement Master Plan
│     └─ Monte Carlo Projections
├── 💰 Tax
│     └─ Tax Estimator
└── 🧮 Tools
      ├─ Social Security Estimator
      ├─ Roth Conversion Planner
      ├─ Golden φ Portfolio
      └─ Asset & Cap-Gains Calc
```

**Why this split:** Tracking = continuous live data you maintain. Tools = situational calculators you reach for when making a decision. Retirement and Tax are major life events that get their own cluster.

### 2a. Desktop nav

```
┌────────────────────────────────────────────────────────────────────┐
│  W Wealth Suite   [ Home │ Tracking │ Retirement │ Tax │ Tools ]  ☀│
└────────────────────────────────────────────────────────────────────┘
                       ↓ (when "Tracking" is active)
┌────────────────────────────────────────────────────────────────────┐
│  Tracker  │  Review  │  Net Worth  │  Expenses                    │
└────────────────────────────────────────────────────────────────────┘
```

- 5 primary tabs always visible
- Tool sub-nav appears below when a cluster is active (Home and Tax have none — they're single-page)
- Cluster tab shows a green dot when any tool in that cluster has store data

### 2b. Mobile nav

5-icon bottom tab bar (Home / Tracking / Retire / Tax / Tools). Tapping a cluster with multiple tools opens a bottom sheet.

---

## 3. Expense tracking (new tool)

### 3a. File: `expenses.html`

Standalone single-file tool (React 18 + Tailwind + Chart.js — same stack as Tax Estimator).

### 3b. Store schema addition (v1 → v2 migration)

```js
expenses: {
  transactions: [
    {
      id: 'tx_<uuid>',
      date: 'YYYY-MM-DD',
      amount: -123.45,             // negative = expense, positive = refund
      category: 'groceries',
      merchant: 'Whole Foods',
      account: 'Chase Sapphire',
      note: '',
      source: 'manual'|'csv-import',
    }
  ],
  categories: [
    { id: 'groceries', label: 'Groceries', color: '#4caf50', budgetMonthly: 1200 },
    { id: 'dining',    label: 'Dining',    color: '#ff9800', budgetMonthly: 600  },
    // ... housing, utilities, transport, healthcare, entertainment, travel, other
  ],
  importHistory: [
    { id, importedAt, source: 'chase-csv'|'amex-csv'|'generic-csv', count, fileName }
  ],
}
```

Bumps `meta.version: 1 → 2`. `migrate()` in `suite-state.js` adds the empty `expenses` block to existing stores. Backward compatible — tools that don't read `expenses` ignore it.

### 3c. CSV import — parsers (mirror brokerage CSV pattern from `portfolio_tracker.html`)

| Source | Key columns |
|---|---|
| Chase | `Transaction Date`, `Description`, `Amount`, `Category` |
| Amex | `Date`, `Description`, `Amount` |
| Citi | `Date`, `Description`, `Debit`, `Credit` |
| Generic | `date`, `description`, `amount`, `category` (4-col, any bank) |

Auto-categorisation: regex/keyword map (`whole foods` → groceries, `chevron` → transport, etc.) with user override. Persist learned mappings to `expenses.merchantMap` for future imports.

### 3d. Views

1. **Month view** — calendar grid + daily totals
2. **By category** — donut + bar chart of spend vs budget per category (Chart.js)
3. **Transactions table** — sortable, filterable list with inline category edit
4. **Trend** — 12-month line chart of total monthly spend

### 3e. Integration with retirement

Add an "Adopt actual spend" button in Retirement Master Plan that sets `retirement.plan.annualExpenses` from `expenses` (trailing-12-month average, x 12). The $90k assumption becomes computed rather than guessed.

### 3f. Adapter: `assets/adapters/expenses.js`

- Reads store on load (empty array OK for new users)
- Writes back on every transaction add/edit/delete (debounced 250ms)
- Sets `meta.lastEditedBy = 'expenses'`
- Notifies dashboard so the snapshot tile updates

---

## 4. GenAI chat — Gemini default + WebLLM privacy toggle

### 4a. Default path: Gemini 2.5 Flash via direct browser fetch

- User supplies API key in Settings (stored at `preferences.aiKey` in localStorage)
- Stored key is masked in the UI (`••••••••abc1`)
- An opt-in modal on first use: *"Your financial data will be sent to Google's Gemini API to answer your questions. You can switch to a local AI later. Continue?"*
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`

### 4b. Grounding via tool/function calls

Cleaner than dumping the full store JSON. Define a small set of read-only tool functions that the model can call:

```js
const tools = [
  { name: 'getHousehold',          description: 'Spouses, ages, filing status, state' },
  { name: 'getIncome',             description: 'Salary, bonus, RSU vests, capital gains' },
  { name: 'getRetirementPlan',     description: 'Target age, balances, spending, growth assumption' },
  { name: 'getPortfolioHoldings',  description: 'All current holdings: ticker, shares, value, allocation' },
  { name: 'getSpending',           description: 'Last N months of expenses by category' },
  { name: 'getMonteCarloResults',  description: 'p10/p50/p90 retirement outcomes' },
  { name: 'getTaxEstimate',        description: 'Current year projected federal + state tax' },
  { name: 'getRothSchedule',       description: 'Current Roth conversion schedule if any' },
];
```

Each function returns a small JSON slice (~500B–5KB). Model picks which to call per question.

### 4c. Privacy path: WebLLM toggle

- Settings has a toggle: **"Use local AI (no data leaves device)"**
- When enabled, the chat uses [WebLLM](https://webllm.mlc.ai) with Llama 3.1 8B Instruct (~4GB)
- First-use modal: *"First-time download is ~4GB and takes 5–15 minutes. The model then runs entirely in your browser."*
- Same tool/function call interface — calc happens client-side either way
- Lazy-load WebLLM bundle only when toggled on (don't bloat default bundle)

### 4d. Chat UX on the dashboard

```
┌────────────────────────────────────────────────────────────┐
│  Ask anything about your finances                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ e.g. Am I on track to retire at 62? │ How much...   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  💬 Suggested:                                             │
│  ▸ Am I on track to retire?                                │
│  ▸ Where is my biggest spend leak this month?              │
│  ▸ Should I do a Roth conversion this year?                │
└────────────────────────────────────────────────────────────┘
```

- Multi-turn conversation persisted in `sessionStorage` (not exported)
- Each AI answer shows which `tool` calls were made (transparency: "Used: getHoldings, getRetirementPlan")
- "Copy answer" + "Open relevant tool" CTAs

### 4e. File: `assets/ai/chat.js`

Provider abstraction:

```js
class AIProvider {
  async ask(prompt, tools) { throw new Error('abstract'); }
}
class GeminiProvider extends AIProvider { /* fetch from googleapis */ }
class WebLLMProvider extends AIProvider { /* @mlc-ai/web-llm */ }

const provider = store.get('preferences.aiProvider') === 'local'
  ? new WebLLMProvider()
  : new GeminiProvider(store.get('preferences.aiKey'));
```

---

## 5. Daily briefing

### 5a. What it shows (top of dashboard)

```
┌──────────────────────────────────────────────────────────────┐
│  Tuesday · May 20                                            │
│  Portfolio   $1.265M     +$3,200  (+0.25%)   vs SPX +0.41%   │
│  Today's mover  NVDA  +2.1%   ·   YTD +9.4%                  │
│                                                              │
│  💬 "Up modestly today, trailing SPX by 16bps. Tech leading. │
│     NVDA continues to outperform — +18% MTD."                │
└──────────────────────────────────────────────────────────────┘
```

### 5b. Computed layer (no AI needed)

Pure JS, runs on dashboard load:

- Fetch latest prices via Yahoo Finance (already cached in `portfolio.holdings[].currentPrice`)
- Fetch SPX (^GSPC) and QQQ for benchmarks
- Compute: day $/% , week, MTD, YTD
- Biggest mover (highest abs day change %)
- Sector/asset-class concentration of today's move

### 5c. Narrative layer (only if AI is enabled)

- 2-sentence Gemini Flash summary of the numbers
- Cached for the current trading day (refreshes only when SPX last-trade timestamp advances)
- Stored in `dailyBriefing.cache: { date, summary, computedStats }`
- If AI is disabled, just shows the numbers — no narrative

### 5d. File: `assets/ai/briefing.js`

Triggered on dashboard load. Runs in background; tile shows skeleton until ready.

---

## 6. Material Design 3 unification

### 6a. Generate canonical token set

Use [Material Theme Builder](https://m3.material.io/theme-builder) with seed colour `#6750A4` (or user-pickable). Export to CSS custom properties:

```css
:root {
  /* Surface */
  --md-sys-color-surface:                 #fef7ff;
  --md-sys-color-surface-container:       #f3edf7;
  --md-sys-color-surface-container-high:  #ece6f0;
  --md-sys-color-on-surface:              #1d1b20;

  /* Primary */
  --md-sys-color-primary:                 #6750a4;
  --md-sys-color-on-primary:              #ffffff;
  --md-sys-color-primary-container:       #eaddff;
  --md-sys-color-on-primary-container:    #21005d;

  /* Semantic status (per UX redesign proposal) */
  --status-positive: #2e7d32;
  --status-warning:  #ed6c02;
  --status-critical: #c62828;
  --status-info:     #0288d1;
  --status-neutral:  #5f6368;
}

[data-theme="dark"] {
  /* Inverted MD3 palette */
  --md-sys-color-surface:                 #141218;
  --md-sys-color-surface-container:       #211f26;
  /* ... */
}
```

### 6b. Migration of 11 tools

Each tool currently defines its own `--bg`, `--fg`, `--card`, etc. Replace with MD3 token refs:

```css
/* Before (golden_ratio_portfolio_dashboard.html) */
:root { --bg: #0a0e1a; --card: #131825; }

/* After */
:root { --bg: var(--md-sys-color-surface); --card: var(--md-sys-color-surface-container); }
```

Phase D of the existing UX redesign proposal already covers font (Inter), spacing (4-point), and radius (10px/6px) unification. This proposal extends it with colour tokens.

### 6c. Tools to update

All 11 tools currently override colours. Audit list:
- `index.html` → already mostly MD3, finish unification
- `TaxEstimatorV5.html` → Tailwind override layer needed
- `TaxAssetCalcv4.html` → same
- `retirement_master_plan_2.html` → custom CSS vars
- `portfolio_review.html` → custom CSS vars
- `golden_ratio_portfolio_dashboard.html` → artifact tokens
- `roth_conversion.html` → Tailwind
- `portfolio_tracker.html` → Tailwind
- `social_security.html` → custom CSS vars
- `monte_carlo.html` → custom CSS vars
- `expenses.html` (new) → MD3 from day one

---

## 7. Store schema v2 — full additions

```js
{
  meta: { version: 2, lastUpdated, lastEditedBy },
  // ... existing v1 sections unchanged ...

  expenses: { transactions, categories, importHistory, merchantMap },

  preferences: {
    taxYear: 2026,
    aiProvider: 'gemini'|'local'|'off',  // NEW
    aiKey: '',                            // NEW — masked
    theme: 'light'|'dark'|'auto',         // NEW
    seedColor: '#6750A4',                 // NEW — for MD3 theme
  },

  dailyBriefing: {                        // NEW — cache only, no PII
    cache: { date, summary, computedStats },
  },

  ai: {                                   // NEW — conversation history, optional persist
    conversations: [{ id, startedAt, messages: [{role, content, toolCalls}] }],
  },
}
```

Migration in `suite-state.js`:

```js
function migrate(state) {
  if (state.meta.version === 1) {
    state.expenses = { transactions: [], categories: defaultCategories, importHistory: [], merchantMap: {} };
    state.preferences.aiProvider = 'off';
    state.preferences.aiKey = '';
    state.preferences.theme = 'auto';
    state.preferences.seedColor = '#6750A4';
    state.dailyBriefing = { cache: null };
    state.ai = { conversations: [] };
    state.meta.version = 2;
  }
  return state;
}
```

---

## 8. Phased roadmap

### Phase 8 — IA + MD3 (4–6 days)

1. Restructure topnav into 5 clusters in `suite.js`
2. Move tools into new cluster groupings
3. Generate MD3 token set; apply to `suite.css`
4. Migrate all 11 tools to MD3 tokens
5. Unify font (Inter), spacing, radius across tools

Ships: visual coherence + simpler nav. No new features yet.

### Phase 9 — Expense tracking (5–7 days)

1. Build `expenses.html` (React + Chart.js)
2. CSV parsers (Chase / Amex / Citi / Generic)
3. Auto-categorisation + merchant map
4. Calendar / by-category / trend views
5. `expenses.js` adapter + v1→v2 migration
6. "Adopt actual spend" hook in Retirement Master Plan

Ships: full expense tracker integrated with retirement planning.

### Phase 10 — Daily briefing (2–3 days)

1. Computed briefing tile (day/week/MTD/YTD + benchmarks)
2. Yahoo Finance benchmark fetch (SPX, QQQ)
3. Cache layer keyed on trading-day timestamp
4. Tile on top of dashboard

Ships: zero-AI briefing always-on. Narrative layer comes in Phase 11.

### Phase 11 — GenAI chat (7–10 days)

1. `assets/ai/chat.js` provider abstraction
2. `GeminiProvider` — Gemini 2.5 Flash + tool/function calls
3. Tool function registry (`getHousehold`, `getHoldings`, etc.)
4. Chat UI on dashboard with suggested prompts
5. Settings: API key entry, opt-in modal, on/off toggle
6. Briefing narrative layer (`assets/ai/briefing.js`)
7. `WebLLMProvider` — lazy-loaded, opt-in toggle
8. Tool-call transparency in chat answers ("Used: getHoldings")

Ships: full conversational interface, both cloud and local paths.

### Phase 12 — Polish (2–3 days)

1. Conversation history export/import
2. "Open relevant tool" deep links from chat answers
3. Suggested-prompt rotation based on store contents
4. A11y pass on chat (screen reader, keyboard nav)

---

## 9. Constraints preserved

- **Zero build step.** All new tools follow the inline-CDN pattern. WebLLM loads from CDN on demand.
- **Tools stay self-contained.** Each tool still works without `suite.js` loaded.
- **Privacy default: off.** GenAI starts **disabled**. User must explicitly opt in. Default briefing has no AI narrative.
- **No backend.** Gemini calls go browser→Google directly. No proxy server.
- **GitHub Pages public repo.** API key never leaves user's localStorage.

---

## 10. Open questions for implementation

1. **Categorisation taxonomy** — adopt a standard (Mint's 14 categories? YNAB's flexible group system?) or roll our own minimal set?
2. **Briefing benchmark choice** — SPX + QQQ default, or user-pickable (60/40 portfolio, custom)?
3. **AI conversation persistence** — session only, or persist to localStorage and include in export JSON? (Latter exposes more PII in backup files.)
4. **Tool-call rate limits** — Gemini Flash free tier is 15 req/min. Throttle multi-turn chats?
5. **WebLLM model choice** — Llama 3.1 8B (4GB, smart) vs Phi-3 Mini (2GB, faster, less capable)?

---

## 11. Out of scope (this revamp)

- Liabilities side of net worth (Phase 13+)
- Plaid / Teller live bank linking
- Multi-currency
- Investment recommendations (regulatory risk)
