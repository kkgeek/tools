# Wealth Suite — Backlog

*Updated 2026-07-09, after Phase 13r (purchase dates + since-purchase Performance table — see CLAUDE.md Phase 13 log). This file is the resume point: pick the top unchecked item unless directed otherwise.*

## Up next (roughly by value)

1. **AI chat re-homing** — `assets/ai/chat.js` + `briefing.js` still exist but nothing loads them since the shell rebuild. Decide: chat panel inside the shell? Delete briefing? (Needs a user product decision.)

2. **Data Hub health strip: flag orphaned `portfolio.totalValue`** — when
   the scalar is set but `portfolio.holdings` is empty, show a stale-data
   warning in the hub's health strip with a one-tap "recompute from
   holdings" fix (writes `total || null`, same as the hub's existing
   `recompute()`). Context: legacy pre-hub paths (old dashboard
   quick-entry) wrote the scalar without holdings, and the tracker only
   writes `totalValue` when > 0 — deleting all holdings orphans the last
   value (seen live on the user's phone, 2026-07-10: "$4.75M · 0
   holdings"). Optional companion fix: make the tracker always write
   `totalValue` (null when holdings empty).

## Known issues / watchlist
- **TaxAssetCalcv4 renders blank in *headless* Chrome** (Babel+D3 vs virtual-time). Fine in real browsers since the 7.29.7 pin. Don't chase it in headless tests.
- **Babel pin**: every React page must use `@babel/standalone@7.29.7` (Babel 8 rejects raw `>` in JSX text → blank page).
- `holding.costBasis` is **per-share** everywhere. Never write lot totals.
- `holding.purchaseDate` is ISO `YYYY-MM-DD` or null. Null = "held forever"
  in the dashboard Performance table (full-period return).
- `accounts[].taxTreatment` is `'Taxable' | 'Tax Free' | 'Tax Deferred'`;
  holdings link to the registry via `holding.account` (name string).
  Consumers fall back to `type`, then a name-based guess.
- Net-worth history accrues one snapshot/day (`localStorage['wealthSuite.nwHistory']`) — the Growth chart needs ≥2 days of visits to draw.
- Tracker doesn't live-subscribe to store changes while open (iframe remount covers the shell case).

## Deferred indefinitely
- Site Map page (sidebar "Review → Site Map" stays a "Soon" chip; spec: `Site Map.dc.html` in the design handoff bundle) — deferred by user 2026-07-08
- Vite migration (only if scope demands it)
- Cloudflare Pages + Access privacy migration (see memory: quote-infra-and-privacy-plan)

## Done recently (context for resuming)
- Phase 13r: purchase dates + since-purchase Performance table —
  `holding.purchaseDate` captured in the Data Hub (CSV auto-map +
  mapping editor + preview column) and Portfolio Tracker (CSV, add
  form, editable table column); dashboard "Your Portfolio" row is now a
  monthly chain-linked return where each lot enters at its purchase
  date, benchmarks clipped to the same window per column; no dates =
  old full-period behavior.
- Phase 13q: Retirement Master Plan live figures — adapter v7 seeds the
  remaining hardcoded copy from the store (subtitle/title, 25×-spend
  target stat + tile, buffer tiers + inflation schedule + SS note,
  savings roadmap from store contributions), patches `runMC` + re-labels
  the MC/projection x-axes, includes contribution FV in portAtRetire,
  fixes two stale `findScTile` labels that silently no-oped, and aligns
  the SS base with the current tool ($69.6k at-retirement dollars).
  Empty store keeps the sample.
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
