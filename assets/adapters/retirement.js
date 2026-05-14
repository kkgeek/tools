/* =============================================================
 * Wealth Suite — Retirement Planner adapter (Phase 2 step 3)
 *
 * The Retirement Master Plan is largely a fixed report; its only
 * interactive input is the RMD-tab slider that models a traditional
 * IRA balance ($100k–$4M, $50k steps). This adapter:
 *
 *   1. Mirrors slider changes into the suite store
 *      (retirement.balances.total + .breakdown.traditionalIRA) so
 *      the dashboard snapshot and future tools can see the modeled
 *      balance.
 *   2. Restores the slider position from the suite store on load
 *      and re-renders the RMD tab math.
 *   3. Injects a one-line "Household per Wealth Suite" subtitle in
 *      the page header when the suite has any data, so the user
 *      can confirm the household context that drove the plan.
 *
 * The tool's inline script keeps owning the slider + chart math;
 * we only listen and inject.
 * ============================================================= */
(function () {
  'use strict';

  const store = window.WealthSuite && window.WealthSuite.store;
  if (!store) {
    console.warn('[retirement-adapter] WealthSuite.store missing — adapter inactive');
    return;
  }

  const EDITED_BY = 'retirement';
  const DEBOUNCE_MS = 250;

  // ---------- formatters ----------
  const usd0 = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  });
  function fmtMoney(n) {
    if (n == null || !Number.isFinite(Number(n))) return null;
    return usd0.format(Number(n));
  }

  function sumSpouse(o) {
    if (!o) return 0;
    return (Number(o.s1) || 0) + (Number(o.s2) || 0);
  }

  // ---------- slider mirror ----------
  function wireSlider() {
    const slider = document.getElementById('balSlider');
    if (!slider) return;

    // Restore slider from store if a retirement balance was previously set.
    const stored = store.get('retirement.balances.total');
    if (typeof stored === 'number' && stored > 0) {
      const min = Number(slider.min) || 100;
      const max = Number(slider.max) || 4000;
      const step = Number(slider.step) || 50;
      const inK = Math.round(stored / 1000 / step) * step;
      slider.value = String(Math.max(min, Math.min(max, inK)));
      if (typeof window.updateRMD === 'function') {
        try { window.updateRMD(); } catch (e) { /* ignore */ }
      }
    }

    let timer = null;
    let lastWritten = null;
    slider.addEventListener('input', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const dollars = (parseInt(slider.value, 10) || 0) * 1000;
        if (dollars === lastWritten) return;
        lastWritten = dollars;
        const opts = { editedBy: EDITED_BY };
        store.set('retirement.balances.total', dollars, opts);
        store.set('retirement.balances.breakdown.traditionalIRA', dollars, opts);
      }, DEBOUNCE_MS);
    });
  }

  // ---------- household banner ----------
  function renderHouseholdBanner() {
    const state = store.export();
    if (!state || !state.meta || state.meta.lastUpdated == null) return;

    const inc = state.income || {};
    const totalIncome =
      sumSpouse(inc.salary) + sumSpouse(inc.bonus) + sumSpouse(inc.rsuVests) +
      (Number(inc.capitalGains?.shortTerm) || 0) +
      (Number(inc.capitalGains?.longTerm) || 0);

    const c = state.retirement?.contributions || {};
    const totalContrib =
      sumSpouse(c.traditional401k) + sumSpouse(c.roth401k) +
      sumSpouse(c.afterTax401k) + sumSpouse(c.catchup) +
      sumSpouse(c.ira) + (Number(c.hsa) || 0);

    const ages = (state.household?.spouses || [])
      .map(s => (s && s.age != null && s.age !== '') ? `${s.age}` : null)
      .filter(Boolean);

    const parts = [];
    if (totalIncome) parts.push(`income ${fmtMoney(totalIncome)}`);
    if (totalContrib) parts.push(`contributions ${fmtMoney(totalContrib)}/yr`);
    if (ages.length) parts.push(`ages ${ages.join(' & ')}`);
    if (!parts.length) return;

    // Replace existing banner if we already injected one (e.g. after a store update).
    let banner = document.getElementById('suite-household-banner');
    if (!banner) {
      const headerSub = document.querySelector('.hdr-l p');
      if (!headerSub) return;
      banner = document.createElement('p');
      banner.id = 'suite-household-banner';
      banner.style.cssText =
        'margin-top:4px;font-size:11px;letter-spacing:.04em;opacity:.7;text-transform:uppercase';
      headerSub.parentNode.insertBefore(banner, headerSub.nextSibling);
    }
    banner.textContent = 'Wealth Suite household · ' + parts.join(' · ');
  }

  // ---------- bootstrap ----------
  function init() {
    wireSlider();
    renderHouseholdBanner();
    // Re-render banner if Tax Estimator (or another tab) updates the suite store.
    store.subscribe('', renderHouseholdBanner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.WealthSuite._retirementAdapter = { renderHouseholdBanner };
})();
