/* =============================================================
 * Wealth Suite — Roth Conversion Planner adapter (Phase 4 P1)
 *
 * Read-only seed: pulls household data from the suite store and
 * calls window.__rothSeed (registered by the React component after
 * mount) to pre-fill the form. No writeback in v1.
 *
 * v2: consumes Settings preferences — the active scenario's
 * targetRetireAge overrides the plan's, and preferences.fedBracket
 * defaults the "fill through bracket" select (snapped to the tool's
 * 12/22/24/32 options).
 * ============================================================= */
(function () {
  'use strict';

  const store = window.WealthSuite && window.WealthSuite.store;
  if (!store) return;

  function pullData() {
    const state = store.export();
    if (!state || !state.meta || state.meta.lastUpdated == null) return null;

    const inc      = state.income || {};
    const ret      = state.retirement || {};
    const plan     = ret.plan || {};
    const balances = ret.balances || {};
    const hh       = state.household || {};
    const spouses  = hh.spouses || [];

    const salary = (Number(inc.salary    && inc.salary.s1)    || 0)
                 + (Number(inc.salary    && inc.salary.s2)    || 0);
    const bonus  = (Number(inc.bonus     && inc.bonus.s1)     || 0)
                 + (Number(inc.bonus     && inc.bonus.s2)     || 0);
    const rsu    = (Number(inc.rsuVests  && inc.rsuVests.s1)  || 0)
                 + (Number(inc.rsuVests  && inc.rsuVests.s2)  || 0);
    const ordinaryIncome = salary + bonus + rsu || null;

    const ages = spouses
      .map(s => (s && s.age != null && s.age !== '') ? Number(s.age) : NaN)
      .filter(n => !isNaN(n) && n > 0);
    const currentAge = ages.length ? Math.min(...ages) : null;

    const filingStatus = hh.filingStatus === 'mfj' ? 'married' : 'single';

    const prefs = state.preferences || {};
    const scenarios = prefs.scenarios || [];
    const scn = scenarios.length
      ? (scenarios.find(s => s && s.id === prefs.activeScenarioId) || scenarios[0])
      : null;

    // Tool's select only offers 12/22/24/32 — snap to the highest option
    // at or below the configured bracket (35%+ households still cap at 32).
    const fed = Number(prefs.fedBracket) || 0;
    const targetBracket = fed ? ([32, 24, 22, 12].find(b => b <= fed) || 12) : null;

    return {
      filingStatus,
      currentAge,
      retireAge:    (scn && Number(scn.targetRetireAge)) || plan.targetRetireAge || null,
      tradBalance:  balances.total       || null,
      currentIncome: ordinaryIncome,
      targetBracket,
    };
  }

  function seed() {
    if (typeof window.__rothSeed !== 'function') return;
    const d = pullData();
    if (d) window.__rothSeed(d);
  }

  // The React component registers __rothSeed after mount; give it time.
  const delay = document.readyState === 'loading' ? 500 : 350;
  setTimeout(seed, delay);
})();
