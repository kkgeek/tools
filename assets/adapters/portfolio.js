/* =============================================================
 * Wealth Suite — Portfolio Review adapter (Phase 2 step 4)
 *
 * The Portfolio Review page is a static report — its $4.75M total
 * and allocation percentages are baked into the HTML, not entered
 * by the user. The adapter:
 *
 *   1. Parses the total-portfolio number out of the header on load
 *      and pushes it into suite.portfolio.totalValue, so the
 *      dashboard "Portfolio value" tile and the Asset Calculator
 *      both have something real to work with.
 *   2. Parses the "Current allocation" bars into
 *      suite.portfolio.allocations (decimal fractions).
 *   3. Injects a "Wealth Suite household" subtitle into the header
 *      that surfaces income / contributions / ages from the store.
 *
 * Only writes when the parsed value actually changes — keeps
 * meta.lastEditedBy from flipping to 'portfolio' on every reload.
 * ============================================================= */
(function () {
  'use strict';

  const store = window.WealthSuite && window.WealthSuite.store;
  if (!store) {
    console.warn('[portfolio-adapter] WealthSuite.store missing — adapter inactive');
    return;
  }

  const EDITED_BY = 'portfolio';

  // ---------- helpers ----------
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
  function parseMoney(text) {
    if (!text) return null;
    const cleaned = String(text).replace(/[^\d.]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function setIfChanged(path, value) {
    if (value == null) return;
    const current = store.get(path);
    if (current === value) return;
    store.set(path, value, { editedBy: EDITED_BY });
  }
  function setObjectIfChanged(path, value) {
    if (value == null) return;
    const current = store.get(path);
    if (JSON.stringify(current) === JSON.stringify(value)) return;
    store.set(path, value, { editedBy: EDITED_BY });
  }

  // ---------- parsing ----------
  function parseTotalFromHeader() {
    const hdr = document.querySelector('.hdr p') || document.querySelector('.hdr');
    if (!hdr) return null;
    const m = hdr.textContent.match(/\$[\d,]+(?:\.\d+)?/);
    return m ? parseMoney(m[0]) : null;
  }

  // The "Current allocation" panel sits in the first column of the
  // grid inside the "Current vs. target allocation" card. Each row
  // is a .bar-w with a percentage in its header. We take the first
  // 5 (or however many) rows of the first column.
  function parseCurrentAllocations() {
    const allCards = document.querySelectorAll('.card');
    let currentColumn = null;
    allCards.forEach((card) => {
      const heading = card.querySelector('.ct');
      if (heading && /current vs\.?\s*target allocation/i.test(heading.textContent)) {
        // Grid: column 1 = current, column 2 = target. Pick the col whose
        // section header reads "current allocation".
        const cols = card.querySelectorAll(':scope > div > div');
        cols.forEach((col) => {
          const subhdr = col.querySelector('div');
          if (subhdr && /current allocation/i.test(subhdr.textContent)) {
            currentColumn = col;
          }
        });
      }
    });
    if (!currentColumn) return null;

    const out = {};
    currentColumn.querySelectorAll('.bar-w').forEach((bw) => {
      const labelEl = bw.querySelector('.bar-h span:first-child');
      const pctEl = bw.querySelector('.bar-h span:last-child');
      if (!labelEl || !pctEl) return;
      const label = labelEl.textContent.trim().toLowerCase();
      const pct = parseFloat(pctEl.textContent);
      if (!Number.isFinite(pct)) return;
      // Camel-case the label: "US stocks" -> "usStocks", "Intl stocks" -> "intlStocks"
      const key = label
        .replace(/[^a-z0-9 ]/g, '')
        .split(/\s+/)
        .map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
      out[key] = +(pct / 100).toFixed(4);
    });
    return Object.keys(out).length ? out : null;
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
      .map((s) => (s && s.age != null && s.age !== '') ? `${s.age}` : null)
      .filter(Boolean);

    const parts = [];
    if (totalIncome) parts.push(`income ${fmtMoney(totalIncome)}`);
    if (totalContrib) parts.push(`contributions ${fmtMoney(totalContrib)}/yr`);
    if (ages.length) parts.push(`ages ${ages.join(' & ')}`);
    if (!parts.length) return;

    let banner = document.getElementById('suite-household-banner');
    if (!banner) {
      const headerSub = document.querySelector('.hdr p');
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
    const total = parseTotalFromHeader();
    setIfChanged('portfolio.totalValue', total);

    const allocs = parseCurrentAllocations();
    setObjectIfChanged('portfolio.allocations', allocs);

    renderHouseholdBanner();
    store.subscribe('', renderHouseholdBanner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.WealthSuite._portfolioAdapter = {
    parseTotal: parseTotalFromHeader,
    parseAllocations: parseCurrentAllocations,
    rerender: renderHouseholdBanner,
  };
})();
