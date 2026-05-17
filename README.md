# Wealth Suite

Personal-finance hub that runs **entirely in your browser**. Eleven specialised tools share one household snapshot — enter your income once, every tool sees it.

**Live:** <https://kkgeek.github.io/tools/>

**End-user guide:** [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)

**Release notes:** [docs/releases/](docs/releases/)

---

## Modules

| Module | What it does |
|---|---|
| [Dashboard](https://kkgeek.github.io/tools/index.html) | Household snapshot · Named scenarios · Quick Entry panel · Export/Import/Reset |
| [Tax Estimator](https://kkgeek.github.io/tools/TaxEstimatorV5.html) | Federal + WA tax 2024–2041 · AMT · NIIT · RSU supplemental gap · quarterly payments |
| [Asset & Cap-Gains Calc](https://kkgeek.github.io/tools/TaxAssetCalcv4.html) | Capital-gains scenarios · Asset allocation modelling · 2024–2026 brackets |
| [Retirement Master Plan](https://kkgeek.github.io/tools/retirement_master_plan_2.html) | Long-horizon projection · RMD calculator · 3-year buffer · Roth + SS strategy |
| [Portfolio Review](https://kkgeek.github.io/tools/portfolio_review.html) | 140-position concentration-risk analysis · Target allocation · Diversification plan |
| [Golden φ Portfolio](https://kkgeek.github.io/tools/golden_ratio_portfolio_dashboard.html) | Phi-derived allocation · 15-year projection · Sequence-of-returns stress test |
| [Roth Conversion Planner](https://kkgeek.github.io/tools/roth_conversion.html) | Fill-to-bracket conversion schedule · Roth vs. traditional balance projection |
| [Portfolio Tracker](https://kkgeek.github.io/tools/portfolio_tracker.html) | Brokerage CSV import · Live Yahoo Finance prices · D3 allocation donut + projections |
| [Social Security Estimator](https://kkgeek.github.io/tools/social_security.html) | Claiming-age slider 62–70 · Break-even analysis · Cumulative benefit chart |
| [Net Worth Tracker](https://kkgeek.github.io/tools/net_worth.html) | Assets from store + manual entries · Liabilities table · Net worth summary |
| [Monte Carlo Projections](https://kkgeek.github.io/tools/monte_carlo.html) | 1,000 simulations · p10/p50/p90 fan chart · Success probability · Hover tooltip |

---

## Release history

| Release | Theme | Docs |
|---|---|---|
| [Release 1](docs/releases/release-1.md) | Core tools + dashboard shell | Five standalone tools, topbar, theme |
| [Release 2](docs/releases/release-2.md) | Shared store + adapters | Cross-tool sync, snapshot tiles, Export/Import/Reset |
| [Release 3](docs/releases/release-3.md) | Dashboard enhancements | Named scenarios, CSV export, Quick Entry, dark mode everywhere |
| [Release 4](docs/releases/release-4.md) | New tools | Roth, Portfolio Tracker, Social Security, Net Worth, Monte Carlo |

---

## Architecture

- **Zero build step** — React 18 + Tailwind + D3 + Chart.js via CDN; no Vite, no bundler
- **Single-file tools** — each tool is one self-contained HTML file; works standalone without the suite shell
- **Central store** — `assets/suite-state.js` persists to `localStorage`, cross-tab sync via `storage` event
- **Adapter pattern** — `assets/adapters/*.js` wires each tool to the store without touching tool internals
- **Privacy** — no data leaves the browser; no accounts, no analytics, no server

## Running locally

```bash
python3 -m http.server 3001 --bind 127.0.0.1
# open http://127.0.0.1:3001/
```

Any static file server works. After editing any file under `assets/`, bump the `?v=N` query string on its `<script>` / `<link>` tag so browsers don't serve stale cached copies.
