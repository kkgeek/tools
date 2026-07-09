# Wealth Suite — Backlog

*Updated 2026-07-08, after Phase 13n (Settings preferences consumed — see CLAUDE.md Phase 13 log). This file is the resume point: pick the top unchecked item unless directed otherwise.*

## Up next (roughly by value)

1. **Data Hub polish**
   - column-mapping editor UI ("Edit mapping" in the import preview — currently auto-map only)
   - in-hub "Refresh Prices" (currently a stub pointing at the Portfolio Tracker; reuse its quote-worker fetch)
   - in-hub expense CSV parsing (currently links out to the Expense Tracker)

2. **Estate Plan live figures** — `estate_plan.html` is static analysis text; compute estate size / WA taxable excess / est. tax from Net Worth data in the store.

3. **Site Map page** — sidebar "Review → Site Map" is a non-navigating "Soon" chip; build per `Site Map.dc.html` in the design handoff bundle.

4. **AI chat re-homing** — `assets/ai/chat.js` + `briefing.js` still exist but nothing loads them since the shell rebuild. Decide: chat panel inside the shell? Delete briefing?

5. **Retirement Master Plan hardcoded numbers** — the tool's banner/projections use hardcoded figures ($1.35M, age 45, $90k spend); its adapter seeds some, but a fuller store-driven pass is pending (handoff step 4 for tools).

## Known issues / watchlist
- **TaxAssetCalcv4 renders blank in *headless* Chrome** (Babel+D3 vs virtual-time). Fine in real browsers since the 7.29.7 pin. Don't chase it in headless tests.
- **Babel pin**: every React page must use `@babel/standalone@7.29.7` (Babel 8 rejects raw `>` in JSX text → blank page).
- `holding.costBasis` is **per-share** everywhere. Never write lot totals.
- Net-worth history accrues one snapshot/day (`localStorage['wealthSuite.nwHistory']`) — the Growth chart needs ≥2 days of visits to draw.
- Tracker doesn't live-subscribe to store changes while open (iframe remount covers the shell case).

## Deferred indefinitely
- Vite migration (only if scope demands it)
- Cloudflare Pages + Access privacy migration (see memory: quote-infra-and-privacy-plan)

## Done recently (context for resuming)
- Phase 13n: Settings prefs consumed — active scenario (name in profile chip + household banners, retire-age/withdrawal overrides in Roth/MC adapters), fedBracket → Roth target bracket, currencyFormat (dashboard + banners), alert prefs (Q2 banner toggle, stale-data note). Also fixed the dashboard's broken store.subscribe (never re-rendered live before). Asset Calc has no bracket input — nothing to default there.
- Release 5: theme → shell → single-window nav → Data Hub (schema v5) → Settings → fully live dashboard → Tailwind reskin → Babel-pin fix → Estate Plan standalone. All PRs #12–#26 merged; linear history on `main`.
