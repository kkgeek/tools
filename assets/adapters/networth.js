/* =============================================================
 * Wealth Suite — Net Worth Tracker adapter (Phase 5)
 *
 * The net_worth.html page reads/writes the store directly via its
 * own polling init. This adapter's only job is to ensure the
 * liabilities and assets schema nodes exist so the tool's first
 * store.export() always finds them.
 * ============================================================= */
(function () {
  'use strict';

  var store = window.WealthSuite && window.WealthSuite.store;
  if (!store) return;

  var s = store.export();
  if (!s.liabilities) {
    store.set('liabilities', { items: [], total: null }, { editedBy: 'networth' });
  }
  if (!s.assets) {
    store.set('assets', { realEstate: null, vehicles: null, other: null }, { editedBy: 'networth' });
  }
})();
