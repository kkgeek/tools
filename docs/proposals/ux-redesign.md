# UX/UI Redesign Proposal — Wealth Suite

> **Status:** Proposal · Not yet implemented  
> **Scope:** Navigation simplification, information architecture, progressive disclosure, mobile-first layout

---

## 1. Problem statement

The current suite has 11 tools linked via a flat horizontal topnav. As a power user you learn it quickly, but the experience has several friction points:

| Pain point | Current state |
|---|---|
| **Navigation overload** | 11 equal-weight links in one scrolling topnav bar — no hierarchy, no grouping |
| **No onboarding path** | A new user sees an empty dashboard with no clear "start here" signal |
| **Tool names are opaque** | "Assets", "Golden φ", "SS", "Monte Carlo" require prior knowledge |
| **Quick Entry is hidden** | Collapsed by default; many users never discover it |
| **No breadcrumb or context** | Inside any tool you can't tell where you are relative to your financial picture |
| **Scenarios feel tacked on** | Three retire-age chips sit below the snapshot with no label explaining what they do |
| **Mobile nav is unusable** | 11 links in a horizontal scroller — no bottom tab bar, no hamburger |
| **No progress indication** | No signal showing which tools have data and which are empty |

---

## 2. Proposed information architecture

Reorganise 11 tools into 4 clusters. Navigation exposes clusters, not individual tools.

```
Wealth Suite
├── 📊 Overview (Dashboard — default)
├── 💰 Income & Tax
│   ├── Tax Estimator
│   └── Asset & Cap-Gains Calc
├── 🎯 Retirement Planning
│   ├── Retirement Master Plan
│   ├── Roth Conversion Planner
│   ├── Social Security Estimator
│   └── Monte Carlo Projections
└── 📈 Portfolio
    ├── Portfolio Tracker  (live holdings)
    ├── Portfolio Review   (concentration analysis)
    ├── Golden φ Portfolio (allocation model)
    └── Net Worth Tracker
```

**Why this grouping:** Users think in financial workflows, not tool names. "I want to model my retirement" is one workflow that spans Retirement + Roth + SS + Monte Carlo. Clustering makes the jump between related tools obvious.

---

## 3. Navigation redesign

### 3a. Desktop — collapsed cluster nav

Replace the flat 11-link topnav with a **4-tab cluster nav** + **tool sub-nav** inside each cluster.

```
┌─────────────────────────────────────────────────────────────┐
│  W Wealth Suite   [ Overview │ Income & Tax │ Retirement │ Portfolio ]   ☀
└─────────────────────────────────────────────────────────────┘
                              ↓ (when "Retirement" is active)
┌─────────────────────────────────────────────────────────────┐
│  Master Plan  │  Roth  │  Social Security  │  Monte Carlo   │
└─────────────────────────────────────────────────────────────┘
```

- Primary nav: 4 cluster tabs (always visible)
- Secondary nav: tool pills inside the active cluster (appears below primary, collapses when cluster changes)
- Active tool is underlined in secondary nav
- Cluster tab shows a green dot when that cluster has data in the store

### 3b. Mobile — bottom tab bar

```
┌──────────────────────────────────┐
│  (tool content area)             │
│                                  │
│                                  │
├──────────────────────────────────┤
│  🏠      💰      🎯      📈      │
│Overview  Tax   Retire Portfolio  │
└──────────────────────────────────┘
```

- Fixed bottom tab bar with 4 cluster icons + labels
- Tapping a cluster opens a **bottom sheet** listing that cluster's tools
- Bottom sheet swipes down to dismiss
- Active tool shown in a slim breadcrumb strip below the topbar

---

## 4. Dashboard redesign

### 4a. Remove hero section
The "Your personal finance command center" hero is wasted space on every visit after the first. Replace with a **persistent status bar** that shows:

```
┌─────────────────────────────────────────────────────────┐
│  Last updated: Tax Estimator · 2 hours ago    [Reload]  │
└─────────────────────────────────────────────────────────┘
```

### 4b. Snapshot tiles — make them actionable

Current tiles are read-only. Add a subtle edit pencil on each tile that deep-links to the right tool and field:

| Tile | Pencil links to |
|---|---|
| Household | Tax Estimator → Filing Status |
| Projected Income | Tax Estimator → Spouse 1 income |
| Retirement Contributions | Tax Estimator → 401k tab |
| Retirement Balance | Retirement Master Plan → RMD slider |
| Portfolio Value | Portfolio Tracker → import |

### 4c. Completion indicators

Each module card in the grid shows a state badge:

- ⬜ **Empty** — no data yet, shows "Start here" prompt
- 🟡 **Partial** — some fields populated
- 🟢 **Complete** — key fields filled, last updated date

Implementation: each adapter writes a `meta.completion.<tool>` field to the store on every sync.

### 4d. Quick Entry — always visible, not collapsible

Promote Quick Entry from a collapsed panel to an always-visible **inline form strip** in a sidebar (desktop) or full-width card (mobile). The current collapse/expand interaction has low discoverability.

### 4e. Scenarios — rename and explain

Change "Scenarios" label to **"Retirement Age"** and add a one-line tooltip: *"Tap to model a different retirement age across all tools."*

---

## 5. Per-tool UX improvements

### 5a. Household banner — standardise

Every tool currently has a different (or missing) household banner. Extract to a shared `renderHouseholdBanner(container, store)` function in `suite.js` that all adapters call. Banner should show:

```
┌──────────────────────────────────────────────────────┐
│  Alex & Jordan · MFJ · WA  │  Ages 45 & 43  │  ✏   │
│  Portfolio $1.25M · Retire at 62 · $90k/yr           │
└──────────────────────────────────────────────────────┘
```

The ✏ opens Quick Entry inline.

### 5b. Tab navigation inside tools

Several tools (Retirement Master Plan, Portfolio Review) use plain `<button>` tabs. Replace with a consistent `role="tablist"` pattern and keyboard navigation (arrow keys). Add `aria-selected` states.

### 5c. Chart empty states

When a tool has no store data and renders with defaults, show a subtle "Using demo data" banner so users know the chart isn't showing their numbers yet.

### 5d. Export / Import — move to a Settings page

The 5-button action row (Export JSON, Export CSV ▾, Print, Import, Reset) is crowded on mobile. Move it to a **⚙ Settings** page (new route) accessible from the topbar icon. Keep a single **"Export"** chip on the dashboard as a shortcut.

---

## 6. Typography and visual system

| Element | Current | Proposed |
|---|---|---|
| Body font | Roboto Flex (index) / DM Sans (tools) / system-ui (retirement) | Unify on **Inter** via CDN — good tabular figures, wide weight range |
| Monospace | JetBrains Mono (some tools) | Keep — good for numbers |
| Base size | 14px | **15px** — easier reading at financial data density |
| Border radius | Inconsistent (8px, 10px, 12px across tools) | Unify on **10px** for cards, **6px** for chips |
| Spacing scale | Ad-hoc px values | Define 4-point scale: 4/8/12/16/20/24/32px in CSS vars |

---

## 7. Colour and status semantics

Add semantic colour vars that all tools consume:

```css
--status-positive: var(--green);   /* on-track, surplus, gain */
--status-warning:  var(--amber);   /* approaching limit, partial */
--status-critical: var(--red);     /* over limit, loss, urgent action */
--status-neutral:  var(--muted);   /* informational */
--status-info:     var(--blue);    /* planning, projected */
```

Currently each tool uses raw colour vars directly, leading to inconsistent semantics (one tool uses `--amber` for "caution", another for "projected").

---

## 8. Prioritised implementation roadmap

### Phase A — Quick wins (1–2 days each)
1. Standardise household banner via shared renderer in `suite.js`
2. Add completion badges to dashboard module grid
3. Rename "Scenarios" → "Retirement Age" + add tooltip
4. Unify border-radius and spacing CSS vars
5. Promote Quick Entry to always-visible (remove the toggle)

### Phase B — Navigation overhaul (3–5 days)
1. Implement 4-cluster primary nav (desktop)
2. Implement bottom tab bar (mobile, CSS only)
3. Add cluster-level bottom sheet for tool selection (mobile)
4. Add per-cluster data indicator dots

### Phase C — Dashboard depth (3–5 days)
1. Make snapshot tiles actionable (deep links)
2. Move Export/Import/Reset to Settings page
3. Add "Using demo data" banners to charts
4. Standardise tab accessibility (tablist/role/aria-selected) across all tools

### Phase D — Visual system (2–3 days)
1. Migrate to Inter font across all pages
2. Define and apply 4-point spacing scale
3. Apply semantic colour vars across all tools
4. Increase base font size to 15px

---

## 9. What NOT to change

- **Zero build step** — all CSS/JS improvements stay CDN + inline. No Tailwind compilation, no Vite.
- **Tool internals** — each tool's core calculation logic stays untouched. UX changes go through adapters and shared CSS only.
- **Data schema** — completion metadata adds new optional fields; no migration needed.
- **Self-contained tools** — each tool must still work without `suite.js` loaded.
