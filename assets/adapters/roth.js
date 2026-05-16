/* =============================================================
 * Wealth Suite — Roth Conversion Planner adapter (Phase 4 P1)
 *
 * Read-only seed: pulls household data from the suite store and
 * calls window.__rothSeed (registered by the React component after
 * mount) to pre-fill the form. No writeback in v1.
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

    return {
      filingStatus,
      currentAge,
      retireAge:    plan.targetRetireAge || null,
      tradBalance:  balances.total       || null,
      currentIncome: ordinaryIncome,
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
