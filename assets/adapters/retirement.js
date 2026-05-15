/* =============================================================
 * Wealth Suite — Retirement Planner adapter (Phase 2 step 3 / Phase 3)
 *
 * Phase 2:
 *   1. Mirrors RMD slider → suite store (retirement.balances.total)
 *   2. Restores slider from store on load
 *   3. Injects household banner in header
 *
 * Phase 3 additions:
 *   4. Reads portfolio.totalValue, retirement.plan.{targetRetireAge,
 *      annualExpenses, growthAssumption}, and household ages to derive
 *      portAtRetire and spendAtRetire (compound growth / inflation to
 *      the target retire age).
 *   5. Patches window.calcPortfolio so the lazy-built Projections
 *      chart uses store-derived inputs instead of the hardcoded
 *      $6.52M / $287k / age-55 defaults.
 *   6. Recomputes bullD/baseD/stressD globals immediately; updates
 *      the v70/v85/v85s tiles and the "Starting portfolio" tile.
 *   7. Updates the overview summary tiles: Current portfolio,
 *      Projected at age X, Spend at retirement, Spend at age 70,
 *      3-yr buffer needed. Also updates the header portfolio stat.
 *   8. Expands the household banner to surface portfolio and
 *      spending context alongside the existing income/age data.
 *
 * The tool's own UI/state code is never modified. All contact is
 * through the global namespace and DOM updates.
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
  const INFLATION = 0.035;

  // ---------- formatters ----------
  const usd0 = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  });
  function fmtMoney(n) {
    if (n == null || !Number.isFinite(Number(n))) return null;
    return usd0.format(Number(n));
  }
  function fmtM(n) {
    if (!n || !isFinite(n) || n <= 0) return '—';
    return '$' + (n / 1e6).toFixed(2) + 'M';
  }
  function fmtK(n) {
    if (!n || !isFinite(n) || n <= 0) return '—';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    return '$' + Math.round(n / 1000) + 'k';
  }
  function sumSpouse(o) {
    if (!o) return 0;
    return (Number(o.s1) || 0) + (Number(o.s2) || 0);
  }

  // ---------- DOM helpers ----------
  function findScTile(labelText) {
    for (const el of document.querySelectorAll('.sc')) {
      const l = el.querySelector('.sc-l');
      if (l && l.textContent.trim() === labelText) {
        return el.querySelector('.sc-v');
      }
    }
    return null;
  }

  // ---------- Projection state (closure vars shared with patched calcPortfolio) ----------
  var _port      = 6520000;   // portAtRetire — default matches tool hardcode
  var _spend     = 287000;    // spendAtRetire — default matches tool hardcode
  var _retireAge = 55;        // default matches tool hardcode
  var _curAge    = 51;        // default matches tool hardcode

  // ---------- calcPortfolio patch ----------
  // Replaces the tool's hardcoded function with one that uses store-derived
  // inputs while preserving the identical loop logic (SS at 70, COLA, etc.).
  function patchCalcPortfolio() {
    window.calcPortfolio = function (gr, ir) {
      var port = _port, spend = _spend;
      var startAge = _retireAge;
      var years = Math.max(35, 90 - startAge);
      var labels = [], vals = [];
      for (var yr = 0; yr <= years; yr++) {
        var age = startAge + yr;
        labels.push(age);
        vals.push(parseFloat((port / 1e6).toFixed(2)));
        var ss = 0;
        if (age >= 70) {
          // Nominal SS at age 70, inflated from current age. The 124872 base
          // is the combined household SS estimate baked into the tool.
          var ssAt70 = 124872 * Math.pow(1 + ir, Math.max(0, 70 - _curAge));
          ss = ssAt70 * Math.pow(1.025, age - 70);
        }
        port = Math.max(0, port * (1 + gr) - Math.max(0, spend - ss));
        spend *= (1 + ir);
      }
      return { labels: labels, vals: vals };
    };
  }

  // ---------- Projection seeding ----------
  function seedProjections() {
    const state = store.export();
    if (!state || !state.meta || state.meta.lastUpdated == null) return;

    const currentPortfolio = state.portfolio && state.portfolio.totalValue;
    const retireAge        = state.retirement && state.retirement.plan && state.retirement.plan.targetRetireAge;
    const annualExpenses   = state.retirement && state.retirement.plan && state.retirement.plan.annualExpenses;
    const growthAssumption = state.retirement && state.retirement.plan && state.retirement.plan.growthAssumption;

    const spouses  = (state.household && state.household.spouses) || [];
    const rawAges  = spouses
      .map((s) => (s && s.age != null && s.age !== '') ? Number(s.age) : NaN)
      .filter((n) => !isNaN(n) && n > 0);
    const currentAge = rawAges.length > 0 ? Math.min(...rawAges) : null;

    const hasPortfolio = currentPortfolio && currentPortfolio > 0;
    const hasExpenses  = annualExpenses && annualExpenses > 0;
    if (!hasPortfolio && !hasExpenses) return;

    const growthRate     = (growthAssumption && growthAssumption > 0) ? growthAssumption : 0.07;
    const retireAgeVal   = (retireAge && retireAge > 0) ? retireAge : 55;
    const curAgeVal      = currentAge || 51;
    const yearsToRetire  = Math.max(0, retireAgeVal - curAgeVal);

    // Update closure vars used by the patched calcPortfolio
    _retireAge = retireAgeVal;
    _curAge    = curAgeVal;
    if (hasPortfolio) {
      _port = currentPortfolio * Math.pow(1 + growthRate, yearsToRetire);
    }
    if (hasExpenses) {
      _spend = annualExpenses * Math.pow(1 + INFLATION, yearsToRetire);
    }

    // Patch and recompute datasets (chart is lazy — runs before any tab click)
    patchCalcPortfolio();
    window.bullD   = window.calcPortfolio(0.09, 0.035);
    window.baseD   = window.calcPortfolio(0.07, 0.035);
    window.stressD = window.calcPortfolio(0.05, 0.04);

    // v70/v85/v85s use age-relative indices
    const idx70 = 70 - retireAgeVal;
    const idx85 = 85 - retireAgeVal;
    const safeVal = (arr, i) => (i >= 0 && arr && arr[i] != null) ? arr[i].toFixed(1) : null;

    const v70El  = document.getElementById('v70');
    const v85El  = document.getElementById('v85');
    const v85sEl = document.getElementById('v85s');
    if (v70El  && safeVal(window.baseD.vals,   idx70)) v70El.textContent  = '$' + safeVal(window.baseD.vals, idx70)   + 'M';
    if (v85El  && safeVal(window.baseD.vals,   idx85)) v85El.textContent  = '$' + safeVal(window.baseD.vals, idx85)   + 'M';
    if (v85sEl && safeVal(window.stressD.vals, idx85)) v85sEl.textContent = '$' + safeVal(window.stressD.vals, idx85) + 'M';

    // Overview tiles
    if (hasPortfolio) {
      const portTile = findScTile('Current portfolio');
      if (portTile) portTile.textContent = fmtM(currentPortfolio);

      const projTile = findScTile('Projected at age 55');
      if (projTile) projTile.textContent = '~' + fmtM(_port);

      const hsVals = document.querySelectorAll('.hs-v');
      if (hsVals[0]) hsVals[0].textContent = fmtM(currentPortfolio);

      const startTile = findScTile('Starting portfolio (age 55)');
      if (startTile) startTile.textContent = fmtM(_port);
    }

    if (hasExpenses) {
      const spendRetireTile = findScTile('Spend at retirement');
      if (spendRetireTile) spendRetireTile.textContent = fmtK(_spend) + '/yr';

      const spend70 = _spend * Math.pow(1 + INFLATION, 70 - retireAgeVal);
      const spend70Tile = findScTile('Spend at age 70');
      if (spend70Tile) spend70Tile.textContent = fmtK(spend70) + '/yr';

      const bufferTile = findScTile('3-yr buffer needed');
      if (bufferTile) bufferTile.textContent = fmtK(_spend * 3);
    }

    // If the Projections chart was somehow already built (e.g. deep-link),
    // destroy it so the next tab-click re-builds it with the new datasets.
    if (window.projBuilt && window.projChart) {
      try { window.projChart.destroy(); } catch (_) { /* ignore */ }
      window.projChart = null;
      window.projBuilt = false;
    }
  }

  // ---------- slider mirror (Phase 2 — unchanged) ----------
  function wireSlider() {
    const slider = document.getElementById('balSlider');
    if (!slider) return;

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

    const portVal  = state.portfolio && state.portfolio.totalValue;
    const expenses = state.retirement && state.retirement.plan && state.retirement.plan.annualExpenses;

    const ages = (state.household?.spouses || [])
      .map((s) => (s && s.age != null && s.age !== '') ? `${s.age}` : null)
      .filter(Boolean);

    const parts = [];
    if (portVal)      parts.push(`portfolio ${fmtMoney(portVal)}`);
    if (expenses)     parts.push(`expenses ${fmtMoney(expenses)}/yr`);
    if (totalIncome)  parts.push(`income ${fmtMoney(totalIncome)}`);
    if (totalContrib) parts.push(`contributions ${fmtMoney(totalContrib)}/yr`);
    if (ages.length)  parts.push(`ages ${ages.join(' & ')}`);
    if (!parts.length) return;

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
    seedProjections();
    wireSlider();
    renderHouseholdBanner();
    store.subscribe('', renderHouseholdBanner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.WealthSuite._retirementAdapter = { seedProjections, renderHouseholdBanner };
})();
