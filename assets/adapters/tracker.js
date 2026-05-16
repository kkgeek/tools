/* =============================================================
 * Wealth Suite — Portfolio Tracker adapter (Phase 4 P2)
 *
 * Lightweight adapter: the React component reads/writes the suite
 * store directly (portfolio.holdings, portfolio.totalValue,
 * portfolio.allocations). This adapter's only job is to confirm
 * the store is present before the component mounts, and to expose
 * window.__trackerSeed for future cross-module seeding if needed.
 * ============================================================= */
(function () {
  'use strict';

  const store = window.WealthSuite && window.WealthSuite.store;
  if (!store) return;

  // Ensure portfolio node exists so React's store.export() finds it cleanly.
  const s = store.export();
  if (!s.portfolio) {
    store.set('portfolio', { totalValue: null, allocations: {}, holdings: [] }, { editedBy: 'tracker' });
  } else if (!Array.isArray(s.portfolio.holdings)) {
    store.set('portfolio.holdings', [], { editedBy: 'tracker' });
  }
})();
