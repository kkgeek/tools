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

  // ---------- "Adopt actual spend" (Phase 9) ----------
  // Trailing-12-month average monthly spend from the Expense Tracker,
  // offered as the annualExpenses assumption instead of a hand-typed guess.
  function computeActualAnnualSpend() {
    const txns = store.get('expenses.transactions');
    if (!Array.isArray(txns) || txns.length === 0) return null;

    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    const byMonth = {};
    for (const t of txns) {
      if (typeof t.date !== 'string' || t.date.length < 7) continue;
      const d = new Date(t.date + 'T00:00:00');
      if (isNaN(d) || d < cutoff) continue;
      const ym = t.date.slice(0, 7);
      byMonth[ym] = (byMonth[ym] || 0) - (Number(t.amount) || 0);
    }
    const months = Object.values(byMonth).filter((v) => v > 0);
    if (months.length === 0) return null;
    const avgMonthly = months.reduce((a, b) => a + b, 0) / months.length;
    return { annual: Math.round(avgMonthly * 12), monthsOfData: months.length };
  }

  function renderAdoptSpendButton() {
    const existing = document.getElementById('ws-adopt-spend');
    const actual = computeActualAnnualSpend();
    if (!actual) { if (existing) existing.remove(); return; }

    const current = store.get('retirement.plan.annualExpenses');
    const adopted = current != null && Math.abs(Number(current) - actual.annual) < 1;

    let el = existing;
    if (!el) {
      const anchor = document.querySelector('.hdr-l p');
      if (!anchor) return;
      el = document.createElement('button');
      el.id = 'ws-adopt-spend';
      el.type = 'button';
      el.style.cssText = [
        'display:inline-flex', 'align-items:center', 'gap:6px',
        'margin-top:8px', 'padding:4px 12px', 'font:500 12px Inter,sans-serif',
        'border-radius:999px', 'cursor:pointer',
        'border:1px solid var(--md-sys-color-outline-variant,#34353B)',
        'background:var(--md-sys-color-surface-container-high,#26272D)',
        'color:var(--md-sys-color-on-surface,#E2E2E9)',
      ].join(';');
      el.addEventListener('click', () => {
        const a = computeActualAnnualSpend();
        if (!a) return;
        store.set('retirement.plan.annualExpenses', a.annual, { editedBy: EDITED_BY });
        seedProjections();
        renderAdoptSpendButton();
      });
      anchor.insertAdjacentElement('afterend', el);
    }

    el.disabled = adopted;
    el.style.opacity = adopted ? '0.6' : '1';
    el.style.cursor = adopted ? 'default' : 'pointer';
    el.textContent = adopted
      ? '✓ Using actual spend ' + fmtMoney(actual.annual) + '/yr from Expense Tracker'
      : 'Adopt actual spend: ' + fmtMoney(actual.annual) + '/yr (' + actual.monthsOfData + '-mo avg from Expense Tracker)';
  }

  // ---------- household banner ----------
  function renderHouseholdBanner() {
    var WS = window.WealthSuite;
    if (!WS || !WS.renderHouseholdBanner) return;
    WS.renderHouseholdBanner({
      anchor: '.hdr-l p',
      fields: ['portfolio', 'expenses', 'income', 'contributions', 'ages'],
    });
  }

  // ---------- bootstrap ----------
  function init() {
    seedProjections();
    wireSlider();
    renderHouseholdBanner();
    renderAdoptSpendButton();
    store.subscribe('', renderHouseholdBanner);
    store.subscribe('expenses', renderAdoptSpendButton);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.WealthSuite._retirementAdapter = { seedProjections, renderHouseholdBanner };
})();
