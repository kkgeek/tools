# Wealth Suite — Backlog

*Updated 2026-07-08, after Phase 13n (Settings preferences consumed — see CLAUDE.md Phase 13 log). This file is the resume point: pick the top unchecked item unless directed otherwise.*

## Up next (roughly by value)

1. **Site Map page** — sidebar "Review → Site Map" is a non-navigating "Soon" chip; build per `Site Map.dc.html` in the design handoff bundle.

2. **AI chat re-homing** — `assets/ai/chat.js` + `briefing.js` still exist but nothing loads them since the shell rebuild. Decide: chat panel inside the shell? Delete briefing?

3. **Retirement Master Plan hardcoded numbers** — the tool's banner/projections use hardcoded figures ($1.35M, age 45, $90k spend); its adapter seeds some, but a fuller store-driven pass is pending (handoff step 4 for tools).

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
- Phase 13p: Estate Plan live figures — `estate_plan.html` computes
  estate size (dashboard net-worth formula), WA taxable excess + est.
  tax (graduated 10–20% table over the $3M exclusion), federal tax vs
  $30M MFJ / $15M single, repositions the "← you" tier row, live ILIT
  ages. Gated: empty store keeps the illustrative sample.
- Phase 13o: Data Hub polish — column-mapping editor in the import preview
  (Edit mapping: per-field column selects + lot-total checkbox, re-parses
  live), in-hub Refresh Prices (same worker→query2→query1 chain and
  `yf_<TICKER>` sessionStorage cache as the tracker; updates
  currentPrice/priceUpdatedAt + totalValue), in-hub expense CSV import
  (drop zone replaces the link-out; mirrors expenses.html's parser,
  Chase/Amex/Citi/generic + dedupe + importHistory). Also fixed the hub
  reading `importHistory` fields that don't exist (`at`/`name` → the
  tracker writes `importedAt`/`fileName`) — expense staleness never
  registered before.
- Phase 13n: Settings prefs consumed — active scenario (name in profile chip + household banners, retire-age/withdrawal overrides in Roth/MC adapters), fedBracket → Roth target bracket, currencyFormat (dashboard + banners), alert prefs (Q2 banner toggle, stale-data note). Also fixed the dashboard's broken store.subscribe (never re-rendered live before). Asset Calc has no bracket input — nothing to default there.
- Release 5: theme → shell → single-window nav → Data Hub (schema v5) → Settings → fully live dashboard → Tailwind reskin → Babel-pin fix → Estate Plan standalone. All PRs #12–#26 merged; linear history on `main`.
