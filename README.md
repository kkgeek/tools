# Wealth Suite

Personal-finance hub that runs **entirely in your browser**. Twelve tools live inside one app shell — a collapsible sidebar, single-window navigation, and a **Data Hub** that is the single source of truth: enter your accounts, holdings, and assets once and every tool reads from the same store.

**Live:** <https://kkgeek.github.io/tools/>

**End-user guide:** [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)

**Release notes:** [docs/releases/](docs/releases/) · **Backlog / resume point:** [docs/BACKLOG.md](docs/BACKLOG.md)

---

## The shell

`index.html` is the app: sidebar (Track / Plan / Optimization Tools sections, collapsible to an icon rail; off-canvas drawer on phones), top bar (theme cycle, household chip), and a hash router that opens every tool **in the same window** — deep-linkable as `index.html#tool.html`. The dashboard's KPI tiles, charts, Monte Carlo readiness, spending bars, and benchmark performance table all render **live from your data** (illustrative sample figures until you add some).

| Page | What it does |
|---|---|
| [Dashboard](https://kkgeek.github.io/tools/index.html) | Net worth · portfolio · retirement readiness (1,000-path Monte Carlo) · spending vs budget · performance vs benchmarks |
| [Data Hub](https://kkgeek.github.io/tools/data_hub.html) | **All data entry.** Brokerage CSV import · accounts registry · other assets · liabilities · JSON backup |
| [Settings](https://kkgeek.github.io/tools/settings.html) | Household profile · scenarios · tax profile · theme + accent · alerts · reset |

## Tools

| Tool | What it does |
|---|---|
| [Net Worth Tracker](https://kkgeek.github.io/tools/net_worth.html) | Assets from the hub + manual entries · liabilities · debt ratio |
| [Portfolio Tracker](https://kkgeek.github.io/tools/portfolio_tracker.html) | Live prices (self-hosted quote proxy) · CSV import · allocation donut · projections |
| [Expense Tracker](https://kkgeek.github.io/tools/expenses.html) | Bank CSV import (Chase/Amex/Citi) · auto-categorisation · budgets · trends |
| [Retirement Master Plan](https://kkgeek.github.io/tools/retirement_master_plan_2.html) | Long-horizon projection · RMD calculator · 3-year buffer · Roth + SS strategy |
| [Estate Plan](https://kkgeek.github.io/tools/estate_plan.html) | Federal (OBBBA) + WA estate tax · trust strategy · beneficiary audit |
| [Tax Estimator](https://kkgeek.github.io/tools/TaxEstimatorV5.html) | Federal + WA tax 2024–2041 · AMT · NIIT · RSU supplemental gap · quarterlies |
| [Roth Conversion Planner](https://kkgeek.github.io/tools/roth_conversion.html) | Fill-to-bracket conversion schedule · balance projection |
| [Social Security Estimator](https://kkgeek.github.io/tools/social_security.html) | Claiming-age slider 62–70 · break-even analysis |
| [Asset & Cap-Gains Calc](https://kkgeek.github.io/tools/TaxAssetCalcv4.html) | Capital-gains scenarios · asset allocation modelling |
| [Portfolio Review](https://kkgeek.github.io/tools/portfolio_review.html) | Concentration-risk analysis · target allocation · diversification plan |
| [Golden φ Portfolio](https://kkgeek.github.io/tools/golden_ratio_portfolio_dashboard.html) | Phi-derived allocation · sequence-of-returns stress test |
| [Monte Carlo Projections](https://kkgeek.github.io/tools/monte_carlo.html) | 1,000 simulations · p10/p50/p90 fan chart · success probability |

---

## Release history

| Release | Theme | Docs |
|---|---|---|
| [Release 1](docs/releases/release-1.md) | Core tools + dashboard shell | Five standalone tools, topbar, theme |
| [Release 2](docs/releases/release-2.md) | Shared store + adapters | Cross-tool sync, snapshot tiles, Export/Import/Reset |
| [Release 3](docs/releases/release-3.md) | Dashboard enhancements | Named scenarios, CSV export, Quick Entry, dark mode everywhere |
| [Release 4](docs/releases/release-4.md) | New tools | Roth, Portfolio Tracker, Social Security, Net Worth, Monte Carlo |
| [Release 5](docs/releases/release-5.md) | Design-handoff shell | Sidebar app shell, single-window nav, Data Hub, Settings, fully live dashboard, Estate Plan |

---

## Architecture

- **Zero build step** — React 18 + Tailwind + D3 + Chart.js via CDN; no Vite, no bundler
- **App shell + iframe router** — `index.html` owns the sidebar/top bar; tools load in an iframe via hash routes so shell state never resets; every tool still works standalone
- **Single-file tools** — each tool is one self-contained HTML file
- **Central store** — `assets/suite-state.js` (schema v5) persists to `localStorage`, cross-tab sync via `storage` event; the Data Hub writes, tools read
- **Design tokens** — `assets/theme.css` (light/dark palettes) + `assets/tw-reskin.css` (re-points Tailwind utilities); accent picker re-colors the whole suite
- **Quotes** — Yahoo Finance via a self-hosted Cloudflare Worker proxy (`worker/`); only public ticker symbols leave the browser
- **Privacy** — no personal data leaves the browser; no accounts, no analytics, no server

## Running locally

```bash
python3 -m http.server 3001 --bind 127.0.0.1
# open http://127.0.0.1:3001/
```

Any static file server works. Gotchas when editing:
- After changing any file under `assets/`, bump the `?v=N` query string on every page that references it (no cache headers locally).
- Every React page must pin `@babel/standalone@7.29.7` — unpinned CDN URLs serve Babel 8, which blank-pages on raw `>` in JSX text.
