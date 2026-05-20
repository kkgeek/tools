# Mobile Port Plan — Wealth Suite (iOS + Android)

> **Status:** Proposal · Not yet implemented  
> **Scope:** Full feature parity with the web suite, local-first data, native iOS + Android

---

## 1. Technology decision

### Options evaluated

| Approach | Pros | Cons |
|---|---|---|
| **React Native + Expo** | Reuse React 18 component logic from Tax/Roth/Tracker; JS ecosystem; OTA updates via Expo Go; single codebase | Vanilla JS tools need rewrite; bridge overhead for heavy D3 charts |
| **Flutter** | Best native fidelity; excellent chart libs (fl_chart); single codebase | Full rewrite — no JS reuse at all; Dart learning curve |
| **PWA (Progressive Web App)** | Zero rewrite — deploy existing HTML tools; no app store friction | No App Store distribution; limited iOS background/storage APIs; not truly "native" |
| **Native Swift + Kotlin** | Maximum performance; best platform idioms | Two full codebases; longest timeline |

### Recommendation: **React Native + Expo**

- The Tax Estimator, Roth Planner, and Portfolio Tracker are already React 18. Their calculation logic (pure JS functions) ports directly — only the JSX/Tailwind layer changes.
- Vanilla JS tools (Retirement, Portfolio Review, Golden φ, SS, Monte Carlo) need rewrite, but the math is self-contained and well-understood.
- Expo's managed workflow gives iOS + Android from one codebase, OTA JS updates (no App Store review for bug fixes), and a built-in SQLite module.
- Expo Go allows instant on-device testing without Xcode/Android Studio for UI iteration.

---

## 2. Repository structure

```
wealth-suite-mobile/
├── app/                        # Expo Router file-based navigation
│   ├── (tabs)/
│   │   ├── index.tsx           # Dashboard (Overview)
│   │   ├── income.tsx          # Income & Tax cluster
│   │   ├── retirement.tsx      # Retirement Planning cluster
│   │   └── portfolio.tsx       # Portfolio cluster
│   ├── tools/
│   │   ├── tax-estimator.tsx
│   │   ├── asset-calc.tsx
│   │   ├── retirement-plan.tsx
│   │   ├── roth-conversion.tsx
│   │   ├── social-security.tsx
│   │   ├── monte-carlo.tsx
│   │   ├── portfolio-tracker.tsx
│   │   ├── portfolio-review.tsx
│   │   └── golden-phi.tsx
│   └── settings.tsx            # Export / Import / Reset
├── src/
│   ├── store/                  # Zustand store (replaces suite-state.js)
│   │   ├── index.ts            # WealthStore definition + slices
│   │   ├── persist.ts          # SQLite persistence layer
│   │   └── schema.ts           # TypeScript types mirroring v1 schema
│   ├── calc/                   # Pure calculation modules (no UI)
│   │   ├── tax.ts              # Tax bracket logic
│   │   ├── retirement.ts       # Projection, RMD, SS
│   │   ├── monteCarlo.ts       # Box-Muller MC engine
│   │   ├── rothConversion.ts   # Conversion schedule optimizer
│   │   └── socialSecurity.ts   # Benefit curves, breakeven
│   ├── components/
│   │   ├── HouseholdBanner.tsx # Shared banner (replaces per-tool banners)
│   │   ├── SnapshotTile.tsx
│   │   ├── ClusterNav.tsx      # Bottom tab bar (uses Expo Router tabs)
│   │   ├── charts/
│   │   │   ├── LineChart.tsx   # Recharts-native wrapper
│   │   │   ├── DonutChart.tsx
│   │   │   └── BarChart.tsx
│   │   └── ui/                 # Design system primitives
│   └── theme/
│       ├── tokens.ts           # MD3 colour tokens, spacing scale
│       └── typography.ts       # Inter font config
├── assets/
│   └── fonts/
│       └── Inter-*.ttf
├── app.json                    # Expo config
├── eas.json                    # EAS Build config
└── package.json
```

---

## 3. State management — replacing `suite-state.js`

### 3a. Store: Zustand

```typescript
// src/store/index.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { sqliteStorage } from './persist'

const useWealthStore = create(
  persist(
    (set, get) => ({
      meta: { version: 1, lastUpdated: null, lastEditedBy: null },
      household: { filingStatus: 'mfj', spouses: [], location: { state: 'WA' } },
      income: { salary: {}, bonus: {}, rsuVests: {}, capitalGains: {} },
      retirement: { contributions: {}, balances: {}, plan: {} },
      portfolio: { totalValue: 0, allocations: {}, holdings: [] },
      deductions: { method: 'standard' },
      preferences: { taxYear: 2025 },

      update: (path, value) => set(state => deepSet(state, path, value)),
      reset: () => set(initialState),
      exportJSON: () => JSON.stringify(get()),
      importJSON: (json) => set(JSON.parse(json)),
    }),
    {
      name: 'wealth-suite-state',
      storage: createJSONStorage(() => sqliteStorage),
    }
  )
)
```

### 3b. Persistence: expo-sqlite

Replace `localStorage` with `expo-sqlite` (SQLite on device). The Zustand persist middleware accepts a custom storage adapter:

```typescript
// src/store/persist.ts
import * as SQLite from 'expo-sqlite'

const db = SQLite.openDatabaseSync('wealth.db')
db.execSync(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)`)

export const sqliteStorage = {
  getItem: (key) => {
    const row = db.getFirstSync('SELECT value FROM kv WHERE key = ?', [key])
    return row?.value ?? null
  },
  setItem: (key, value) => {
    db.runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, value])
  },
  removeItem: (key) => {
    db.runSync('DELETE FROM kv WHERE key = ?', [key])
  },
}
```

This is a drop-in replacement — no schema migration needed for v1. When `meta.version` increments, run the same `migrate()` logic used on web.

---

## 4. Tool-by-tool port map

### 4a. Tools with React 18 — logic reuse (high)

| Web tool | Mobile strategy |
|---|---|
| `TaxEstimatorV5.html` | Extract calc functions to `src/calc/tax.ts`. Rewrite JSX to React Native components. Tailwind → NativeWind or StyleSheet. |
| `TaxAssetCalcv4.html` | Same pattern. D3 charts → `victory-native` or `recharts-native`. |
| `roth_conversion.html` | Extract `src/calc/rothConversion.ts`. Pure function already; UI rewrite only. |
| `portfolio_tracker.html` | Extract fetch/parse logic. Yahoo Finance HTTPS calls work fine on mobile (same endpoint). Holdings table → FlatList. D3 → victory-native. |

### 4b. Tools in vanilla JS — full rewrite (medium effort)

| Web tool | Rewrite notes |
|---|---|
| `retirement_master_plan_2.html` | Extract `calcPortfolio()` + `runMC()` + `buildMCChart()` to `src/calc/retirement.ts`. Chart.js → victory-native LineChart. RMD tab logic → pure TS. |
| `portfolio_review.html` | Static analysis tables → FlatList + StyleSheet. Allocation bars → custom View widths (% of container). No external dependency needed. |
| `golden_ratio_portfolio_dashboard.html` | Mostly read-only display. Seeded from store. Rewrite as simple ScrollView with styled tiles. |
| `social_security.html` | Extract benefit curve math to `src/calc/socialSecurity.ts`. Chart.js → victory-native. |
| `monte_carlo.html` | Extract `runMC()` to `src/calc/monteCarlo.ts` (Box-Muller already pure JS). P10/P50/P90 lines → victory-native. |

---

## 5. Navigation — implementing the UX redesign on mobile

The mobile port ships with the redesigned IA from `docs/proposals/ux-redesign.md` from day one:

```
(tabs)/
├── index          → Overview (Dashboard)
├── income         → Income & Tax cluster landing
├── retirement     → Retirement Planning cluster landing
└── portfolio      → Portfolio cluster landing
```

Each cluster tab shows a cluster landing screen with tool cards. Tapping a card navigates to `app/tools/<tool>.tsx` (standard Expo Router stack push).

The bottom tab bar (4 tabs) is the primary nav — identical to the mobile redesign spec in the UX proposal. No hamburger, no horizontal scroller.

---

## 6. Charts

D3 and Chart.js don't run in React Native's JS environment (no DOM). Replace with:

| Web | Mobile |
|---|---|
| D3 line/area charts | `victory-native` `VictoryLine` + `VictoryArea` |
| Chart.js bar/donut | `victory-native` `VictoryBar` + `VictoryPie` |
| Inline SVG progress bars | React Native `View` with percentage width |

`victory-native` uses React Native SVG under the hood and produces charts visually consistent with the web D3 charts. No canvas, no DOM required.

---

## 7. Local data — backup and sync (optional, Phase 2)

The core app is local-only. Optional cloud backup (user opt-in only):

| Platform | Mechanism |
|---|---|
| iOS | `expo-file-system` + iCloud Drive via `NSURL` (write JSON to iCloud container) |
| Android | `expo-file-system` + Google Drive REST API (user-initiated, OAuth 2.0) |

No server, no account required. The JSON export from `store.exportJSON()` is the backup artifact — identical schema to the web app, so data round-trips between web and mobile without conversion.

---

## 8. Build and deployment

### 8a. Local development

```bash
npm install -g eas-cli
npx create-expo-app@latest wealth-suite-mobile
cd wealth-suite-mobile
npx expo start        # Expo Go on device — instant reload
```

### 8b. Production builds — EAS Build

```json
// eas.json
{
  "build": {
    "production": {
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    }
  }
}
```

```bash
eas build --platform ios      # Uploads to App Store Connect
eas build --platform android  # Produces signed APK/AAB for Play Store
```

### 8c. OTA updates

Business logic fixes (calc engines, store schema) ship as OTA JS updates via `expo-updates` — no App Store review required. UI changes that touch native modules require a full build.

### 8d. CI (GitHub Actions)

```yaml
# .github/workflows/mobile.yml
on:
  push:
    branches: [main]
    paths: ['wealth-suite-mobile/**']
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: expo/expo-github-action@v8
      - run: eas build --non-interactive --platform all
```

---

## 9. Phased migration roadmap

### Phase M1 — Store + Shell (1–2 weeks)

1. Scaffold Expo Router app with 4-tab bottom nav
2. Implement Zustand store + SQLite persistence
3. Build shared components: HouseholdBanner, SnapshotTile, ClusterNav
4. Dashboard screen: snapshot tiles, completion badges, Quick Entry form strip
5. Export/Import/Reset in Settings screen

Deliverable: working shell with persistent state, no tool screens yet.

### Phase M2 — React tools (2–3 weeks)

Port the four React 18 tools in order of complexity:
1. `TaxEstimatorV5` → `tax-estimator.tsx` (most complex; start here)
2. `TaxAssetCalcv4` → `asset-calc.tsx`
3. `roth_conversion` → `roth-conversion.tsx`
4. `portfolio_tracker` → `portfolio-tracker.tsx` (includes Yahoo Finance fetch + FlatList)

Deliverable: Income & Tax cluster + Roth fully functional.

### Phase M3 — Vanilla JS tools (3–4 weeks)

Port in order:
1. `retirement_master_plan_2` → `retirement-plan.tsx` (largest; Chart.js → victory-native)
2. `monte_carlo` → `monte-carlo.tsx` (extract runMC to TS first, then wire up)
3. `social_security` → `social-security.tsx`
4. `portfolio_review` → `portfolio-review.tsx`
5. `golden_ratio_portfolio_dashboard` → `golden-phi.tsx`

Deliverable: all 9 tools functional. Full feature parity with web suite.

### Phase M4 — Polish + App Store (1–2 weeks)

1. Accessibility audit (VoiceOver / TalkBack)
2. Haptic feedback on key actions (slider release, import success)
3. App icons + splash screen
4. App Store metadata, screenshots (6.7" + 12.9" iPad)
5. Google Play listing
6. TestFlight beta → production release

### Phase M5 — Optional cloud backup (post-launch)

1. iCloud Drive JSON backup (iOS)
2. Google Drive export (Android)
3. QR code handoff: scan QR on web → loads store JSON on mobile

---

## 10. Constraints and risks

| Risk | Mitigation |
|---|---|
| Yahoo Finance endpoint changes | Wrap in try/catch; fall back to cached price in store (same web constraint) |
| App Store review time | Submit to TestFlight early (Phase M3 end); production review runs in parallel with M4 polish |
| SQLite migration for schema v2 | Write `migrate()` in `persist.ts` identical to web `suite-state.js` pattern — same logic, same version key |
| Large number of holdings (FlatList perf) | `getItemLayout` + `keyExtractor` on FlatList; virtualisation handles 100+ holdings |
| Tailwind → NativeWind mismatch | Audit each tool's Tailwind classes during port; NativeWind 4 covers ~90% of used classes |

---

## 11. What stays the same as the web suite

- **Zero personal data leaves the device.** Client-side only; no backend, no analytics.
- **Same schema v1.** Store export from web imports cleanly on mobile and vice versa.
- **Same calculation engines.** `src/calc/*.ts` files are the single source of truth — web tools can import them too once the web app adopts a build step.
- **MFJ + Single only.** No Married Filing Separately.
- **WA only** for state tax. Federal logic is general.
