/* =============================================================
 * Wealth Suite — Monte Carlo adapter (Phase 4 P3)
 *
 * Read-only: seeds monte_carlo.html form inputs from the suite
 * store on load. No write-back — simulation results are ephemeral.
 *
 * Starting balance: portfolio.totalValue + retirement.balances.total
 * Withdrawal:       retirement.plan.annualExpenses, overridden by the
 *                   active scenario's withdrawalRate × starting balance
 * Mean return:      retirement.plan.growthAssumption
 * Current age:      min(household.spouses[*].age)
 * Retire age:       active scenario's targetRetireAge, else
 *                   retirement.plan.targetRetireAge
 * ============================================================= */
(function () {
  'use strict';

  const store = window.WealthSuite && window.WealthSuite.store;
  if (!store) {
    console.warn('[mc-adapter] WealthSuite.store missing — adapter inactive');
    return;
  }

  function seed() {
    // _mcTool is set by the inline script in monte_carlo.html
    if (!window._mcTool) return;

    const state = store.export();
    if (!state || !state.meta || state.meta.lastUpdated == null) return;

    const sp = (state.household && state.household.spouses) || [];
    const rawAges = sp
      .map(s => (s && s.age != null && s.age !== '') ? Number(s.age) : NaN)
      .filter(n => !isNaN(n) && n > 0);
    const currentAge = rawAges.length ? Math.min(...rawAges) : null;

    const portVal    = Number((state.portfolio  && state.portfolio.totalValue)                       || 0);
    const retireBal  = Number((state.retirement && state.retirement.balances && state.retirement.balances.total) || 0);
    const expenses   = state.retirement && state.retirement.plan && state.retirement.plan.annualExpenses;
    const growthRate = state.retirement && state.retirement.plan && state.retirement.plan.growthAssumption;

    // Active scenario (Settings) overrides plan retire age; its
    // withdrawalRate (% of starting balance) overrides annualExpenses.
    const prefs = state.preferences || {};
    const scenarios = prefs.scenarios || [];
    const scn = scenarios.length
      ? (scenarios.find(s => s && s.id === prefs.activeScenarioId) || scenarios[0])
      : null;
    const retireAge = (scn && Number(scn.targetRetireAge))
      || (state.retirement && state.retirement.plan && state.retirement.plan.targetRetireAge);

    const combined = portVal + retireBal;

    let withdraw = expenses > 0 ? expenses : null;
    if (scn && Number(scn.withdrawalRate) > 0 && combined > 0) {
      withdraw = Math.round(combined * Number(scn.withdrawalRate) / 100);
    }

    window._mcTool.setParams({
      balance:  combined  > 0 ? combined  : null,
      withdraw: withdraw,
      ret:      growthRate > 0 ? growthRate : null,
      cAge:     currentAge,
      rAge:     retireAge,
    });
  }

  function renderHouseholdBanner() {
    var WS = window.WealthSuite;
    if (!WS || !WS.renderHouseholdBanner) return;
    WS.renderHouseholdBanner({
      anchor: '.hdr-l p',
      fields: ['portfolio', 'expenses', 'ages', 'yearsToRetire'],
    });
  }

  function init() {
    seed();
    renderHouseholdBanner();
    store.subscribe('', renderHouseholdBanner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
