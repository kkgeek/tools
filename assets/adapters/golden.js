/* =============================================================
 * Wealth Suite — Golden φ Portfolio adapter (Phase 3)
 *
 * The Golden φ Dashboard is an educational reference tool — its
 * allocation percentages are mathematically fixed (φ-derived) and
 * its three sliders let the user model scenarios. The adapter:
 *
 *   1. Seeds the "Initial investment" slider (sI) from
 *      suite.portfolio.totalValue on load, so the user's actual
 *      portfolio value is the default scenario input.
 *   2. Derives a starting withdrawal rate for slider sW from
 *      suite.retirement.plan.annualExpenses / portfolio.totalValue
 *      when both are present in the store.
 *   3. Injects a one-line "Wealth Suite household" banner below
 *      the φ=61.8% formula strip, showing portfolio value, annual
 *      expenses, and spouse ages from the store.
 *
 * This adapter is read-only relative to the suite store — the φ
 * allocations are a fixed model, not user-entered data, so there
 * is nothing meaningful to write back. Only portfolio.totalValue
 * and retirement.plan.annualExpenses are consumed.
 * ============================================================= */
(function () {
  'use strict';

  const store = window.WealthSuite && window.WealthSuite.store;
  if (!store) {
    console.warn('[golden-adapter] WealthSuite.store missing — adapter inactive');
    return;
  }

  // ---------- formatters ----------
  const usd0 = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  });
  function fmtMoney(n) {
    if (n == null || !Number.isFinite(Number(n))) return null;
    return usd0.format(Number(n));
  }

  // ---------- slider seeding ----------
  function clampToSlider(el, rawValue) {
    const min  = Number(el.min)  || 0;
    const max  = Number(el.max)  || 100;
    const step = Number(el.step) || 1;
    const clamped = Math.max(min, Math.min(max, rawValue));
    return String(Math.round(clamped / step) * step);
  }

  function seedSliders() {
    const state = store.export();
    if (!state || !state.meta || state.meta.lastUpdated == null) return;

    let seeded = false;
    const totalValue = state.portfolio && state.portfolio.totalValue;

    if (totalValue && totalValue > 0) {
      const sI = document.getElementById('sI');
      if (sI) {
        sI.value = clampToSlider(sI, totalValue);
        seeded = true;
      }
    }

    const annualExpenses =
      state.retirement && state.retirement.plan && state.retirement.plan.annualExpenses;
    const baseValue = totalValue && totalValue > 0 ? totalValue : null;
    if (annualExpenses && baseValue) {
      const wrRaw = (annualExpenses / baseValue) * 100;
      const sW = document.getElementById('sW');
      if (sW) {
        sW.value = clampToSlider(sW, wrRaw);
        seeded = true;
      }
    }

    if (seeded && typeof upd === 'function') {
      try { upd(); } catch (e) { /* ignore */ }
    }
  }

  // ---------- household banner ----------
  function renderHouseholdBanner() {
    const state = store.export();
    if (!state || !state.meta || state.meta.lastUpdated == null) return;

    const portVal  = state.portfolio && state.portfolio.totalValue;
    const expenses =
      state.retirement && state.retirement.plan && state.retirement.plan.annualExpenses;
    const ages = (state.household && state.household.spouses || [])
      .map((s) => (s && s.age != null && s.age !== '') ? `${s.age}` : null)
      .filter(Boolean);

    const parts = [];
    if (portVal)   parts.push(`portfolio ${fmtMoney(portVal)}`);
    if (expenses)  parts.push(`expenses ${fmtMoney(expenses)}/yr`);
    if (ages.length) parts.push(`ages ${ages.join(' & ')}`);
    if (!parts.length) return;

    let banner = document.getElementById('suite-household-banner');
    if (!banner) {
      const codeEl = Array.from(document.querySelectorAll('code'))
        .find((el) => el.textContent.includes('1/φ'));
      if (!codeEl) return;
      banner = document.createElement('p');
      banner.id = 'suite-household-banner';
      banner.style.cssText =
        'margin-top:4px;font-size:11px;letter-spacing:.04em;opacity:.7;text-transform:uppercase';
      codeEl.parentNode.insertBefore(banner, codeEl.nextSibling);
    }
    banner.textContent = 'Wealth Suite household · ' + parts.join(' · ');
  }

  // ---------- bootstrap ----------
  function init() {
    seedSliders();
    renderHouseholdBanner();
    store.subscribe('', renderHouseholdBanner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.WealthSuite._goldenAdapter = { seedSliders, renderHouseholdBanner };
})();
