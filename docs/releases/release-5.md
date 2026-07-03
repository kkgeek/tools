# Release 5 — Design-handoff: app shell, Data Hub, Settings, live dashboard

*Shipped June–July 2026 (commits `c0ab0fa` … `b93fc67`). Implementation detail lives in CLAUDE.md Phases 13a–13m.*

This release implements the design handoff (`design/Wealth-Suite/design_handoff_wealth_suite/README.md`): one green/Roboto design system, a sidebar app shell with single-window navigation, a Data Hub as the single source of truth, a Settings page, and a dashboard whose every panel renders live data from the store.

## Theme (13a, 13k)
- `assets/theme.css` — shared token layer (handoff palette: green `#2E7D32` primary, Roboto/Roboto Mono, light + dark). Remaps the legacy `--md-sys-color-*` names so the shell and all vanilla tools repainted with no per-tool edits.
- `assets/tw-reskin.css` — re-points the 5 React tools' hardcoded Tailwind color utilities (blue/indigo → primary, emerald → positive, red → negative, amber → warning) at the tokens, so their internals match too and follow dark mode + accent automatically.
- Accent picker (green/blue/purple/teal) applies suite-wide via inline `--primary*` overrides (`localStorage['wealthSuite.accent']`).

## App shell + navigation (13b, 13c, 13f, 13l)
- `index.html` rebuilt as the handoff's sidebar shell: 240px collapsible sidebar (72px rail on desktop, off-canvas drawer ≤860px), 60px top bar (hamburger, title/date, theme cycle, household chip).
- **Single-window navigation**: hash router (`#tool.html`, sub-hash `#file.html#tab` supported) loads tools into an iframe — the sidebar never reloads. `suite.js` is embed-aware (skips its own topnav inside the shell). Cmd/Ctrl-click or "New tab ↗" still opens tools standalone.

## Data Hub (13d, 13g) — `data_hub.html`
Single source of truth (store schema v5: `accounts[]`, `otherAssets[]`):
- CSV holdings import: auto-map (Fidelity/Schwab/Vanguard/generic) → preview with New/Update/Check-acct status → commit; auto-registers accounts named in the CSV.
- Accounts registry, Other Assets, Liabilities (add/delete, persisted); Export Backup (full store JSON).
- Data-health strip, expense-import staleness, "Who Reads What" sync table.
- Data contract hardened: `holding.costBasis` is **per-share** ("…Total" CSV headers auto-divide), holdings carry `id`s, liabilities carry `type`.

## Settings (13e) — `settings.html`
Household profile (per-spouse birth year / target retire age), Scenarios (moved off the sidebar), Tax Profile (filing status, federal bracket, WA cap-gains excise), Appearance (theme / accent / currency / sidebar default), Alerts, Data Controls (export + two-step reset).

## Live dashboard (13f–13j) — every panel live-or-gated-sample
- KPI tiles: Total Net Worth, Investment Portfolio, Retirement Readiness, Monthly Spending.
- Net Worth Growth chart from daily snapshots (`localStorage['wealthSuite.nwHistory']`; accrues from daily visits; 1Y/3Y/5Y/All ranges).
- Asset Allocation donut from holdings by asset class.
- Retirement Readiness + Planning card: inline seeded 1,000-path Monte Carlo (success %, median at 85, retire year, real p10/p50/p90 fan chart).
- Spending vs Budget: per-category bars vs budgets, refunds netted.
- Performance table: real annualized returns from monthly adj-close history via the Cloudflare quote worker (actual-span annualization; benchmarks ^GSPC/VTI/VXUS; "—" where history doesn't reach).
- Empty store keeps the mockup's illustrative sample everywhere ("sample figures" ↔ "live from your data").

## New tool: Estate Plan (13m) — `estate_plan.html`
Extracted from the Retirement Master Plan's former Estate tab into its own standalone page (OBBBA federal exemption, WA estate tax SB 6347, millionaire tax, trust strategy, beneficiary audit). Sidebar entry + Retirement cluster sub-nav.

## Fixes (13l)
- **Asset & Cap-Gains was blank**: it loaded unpinned `@babel/standalone` (unpkg now serves Babel 8, which rejects raw `>` in JSX text). Pinned to 7.29.7 + escaped the text. *Gotcha: every React page must pin `@babel/standalone@7.29.7`.*
- Mobile: sidebar became an off-canvas drawer (previously covered the hamburger, untappable on phones).

## Removed from the home page
The old MD3 dashboard widgets (snapshot tiles, quick entry, scenario chips, AI chat, briefing). Data entry lives in the Data Hub; scenarios in Settings; the AI chat code remains in `assets/ai/` awaiting a new home.
