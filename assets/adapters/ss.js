/* =============================================================
 * Wealth Suite — Social Security Estimator adapter (Phase 5)
 *
 * Read-only seed: pulls spouse ages and names from the suite store
 * and directly updates the DOM inputs before the page initialises.
 * ============================================================= */
(function () {
  'use strict';

  var store = window.WealthSuite && window.WealthSuite.store;
  if (!store) return;

  function seed() {
    var s = store.export();
    if (!s || !s.meta || s.meta.lastUpdated == null) return;

    var spouses = (s.household && s.household.spouses) || [];
    var ages = spouses.map(function(sp) {
      return sp && sp.age != null && sp.age !== '' ? Number(sp.age) : NaN;
    }).filter(function(a) { return !isNaN(a) && a > 0; });

    if (ages.length > 0) {
      var el = document.getElementById('curAge');
      if (el) { el.value = Math.min.apply(null, ages); }
    }

    // Trigger recalc if the page function is ready
    if (typeof recalc === 'function') recalc();
  }

  var delay = document.readyState === 'loading' ? 400 : 250;
  setTimeout(seed, delay);
})();
