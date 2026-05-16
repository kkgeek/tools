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

  // Tool registry — keep in sync with index.html cards.
  // `match` is a substring on location.pathname used to highlight the
  // active link in the injected topbar.
  const MODULES = [
    { href: 'index.html',                          label: 'Dashboard',   match: ['index.html', '/'] },
    { href: 'TaxEstimatorV5.html',                 label: 'Tax',         match: ['TaxEstimatorV5'] },
    { href: 'TaxAssetCalcv4.html',                 label: 'Assets',      match: ['TaxAssetCalc'] },
    { href: 'retirement_master_plan_2.html',       label: 'Retirement',  match: ['retirement_master_plan'] },
    { href: 'portfolio_review.html',               label: 'Portfolio',   match: ['portfolio_review'] },
    { href: 'golden_ratio_portfolio_dashboard.html', label: 'Golden φ',  match: ['golden_ratio'] },
    { href: 'roth_conversion.html',                  label: 'Roth',      match: ['roth_conversion'] },
    { href: 'portfolio_tracker.html',                 label: 'Tracker',   match: ['portfolio_tracker'] },
    { href: 'social_security.html',                   label: 'SS',         match: ['social_security'] },
    { href: 'net_worth.html',                         label: 'Net Worth',  match: ['net_worth'] },
  ];

  // ---------- Theme ----------
  function readPreference() {
    const v = localStorage.getItem(STORAGE_KEY);
    return VALID.includes(v) ? v : 'system';
  }

  function resolveTheme(pref) {
    if (pref === 'system') return mql.matches ? 'dark' : 'light';
    return pref;
  }

  function applyTheme() {
    const pref = readPreference();
    document.documentElement.setAttribute('data-theme', resolveTheme(pref));
    document.documentElement.setAttribute('data-theme-pref', pref);
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

  // Apply ASAP — before paint where possible
  applyTheme();

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
    const pref = readPreference();

    const header = document.createElement('header');
    header.className = 'suite-topbar';
    header.setAttribute('data-suite-injected', opts.injected ? 'true' : 'false');

    const inner = document.createElement('div');
    inner.className = 'suite-topbar__inner';

    // Brand
    const brand = document.createElement('a');
    brand.className = 'suite-brand';
    brand.href = 'index.html';
    brand.innerHTML =
      '<span class="suite-brand__logo" aria-hidden="true">W</span>' +
      '<h1 class="suite-brand__name">Wealth Suite</h1>';
    inner.appendChild(brand);

    // Nav links
    const nav = document.createElement('nav');
    nav.className = 'suite-topnav';
    nav.setAttribute('aria-label', 'Module navigation');
    MODULES.forEach((m) => {
      const a = document.createElement('a');
      a.className = 'suite-topnav__link';
      a.href = m.href;
      a.textContent = m.label;
      if (m.href === activeHref) {
        a.classList.add('is-active');
        a.setAttribute('aria-current', 'page');
      }
      nav.appendChild(a);
    });
    inner.appendChild(nav);

    // Theme toggle
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
    return header;
  }

  function injectTopbarIfMissing() {
    // If page already has a suite-topbar (e.g. the dashboard rendered
    // it server-side in markup), only wire up the theme button.
    const existing = document.querySelector('.suite-topbar');
    if (existing) {
      const btn = existing.querySelector('[data-theme-cycle]');
      if (btn && !btn.dataset.suiteBound) {
        btn.addEventListener('click', () => {
          cycleTheme();
          btn.innerHTML = themeIcon(readPreference());
        });
        btn.innerHTML = themeIcon(readPreference());
        btn.dataset.suiteBound = '1';
      }
      return;
    }

    // Otherwise inject at body start. Topbar is position:fixed (see
    // suite.css) so it survives flex/centered body layouts. The
    // matching .suite-tool-shell class adds the 64px top padding so
    // the tool's own content isn't tucked under the bar.
    const topbar = buildTopbar({ injected: true });
    document.body.insertBefore(topbar, document.body.firstChild);
    document.body.classList.add('suite-tool-shell');
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
    modules: MODULES.slice(),
    renderHouseholdBanner,
  });
})();
