/* =============================================================
 * Wealth Suite — shared shell runtime
 *
 * Responsibilities:
 *  1. Resolve theme (system | light | dark), persist user choice,
 *     apply via [data-theme] on <html>.
 *  2. On tool pages (where the dashboard hasn't already rendered a
 *     topbar), inject the suite topbar at <body> start so navigation
 *     and theme controls are consistent everywhere.
 *
 * No framework dependency. Safe to include in pages already running
 * React, D3, or vanilla — only touches <html data-theme> and the
 * injected <header class="suite-topbar"> node.
 * ============================================================= */
(function () {
  'use strict';

  const STORAGE_KEY = 'wealthSuite.themePreference';
  const VALID = ['system', 'light', 'dark'];
  const mql = window.matchMedia('(prefers-color-scheme: dark)');

  // Cluster registry — Phase 8 IA: tracking vs. tools split.
  // Each cluster is a primary nav tab; tools render as secondary pills
  // when their cluster is active. `match` is substring(s) on
  // location.pathname used to detect the active tool.
  //
  //  Home       → just the dashboard, no sub-nav
  //  Tracking   → live data you maintain
  //  Retirement → planning + projections
  //  Tax        → annual tax estimation
  //  Tools      → situational calculators
  const CLUSTERS = [
    {
      id: 'home',
      label: 'Home',
      tools: [
        { href: 'index.html', label: 'Dashboard', match: ['index.html', '/'] },
      ],
    },
    {
      id: 'tracking',
      label: 'Tracking',
      tools: [
        { href: 'portfolio_tracker.html', label: 'Tracker',     match: ['portfolio_tracker'] },
        { href: 'portfolio_review.html',  label: 'Review',      match: ['portfolio_review'] },
        { href: 'net_worth.html',         label: 'Net Worth',   match: ['net_worth'] },
        { href: 'expenses.html',          label: 'Expenses',    match: ['expenses'] },
      ],
    },
    {
      id: 'retirement',
      label: 'Retirement',
      tools: [
        { href: 'retirement_master_plan_2.html', label: 'Master Plan',  match: ['retirement_master_plan'] },
        { href: 'monte_carlo.html',              label: 'Monte Carlo',  match: ['monte_carlo'] },
      ],
    },
    {
      id: 'tax',
      label: 'Tax',
      tools: [
        { href: 'TaxEstimatorV5.html', label: 'Tax Estimator', match: ['TaxEstimatorV5'] },
      ],
    },
    {
      id: 'tools',
      label: 'Tools',
      tools: [
        { href: 'social_security.html',                  label: 'Social Security', match: ['social_security'] },
        { href: 'roth_conversion.html',                  label: 'Roth Conversion', match: ['roth_conversion'] },
        { href: 'golden_ratio_portfolio_dashboard.html', label: 'Golden φ',        match: ['golden_ratio'] },
        { href: 'TaxAssetCalcv4.html',                   label: 'Asset & Cap-Gains', match: ['TaxAssetCalc'] },
      ],
    },
  ];

  // Flat module list (back-compat for any tool that reads
  // WealthSuite.modules — e.g. dashboard card grid).
  const MODULES = CLUSTERS.flatMap(c => c.tools);

  // ---------- Theme ----------
  function readPreference() {
    const v = localStorage.getItem(STORAGE_KEY);
    return VALID.includes(v) ? v : 'system';
  }

  function resolveTheme(pref) {
    if (pref === 'system') return mql.matches ? 'dark' : 'light';
    return pref;
  }

  // ---------- Accent ----------
  // Settings lets users pick an accent; we override the --primary* tokens
  // inline (beats theme.css :root) so it applies suite-wide without a
  // stylesheet edit. Values are theme-aware. 'green' = theme.css default.
  const ACCENT_KEY = 'wealthSuite.accent';
  const ACCENT_VARS = ['--primary', '--primary-strong', '--primary-weak', '--on-primary', '--primary-text'];
  const ACCENTS = {
    blue: {
      light: { '--primary': '#1A73E8', '--primary-strong': '#1667C9', '--primary-weak': '#E8F0FE', '--on-primary': '#FFFFFF', '--primary-text': '#1666C9' },
      dark:  { '--primary': '#8AB4F8', '--primary-strong': '#AECBFA', '--primary-weak': 'rgba(138,180,248,.16)', '--on-primary': '#0B1B34', '--primary-text': '#AECBFA' },
    },
    purple: {
      light: { '--primary': '#7B1FA2', '--primary-strong': '#641A86', '--primary-weak': '#F3E5F5', '--on-primary': '#FFFFFF', '--primary-text': '#6A1B8F' },
      dark:  { '--primary': '#E1A9F0', '--primary-strong': '#ECC3F5', '--primary-weak': 'rgba(225,169,240,.16)', '--on-primary': '#2A0B34', '--primary-text': '#ECC3F5' },
    },
    teal: {
      light: { '--primary': '#00695C', '--primary-strong': '#004D40', '--primary-weak': '#E0F2F1', '--on-primary': '#FFFFFF', '--primary-text': '#00594E' },
      dark:  { '--primary': '#5FC9BC', '--primary-strong': '#86D8CD', '--primary-weak': 'rgba(95,201,188,.16)', '--on-primary': '#052B27', '--primary-text': '#86D8CD' },
    },
  };
  function readAccent() { return localStorage.getItem(ACCENT_KEY) || 'green'; }
  function applyAccent(theme) {
    const s = document.documentElement.style;
    ACCENT_VARS.forEach((v) => s.removeProperty(v));
    const set = ACCENTS[readAccent()] && ACCENTS[readAccent()][theme === 'dark' ? 'dark' : 'light'];
    if (set) ACCENT_VARS.forEach((v) => s.setProperty(v, set[v]));
  }

  function applyTheme() {
    const pref = readPreference();
    const resolved = resolveTheme(pref);
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-pref', pref);
    applyAccent(resolved);
    // Update toggle button state if mounted
    document.querySelectorAll('[data-theme-cycle]').forEach((btn) => {
      btn.setAttribute('aria-label', `Theme: ${pref} (click to change)`);
      btn.dataset.themePref = pref;
    });
  }

  function cycleTheme() {
    const cur = readPreference();
    const next = VALID[(VALID.indexOf(cur) + 1) % VALID.length];
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme();
  }

  // React to system changes if user is on "system" preference
  mql.addEventListener('change', () => {
    if (readPreference() === 'system') applyTheme();
  });

  // Keep theme in sync when another document (e.g. the app-shell that
  // embeds this page in an iframe, or another tab) changes the
  // preference. `storage` fires in every OTHER same-origin document.
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === ACCENT_KEY) applyTheme();
  });

  // Apply ASAP — before paint where possible
  applyTheme();

  // Are we embedded inside the Wealth Suite app shell (index.html)?
  // When so, the shell already renders the sidebar + top bar, so this
  // page must NOT inject its own topnav (would double up) and must drop
  // the top padding it reserves for that topnav.
  function isEmbedded() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }

  // ---------- Topbar injection ----------
  function currentModuleHref() {
    const path = location.pathname.toLowerCase();
    for (const m of MODULES) {
      if (m.match.some((s) => path.endsWith(s.toLowerCase()) || path.includes('/' + s.toLowerCase()))) {
        return m.href;
      }
    }
    // Root or unknown — default highlight dashboard
    if (path.endsWith('/') || path === '') return 'index.html';
    return null;
  }

  // Find which cluster a tool belongs to (by tool href).
  function clusterForHref(href) {
    for (const c of CLUSTERS) {
      if (c.tools.some((t) => t.href === href)) return c;
    }
    return CLUSTERS[0]; // fallback: Home
  }

  // Icon set (Material Symbols-inspired SVGs, 24x24)
  const ICONS = {
    themeSystem:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5l1 2h2v2H7v-2h2l1-2H5a2 2 0 0 1-2-2V5zm2 0v10h14V5H5z"/></svg>',
    themeLight:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm0 17a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1zM2 12a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1zm17 0a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1zM4.93 4.93a1 1 0 0 1 1.41 0l1.42 1.42a1 1 0 1 1-1.42 1.41L4.93 6.34a1 1 0 0 1 0-1.41zm11.31 11.31a1 1 0 0 1 1.41 0l1.42 1.42a1 1 0 1 1-1.42 1.41l-1.41-1.42a1 1 0 0 1 0-1.41zM19.07 4.93a1 1 0 0 1 0 1.41l-1.42 1.42a1 1 0 1 1-1.41-1.42l1.41-1.41a1 1 0 0 1 1.42 0zM7.76 16.24a1 1 0 0 1 0 1.41l-1.42 1.42a1 1 0 1 1-1.41-1.42l1.41-1.41a1 1 0 0 1 1.42 0z"/></svg>',
    themeDark:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.64 13a1 1 0 0 0-1.05-.14 8 8 0 1 1-9.45-9.45 1 1 0 0 0-1.2-1.3 10 10 0 1 0 12 12 1 1 0 0 0-.3-1.11z"/></svg>',
  };

  function themeIcon(pref) {
    if (pref === 'light') return ICONS.themeLight;
    if (pref === 'dark')  return ICONS.themeDark;
    return ICONS.themeSystem;
  }

  function buildTopbar(options) {
    const opts = options || {};
    const activeHref = opts.activeHref || currentModuleHref();
    const activeCluster = activeHref ? clusterForHref(activeHref) : CLUSTERS[0];
    const pref = readPreference();

    const header = document.createElement('header');
    header.className = 'suite-topbar';
    header.setAttribute('data-suite-injected', opts.injected ? 'true' : 'false');
    header.setAttribute('data-active-cluster', activeCluster.id);

    // ---- Primary row: brand + cluster tabs + theme toggle ----
    const inner = document.createElement('div');
    inner.className = 'suite-topbar__inner';

    const brand = document.createElement('a');
    brand.className = 'suite-brand';
    brand.href = 'index.html';
    brand.innerHTML =
      '<span class="suite-brand__logo" aria-hidden="true">W</span>' +
      '<h1 class="suite-brand__name">Wealth Suite</h1>';
    inner.appendChild(brand);

    const nav = document.createElement('nav');
    nav.className = 'suite-topnav';
    nav.setAttribute('aria-label', 'Primary navigation');
    CLUSTERS.forEach((c) => {
      // Each cluster tab links to its first tool (Home → dashboard,
      // Tracking → tracker, etc.). The sub-nav lets you pick a
      // different tool within the cluster.
      const a = document.createElement('a');
      a.className = 'suite-topnav__link';
      a.href = c.tools[0].href;
      a.textContent = c.label;
      a.setAttribute('data-cluster', c.id);
      if (c.id === activeCluster.id) {
        a.classList.add('is-active');
        a.setAttribute('aria-current', 'page');
      }
      nav.appendChild(a);
    });
    inner.appendChild(nav);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suite-iconbutton';
    btn.setAttribute('data-theme-cycle', '');
    btn.setAttribute('title', 'Cycle theme: system → light → dark');
    btn.innerHTML = themeIcon(pref);
    btn.addEventListener('click', () => {
      cycleTheme();
      btn.innerHTML = themeIcon(readPreference());
    });
    inner.appendChild(btn);

    header.appendChild(inner);

    // ---- Sub-nav row: tool pills inside the active cluster ----
    // Only rendered when the active cluster has more than one tool.
    // Home and Tax are single-tool clusters → no sub-nav.
    if (activeCluster.tools.length > 1) {
      const subInner = document.createElement('div');
      subInner.className = 'suite-subnav__inner';

      const subnav = document.createElement('nav');
      subnav.className = 'suite-subnav';
      subnav.setAttribute('aria-label', activeCluster.label + ' tools');
      activeCluster.tools.forEach((t) => {
        const a = document.createElement('a');
        a.className = 'suite-subnav__link';
        a.href = t.href;
        a.textContent = t.label;
        if (t.href === activeHref) {
          a.classList.add('is-active');
          a.setAttribute('aria-current', 'page');
        }
        subnav.appendChild(a);
      });
      subInner.appendChild(subnav);

      const subRow = document.createElement('div');
      subRow.className = 'suite-subnav-row';
      subRow.appendChild(subInner);
      header.appendChild(subRow);
      header.setAttribute('data-has-subnav', 'true');
    } else {
      header.setAttribute('data-has-subnav', 'false');
    }

    return header;
  }

  function injectTopbarIfMissing() {
    // Embedded in the app shell → shell owns the chrome. Skip the
    // topnav and remove the reserved top padding so the tool sits flush.
    if (isEmbedded()) {
      document.documentElement.setAttribute('data-suite-embedded', 'true');
      try { document.body.style.paddingTop = '0'; } catch (e) {}
      return;
    }
    // Phase 8: JS is the single source of truth for the topbar.
    // If a static topbar exists (dashboard renders one for no-flash
    // initial paint), replace it in place with the built version so
    // cluster/sub-nav stay in sync. Otherwise inject at body start.
    const existing = document.querySelector('.suite-topbar');
    const fresh = buildTopbar({ injected: !existing });

    if (existing) {
      existing.parentNode.replaceChild(fresh, existing);
    } else {
      document.body.insertBefore(fresh, document.body.firstChild);
      document.body.classList.add('suite-tool-shell');
    }

    // Tag the body with the active cluster + whether the sub-nav is
    // visible, so CSS can adjust the top padding (~64px without sub-nav,
    // ~108px with). Avoids layout jumps.
    const hasSubnav = fresh.getAttribute('data-has-subnav') === 'true';
    document.body.setAttribute('data-active-cluster', fresh.getAttribute('data-active-cluster') || 'home');
    document.body.setAttribute('data-has-subnav', hasSubnav ? 'true' : 'false');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectTopbarIfMissing);
  } else {
    injectTopbarIfMissing();
  }

  // ---------- Shared household banner ----------
  // Adapters call WealthSuite.renderHouseholdBanner(opts) instead of
  // reimplementing the create/update logic themselves.
  //
  // opts.anchor  — CSS selector string OR function() → Element
  //                (where to insert the banner on first render)
  // opts.fields  — ordered array of field keys to show; supported:
  //                'portfolio' | 'expenses' | 'income' | 'contributions'
  //                | 'ages' | 'yearsToRetire'
  function renderHouseholdBanner(opts) {
    var store = window.WealthSuite && window.WealthSuite.store;
    if (!store) return;
    var state = store.export();
    if (!state || !state.meta || state.meta.lastUpdated == null) return;

    function fmtM(n) {
      n = Number(n);
      if (!n || !isFinite(n)) return null;
      if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
      if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
      return '$' + Math.round(n);
    }
    function sumSp(o) {
      return o ? (Number(o.s1) || 0) + (Number(o.s2) || 0) : 0;
    }

    var inc     = state.income || {};
    var c       = (state.retirement && state.retirement.contributions) || {};
    var plan    = (state.retirement && state.retirement.plan) || {};
    var spouses = (state.household && state.household.spouses) || [];

    var totalIncome   = sumSp(inc.salary) + sumSp(inc.bonus) + sumSp(inc.rsuVests)
                      + (Number((inc.capitalGains || {}).shortTerm) || 0)
                      + (Number((inc.capitalGains || {}).longTerm)  || 0);
    var totalContrib  = sumSp(c.traditional401k) + sumSp(c.roth401k) + sumSp(c.afterTax401k)
                      + sumSp(c.catchup) + sumSp(c.ira) + (Number(c.hsa) || 0);
    var portVal       = state.portfolio && state.portfolio.totalValue;
    var expenses      = plan.annualExpenses;
    var retireAge     = plan.targetRetireAge;
    var ages          = spouses.map(function(s) {
      return (s && s.age != null && s.age !== '') ? String(s.age) : null;
    }).filter(Boolean);
    var rawAges       = spouses.map(function(s) {
      return (s && s.age != null && s.age !== '') ? Number(s.age) : NaN;
    }).filter(function(n) { return !isNaN(n) && n > 0; });
    var currentAge    = rawAges.length ? Math.min.apply(null, rawAges) : null;
    var yearsToRetire = (retireAge && currentAge) ? Math.max(0, retireAge - currentAge) : null;

    var COMPUTED = {
      portfolio:     portVal      ? 'portfolio '     + fmtM(portVal)              : null,
      expenses:      expenses     ? 'expenses '      + fmtM(expenses) + '/yr'     : null,
      income:        totalIncome  ? 'income '        + fmtM(totalIncome)          : null,
      contributions: totalContrib ? 'contributions ' + fmtM(totalContrib) + '/yr' : null,
      ages:          ages.length  ? 'ages '          + ages.join(' & ')           : null,
      yearsToRetire: yearsToRetire != null
        ? 'retire in ' + yearsToRetire + ' yrs (age ' + retireAge + ')' : null,
    };

    var fields = (opts && opts.fields) || [];
    var parts  = fields.map(function(f) { return COMPUTED[f]; }).filter(Boolean);
    if (!parts.length) return;

    var banner = document.getElementById('suite-household-banner');
    if (!banner) {
      var anchor = null;
      if (opts && typeof opts.anchor === 'function') {
        anchor = opts.anchor();
      } else if (opts && typeof opts.anchor === 'string') {
        anchor = document.querySelector(opts.anchor);
      }
      if (!anchor) return;
      banner = document.createElement('p');
      banner.id = 'suite-household-banner';
      banner.style.cssText =
        'margin-top:4px;font-size:11px;letter-spacing:.04em;opacity:.7;text-transform:uppercase';
      anchor.parentNode.insertBefore(banner, anchor.nextSibling);
    }
    banner.textContent = 'Wealth Suite household · ' + parts.join(' · ');
  }

  // Public API (in case tools want to read theme or rebuild).
  // IMPORTANT: extend rather than replace — suite-state.js may have already
  // attached `.store` to window.WealthSuite when loaded as an earlier
  // defer script. Reassigning the whole namespace would wipe it.
  window.WealthSuite = window.WealthSuite || {};
  Object.assign(window.WealthSuite, {
    getTheme: () => resolveTheme(readPreference()),
    getPreference: readPreference,
    setPreference: (p) => {
      if (!VALID.includes(p)) return;
      localStorage.setItem(STORAGE_KEY, p);
      applyTheme();
    },
    cycle: cycleTheme,
    getAccent: readAccent,
    setAccent: (a) => { localStorage.setItem(ACCENT_KEY, a || 'green'); applyTheme(); },
    modules: MODULES.slice(),
    clusters: CLUSTERS.map(c => ({ id: c.id, label: c.label, tools: c.tools.slice() })),
    renderHouseholdBanner,
  });
})();
