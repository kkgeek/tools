/* =============================================================
 * Wealth Suite — Expense Tracker adapter (Phase 9)
 *
 * Lightweight adapter (tracker.js pattern): the React component
 * reads/writes `expenses` on the suite store directly and falls
 * back to its own localStorage key when the store is absent.
 * migrate() in suite-state.js guarantees the expenses node exists
 * (v2 → v3), including for imported pre-v3 JSON exports, so there
 * is nothing to seed here — this file exists to keep the one-
 * adapter-per-tool convention and as the future hook point for
 * cross-tool integrations (e.g. budget alerts on the dashboard).
 * ============================================================= */
(function () {
  'use strict';

  const store = window.WealthSuite && window.WealthSuite.store;
  if (!store) return;

  const e = store.get('expenses');
  if (!e || !Array.isArray(e.transactions)) {
    console.warn('[expenses adapter] store present but expenses node missing — component will use in-memory defaults');
  }
})();
