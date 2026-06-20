/* =============================================================
 * Wealth Suite — Portfolio Review adapter (Phase 2 step 4 / Phase 3)
 *
 * Phase 2:
 *   1. Parses the total-portfolio number out of the header on load
 *      and pushes it into suite.portfolio.totalValue.
 *   2. Parses the "Current allocation" bars into
 *      suite.portfolio.allocations (decimal fractions).
 *   3. Injects a "Wealth Suite household" subtitle into the header
 *      that surfaces income / contributions / ages from the store.
 *
 * Phase 3 additions:
 *   4. Reads retirement.plan.{targetRetireAge, annualExpenses,
 *      growthAssumption} and household ages from the store and
 *      derives portAtRetire (compound growth) and bufferNeeded
 *      (3 × inflation-adjusted annual spend).
 *   5. Scales the "Target $" column of the Target Allocation table
 *      to reflect the projected portfolio at retirement rather than
 *      the hardcoded $6.5M baseline, and updates the card subtitle.
 *   6. Updates the "Buffer readiness" tile denominator with the
 *      store-derived buffer target.
 *   7. Expands the household banner to surface years-to-retirement
 *      and annual spending alongside income and ages.
 *
 * Only writes to the store when the parsed value actually changes.
 * ============================================================= */
(function () {
  'use strict';

  const store = window.WealthSuite && window.WealthSuite.store;
  if (!store) {
    console.warn('[portfolio-adapter] WealthSuite.store missing — adapter inactive');
    return;
  }

  const EDITED_BY = 'portfolio';
  const INFLATION  = 0.035;
  const GROWTH     = 0.07;
  // The Target Allocation table was built assuming this retirement portfolio.
  const BASELINE_PORT = 6500000;

  // ---------- helpers ----------
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

  function parseCurrentAllocations() {
    const allCards = document.querySelectorAll('.card');
    let currentColumn = null;
    allCards.forEach((card) => {
      const heading = card.querySelector('.ct');
      if (heading && /current vs\.?\s*target allocation/i.test(heading.textContent)) {
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
      const pctEl   = bw.querySelector('.bar-h span:last-child');
      if (!labelEl || !pctEl) return;
      const label = labelEl.textContent.trim().toLowerCase();
      const pct   = parseFloat(pctEl.textContent);
      if (!Number.isFinite(pct)) return;
      const key = label
        .replace(/[^a-z0-9 ]/g, '')
        .split(/\s+/)
        .map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
      out[key] = +(pct / 100).toFixed(4);
    });
    return Object.keys(out).length ? out : null;
  }

  // ---------- retirement-plan seeding ----------
  function seedFromStore() {
    const state = store.export();
    if (!state || !state.meta || state.meta.lastUpdated == null) return;

    const currentPortfolio = state.portfolio && state.portfolio.totalValue;
    const retireAge        = state.retirement && state.retirement.plan && state.retirement.plan.targetRetireAge;
    const annualExpenses   = state.retirement && state.retirement.plan && state.retirement.plan.annualExpenses;
    const growthAssumption = state.retirement && state.retirement.plan && state.retirement.plan.growthAssumption;

    const spouses = (state.household && state.household.spouses) || [];
    const rawAges = spouses
      .map((s) => (s && s.age != null && s.age !== '') ? Number(s.age) : NaN)
      .filter((n) => !isNaN(n) && n > 0);
    const currentAge = rawAges.length > 0 ? Math.min(...rawAges) : null;

    const hasPortfolio = currentPortfolio && currentPortfolio > 0;
    const hasExpenses  = annualExpenses && annualExpenses > 0;
    if (!hasPortfolio && !hasExpenses) return;

    const growthRate    = (growthAssumption && growthAssumption > 0) ? growthAssumption : GROWTH;
    const retireAgeVal  = (retireAge && retireAge > 0) ? retireAge : 55;
    const curAgeVal     = currentAge || 51;
    const yearsToRetire = Math.max(0, retireAgeVal - curAgeVal);

    const portAtRetire  = hasPortfolio
      ? currentPortfolio * Math.pow(1 + growthRate, yearsToRetire)
      : null;
    const bufferNeeded  = hasExpenses
      ? annualExpenses * Math.pow(1 + INFLATION, yearsToRetire) * 3
      : null;

    // --- Scale "Target $" column in the Target Allocation table ---
    if (portAtRetire) {
      const scale = portAtRetire / BASELINE_PORT;
      const tables = document.querySelectorAll('.cmp-tbl');
      let targetTable = null;
      for (const t of tables) {
        const ths = Array.from(t.querySelectorAll('th')).map((h) => h.textContent.trim());
        if (ths.includes('Target %') && ths.includes('Target $')) {
          targetTable = t;
          break;
        }
      }
      if (targetTable) {
        const rows = targetTable.querySelectorAll('tbody tr');
        rows.forEach((row) => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 3) return;
          const pct = parseFloat(cells[1].textContent);
          if (!isFinite(pct) || pct <= 0) return;
          const dollars = portAtRetire * pct / 100;
          cells[2].textContent = fmtK(dollars);
          cells[2].style.color = 'var(--cyan)';
        });

        const card = targetTable.closest('.card');
        if (card) {
          const cs = card.querySelector('.cs');
          if (cs) {
            cs.textContent =
              `~${fmtM(portAtRetire)} projected portfolio at retirement (age ${retireAgeVal}). ` +
              `Based on ${fmtM(currentPortfolio)} today growing at ${(growthRate * 100).toFixed(0)}%/yr over ${yearsToRetire} years.`;
          }
        }
      }
    }

    // --- Update "Buffer readiness" tile denominator ---
    if (bufferNeeded) {
      for (const el of document.querySelectorAll('.sc')) {
        const l = el.querySelector('.sc-l');
        if (l && l.textContent.trim() === 'Buffer readiness') {
          const v = el.querySelector('.sc-v');
          if (v) {
            // Preserve the current buffer amount (the numerator, e.g. $322k)
            const parts = v.textContent.split('/');
            const numerator = parts[0] ? parts[0].trim() : '$322k';
            v.textContent = `${numerator}/${fmtK(bufferNeeded)}`;
          }
          break;
        }
      }
    }
  }

  // ---------- household banner ----------
  function renderHouseholdBanner() {
    var WS = window.WealthSuite;
    if (!WS || !WS.renderHouseholdBanner) return;
    WS.renderHouseholdBanner({
      anchor: '.hdr p',
      fields: ['income', 'expenses', 'contributions', 'ages', 'yearsToRetire'],
    });
  }

  // ---------- reflect store value into the page header/stat ----------
  // The page ships with a hardcoded "$1,250,000 · 48 holdings" header. When the
  // store holds a real portfolio value (from the Tracker, a CSV import, or the
  // dashboard quick-entry), surface that here so Review shows the live number
  // instead of the static placeholder.
  function reflectStoreTotal() {
    const v = Number(store.get('portfolio.totalValue'));
    if (!(v > 0)) return;
    const holdings = store.get('portfolio.holdings');
    const count = Array.isArray(holdings) ? holdings.length : null;

    const hdr = document.querySelector('.hdr p');
    if (hdr) {
      let t = hdr.textContent.replace(/\$[\d,]+(?:\.\d+)?/, usd0.format(v));
      if (count != null) t = t.replace(/\d[\d,]*\s+holdings/, count + ' holding' + (count === 1 ? '' : 's'));
      hdr.textContent = t;
    }
    for (const el of document.querySelectorAll('.sc')) {
      const l = el.querySelector('.sc-l');
      if (l && l.textContent.trim() === 'Total portfolio') {
        const sv = el.querySelector('.sc-v');
        if (sv) sv.textContent = fmtM(v);
        break;
      }
    }
  }

  // ---------- bootstrap ----------
  function init() {
    // The hardcoded header is a one-time SEED only — never overwrite a real
    // value already in the store (Tracker / import / quick-entry). Otherwise
    // visiting Review would clobber it back to the static $1.25M placeholder.
    const existingTotal = store.get('portfolio.totalValue');
    if (existingTotal == null || existingTotal === 0) {
      setIfChanged('portfolio.totalValue', parseTotalFromHeader());
    }
    const existingAllocs = store.get('portfolio.allocations');
    if (!existingAllocs || Object.keys(existingAllocs).length === 0) {
      setObjectIfChanged('portfolio.allocations', parseCurrentAllocations());
    }

    reflectStoreTotal();
    seedFromStore();
    renderHouseholdBanner();
    store.subscribe('', function () { reflectStoreTotal(); renderHouseholdBanner(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.WealthSuite._portfolioAdapter = {
    parseTotal: parseTotalFromHeader,
    parseAllocations: parseCurrentAllocations,
    seedFromStore,
    rerender: renderHouseholdBanner,
  };
})();
