# Getting Started with Wealth Suite

A one-stop personal finance hub that runs **entirely in your browser**. No accounts, no tracking, no upload — your data lives in your browser's local storage and only goes anywhere if you choose to export it.

The suite bundles eleven specialised tools behind a unified dashboard. Once you enter your numbers in one tool, every other tool sees the same household automatically.

**Live site:** <https://kkgeek.github.io/tools/>

---

## What's in the suite

| Module | What it's for |
|---|---|
| **Dashboard** | Central command centre: household snapshot, Quick Entry panel, named scenarios, Export/Import/Reset |
| **Tax Estimator** | Federal + WA state tax for 2024–2041. AMT, LTCG, NIIT, RSU supplemental gap, quarterly payments. Primary data-entry point for the household. |
| **Asset & Cap-Gains Calc** | Capital-gains scenarios with 2024–2026 bracket data and D3 visualisations. What-if mode — pull household numbers in with one click. |
| **Retirement Master Plan** | Long-horizon projections, RMD calculator with bracket visualisation, 3-year buffer sizing, Roth + Social Security strategy. |
| **Portfolio Review** | Concentration risk and target allocation on a 140-position portfolio. Populates the dashboard's portfolio tile. |
| **Golden φ Portfolio** | Phi-derived allocation (1 : 0.618 : 0.382) with 15-year projection and sequence-of-returns stress test. |
| **Roth Conversion Planner** | Year-by-year conversion schedule filling your chosen bracket ceiling; Roth vs. traditional balance comparison. |
| **Portfolio Tracker** | Brokerage CSV import, live Yahoo Finance prices, D3 allocation donut and 15-year projection. |
| **Social Security Estimator** | Claiming-age slider 62–70, break-even vs. maximum-credit analysis, cumulative lifetime benefit chart. |
| **Net Worth Tracker** | Assets from the store plus manual entries; liabilities table; net worth = assets − liabilities. |
| **Monte Carlo Projections** | 1,000 market simulations, p10/p25/p50/p75/p90 fan chart, probability of success, hover tooltip with per-percentile values. |

---

## First run — what you see

Open the site and you land on the dashboard.

![Dashboard — first run, empty state](screenshots/00-dashboard-empty.png)

The **Snapshot** card says "No household data yet." Below it are the **Scenarios** chips, the collapsible **Quick Entry** panel, and the **Modules** grid.

The header chips on the right (`Export JSON`, `Export CSV`, `Print Snapshot`, `Import JSON`, `Reset`) are how you move data in and out — see [Backups & sharing](#backups--sharing) below.

---

## A 5-minute walkthrough

### Option A — Quick Entry on the dashboard

The fastest path: fill in the **Quick Entry** panel directly on the dashboard without opening any tool.

![Dashboard with Quick Entry panel open](screenshots/00-dashboard.png)

The panel has four inline sections:
- **Household** — filing status, spouse names, ages
- **Income** — salary, bonus, RSU vests for each spouse
- **Retirement** — target retire age, annual expenses, growth assumption, retirement balance
- **Portfolio** — total portfolio value

Every field writes to the suite store on blur. The Snapshot tiles update immediately.

---

### Option B — Enter your household in the Tax Estimator

Click the **Tax** link in the topbar. The Tax Estimator is the suite's primary data-entry tool and has the most detailed inputs.

![Tax Estimator with household data](screenshots/02-tax-estimator.png)

What to fill in:
- **Tax Year** — defaults to 2026, projected from 2025 IRS data (2.5% COLA). 2024 and 2025 are confirmed; 2027+ are editable in the *IRS Data Admin* tab.
- **Filing Status** — Single or Married Filing Jointly. (MFS is not modelled.)
- **Spouse 1 / Spouse 2** — age, salary, bonus, RSU vests, 401(k) contributions (Traditional / Roth / After-tax / Catch-up), IRA, HSA. Use the **Max** chips to fill the legal cap for the year.
- **Capital Gains** — short-term and long-term, household total.
- **Deductions** — standard or itemised (mortgage interest, SALT, charitable).

Every keystroke is auto-saved to `localStorage`. The **Calculate Tax** button shows your total liability with bracket breakdown, AMT / NIIT detection, and quarterly-payment suggestions. As you type, the adapter mirrors your household into the suite store — the dashboard Snapshot updates within a second.

---

### 2. Check the dashboard

Click **Dashboard** in the topbar. The five Snapshot tiles now reflect what you entered:

![Dashboard with populated snapshot tiles](screenshots/01-dashboard.png)

- **Household** — names, filing status, state
- **Projected income** — salary + bonus + RSU + capital gains (both spouses)
- **Retirement contributions** — 401(k) + IRA + HSA this year
- **Retirement balance** — set later in the Retirement Planner
- **Portfolio value** — set later via Portfolio Review or Portfolio Tracker

The "Last updated by …" line tells you which tool most recently touched the store.

---

### 3. Open Retirement Master Plan

Click **Retirement** in the topbar.

![Retirement Master Plan with household banner](screenshots/03-retirement.png)

A small all-caps banner under the page title confirms the household context. Browse the tabs:

- **Overview** — readiness scorecard, 8-tile diagnostic
- **3-yr buffer** — sequence-of-returns risk sizing
- **Projection** — bull / base / stress portfolio paths; starting balance seeded from `portfolio.totalValue + retirement.balances.total`
- **Roth + SS** — claim-age strategy + cumulative SS benefit
- **Tax strategy / Estate plan / Timeline** — narrative planning reports
- **RMD calculator** — drag the slider to model your traditional-IRA balance at age 73. The dashboard's "Retirement balance" tile mirrors the slider in real time.

---

### 4. Open Portfolio Review

Click **Portfolio** in the topbar.

![Portfolio Review](screenshots/04-portfolio.png)

Visiting this page parses the portfolio total from the page header and writes it to `portfolio.totalValue` in the suite store, which populates the dashboard's Portfolio tile and feeds the Asset Calculator's Apply button.

---

### 5. Open the Asset & Cap-Gains Calculator

Click **Assets** in the topbar.

![Asset Calculator with Apply banner](screenshots/05-asset-calc.png)

Two tabs — **Tax Calculator** and **Asset Allocation** — each with an "Apply" banner showing the suite's household data. Click **Apply** to pre-fill the form from your household, then tweak any field for what-if scenarios.

---

### 6. Golden φ Portfolio

Click **Golden φ** in the topbar.

![Golden φ Portfolio Dashboard](screenshots/06-golden-phi.png)

The dashboard seeds the investment amount from `portfolio.totalValue` and the withdrawal rate from `annualExpenses / totalValue` automatically. The projection and stress-test charts update to reflect your real numbers.

---

### 7. Roth Conversion Planner

Click **Roth** in the topbar.

![Roth Conversion Planner](screenshots/07-roth-conversion.png)

Choose a bracket ceiling (e.g. "22% — balanced"), set your traditional and Roth balances, and click **Calculate Conversion Schedule**. The planner fills to that bracket each year from now until your retire age and shows:
- Year-by-year: age, amount converted, bracket used, tax owed
- Side-by-side: Roth balance after conversions vs. traditional balance with RMDs

---

### 8. Portfolio Tracker

Click **Tracker** in the topbar.

![Portfolio Tracker](screenshots/08-portfolio-tracker.png)

Import a CSV from Fidelity, Schwab, Vanguard, or a generic 3-column format. Prices refresh from Yahoo Finance (cached 15 min). The tracker writes `portfolio.totalValue` and allocation percentages back to the suite store so other tools see live holdings data.

---

### 9. Social Security Estimator

Click **SS** in the topbar.

![Social Security Estimator](screenshots/09-social-security.png)

Drag the claiming-age slider from 62 to 70. The KPI tiles update live:
- Monthly / annual benefit at the selected age
- % vs. your PIA at FRA
- Break-even age vs. claiming at 70
- Cumulative lifetime total to your chart-end age
- Combined household total (if spouse fields are filled)

The cumulative benefit chart shows lines for 62, 64, FRA, 70, and your selected age so you can see the crossover (break-even) visually.

---

### 10. Net Worth Tracker

Click **Net Worth** in the topbar.

![Net Worth Tracker](screenshots/10-net-worth.png)

- **Assets (left)** — portfolio value and retirement balances are pulled from the store automatically. Add home value, other real estate, and other assets manually.
- **Liabilities (right)** — add any number of debts with name, type, balance, rate, and monthly payment.
- The summary card at the bottom shows Total Assets − Total Liabilities = **Net Worth**.

---

### 11. Monte Carlo Retirement Projections

Click **Monte Carlo** in the topbar.

![Monte Carlo Retirement Projections](screenshots/11-monte-carlo.png)

Starting balance, withdrawal, current age, and retire age are seeded from the suite store. Click any input to adjust, then the simulation reruns (180 ms debounce, 1,000 paths).

The **fan chart** shows five percentile bands at every age from now to your end age. Hover anywhere on the chart to snap a crosshair to that age and see the p10 / p25 / p50 / p75 / p90 portfolio values in a floating tooltip.

The **KPI tiles** summarise the distribution:
- **Probability of success** — % of paths where money lasts to end age
- **Median final balance** — p50 portfolio at end age
- **Worst 10% balance** — p10 portfolio at end age (how bad the bad scenarios end)
- **p10 Survival age** — if p10 hits $0 before end age, this is when

---

## Named Scenarios

The **Scenarios** row on the dashboard lets you model different retirement ages in one click.

Default chips: **Retire at 55**, **Retire at 60**, **Retire at 65**. Clicking a chip writes `retirement.plan.targetRetireAge` to the store, updating years-to-retire across the Retirement Planner, Monte Carlo, and Golden φ tools automatically.

---

## Backups & sharing

Five buttons next to the **Snapshot** title on the dashboard:

| Button | What it does |
|---|---|
| **Export JSON** | Downloads `wealth-suite-export-YYYY-MM-DD.json` — full state backup. Use to move between machines, share a scenario, or back up before Reset. |
| **Export CSV ▾** | Dropdown: Income CSV / Retirement CSV / Portfolio CSV. Spreadsheet-ready slices of your data. |
| **Print Snapshot** | Opens a print-optimised single-page household summary in a new tab. |
| **Import JSON** | Pick a file you previously exported. Confirm dialog before overwriting. |
| **Reset** | Wipes the snapshot and Tax Estimator saved inputs. Export first if you need to come back. Theme preference and IRS rates cache are kept. |

**Cross-tab edit detection:** if you have the Tax Estimator open in one tab and import a snapshot in another, the Tax Estimator shows a yellow "data updated — Reload" banner. Click Reload to re-seed the form.

---

## Theme

The icon on the far right of the topbar cycles **system → light → dark**. Your preference is remembered across all tools and sessions.

---

## Tips & gotchas

- **Tax Estimator is the most thorough data-entry tool.** Other tools can seed via Quick Entry, but Tax Estimator handles RSU supplemental withholding, itemised deductions, and AMT that the Quick Entry panel doesn't expose.
- **Portfolio Tracker is the live portfolio source.** Once you import a CSV there, `portfolio.totalValue` reflects real holdings. Portfolio Review and Quick Entry manual entry become secondary.
- **Asset Calculator clamps to 2024–2026 brackets.** If your store has `preferences.taxYear = 2030`, the Asset Calc uses 2026 data (its latest). The Tax Estimator itself supports 2024–2041.
- **Net Worth schema is v2.** Snapshots exported before the Net Worth Tracker was added are automatically migrated on import.
- **Monte Carlo results are not financial advice.** Normal-distribution returns don't capture fat tails, correlation breaks in crises, or sequence-of-returns risk beyond what the volatility parameter models.
- **MFJ-only.** Married Filing Separately is not supported. WA-only for state tax.
- **Privacy.** Nothing leaves your browser unless you click Export. The IRS-rates auto-sync only fetches a public JSON file from GitHub — no PII is ever sent.

---

## Troubleshooting

- **Tile shows `—` even though I entered data.** That field is genuinely empty in the suite store. Check that the tool you used has an adapter (see README) and that you actually saved / blurred out of the field.
- **The "Updated in [tool]" banner won't go away.** Click Reload in the banner — it re-seeds the active tool from the latest store contents.
- **Portfolio Tracker shows "stale" badge on prices.** Yahoo Finance fetch failed; the last known price is being used. Check your network connection or try refreshing the page after 15 minutes (cache TTL).
- **Data feels stale after Reset.** Reset only clears the snapshot and `taxSuiteInputs_v2`. IRS rates cache and theme are preserved by design. For a full clean slate, clear the entire site's `localStorage` in your browser's DevTools.
- **Imported file rejected.** It must be a `wealth-suite-export-v1` or `v2` envelope or a raw state object with a `meta.version` field. Free-form JSON is not accepted.
- **A page won't render.** The tools depend on CDN scripts (React, Tailwind, Chart.js, D3). If your network blocks `unpkg.com`, `cdnjs.cloudflare.com`, or `cdn.tailwindcss.com` (corporate firewall, ad-blocker), open DevTools → Network to see which fetch failed.

---

## Running locally

```bash
# from the repo root
python3 -m http.server 3001 --bind 127.0.0.1
# open http://127.0.0.1:3001/
```

Any static file server works. No build step. After editing any file under `assets/`, bump the `?v=N` query string on its `<script>` / `<link>` tag in every HTML page that references it so browsers don't serve a stale cached copy.
