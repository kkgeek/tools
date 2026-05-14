/* =============================================================
 * Wealth Suite — Tax Estimator adapter (Phase 2 step 2)
 *
 * Bridges Tax Estimator's localStorage key `taxSuiteInputs_v2` with
 * the suite store at window.WealthSuite.store. The Tax Estimator
 * itself is untouched — its React state and persistence keep working
 * standalone if this adapter never loads.
 *
 * Direction & policy:
 *   tax → suite : on every Tax Estimator save (via a setItem patch,
 *                 debounced). Tax inputs are authoritative for
 *                 household/income/contributions/deductions.
 *   suite → tax : only on adapter load, and only if the suite store
 *                 was last edited by another source (e.g. JSON import,
 *                 a cross-tab edit). We write taxSuiteInputs_v2 before
 *                 React reads it, so React mounts with seeded values.
 *
 * Lossy aggregations (documented so future me doesn't forget):
 *   - Tax tracks iraTrad + iraRoth per spouse; suite stores a single
 *     `ira.{s1,s2}` total. Reverse-seeding lands the total in iraTrad
 *     with iraRoth=0 — refine later if Retirement Planner needs both.
 *   - Tax tracks per-spouse HSA; suite stores a single family-level
 *     `hsa`. We sum on the way to suite, assign full amount to s1 on
 *     the way back.
 *
 * Echo suppression:
 *   React's useEffect writes taxSuiteInputs_v2 on mount with whatever
 *   we just seeded. To avoid clobbering meta.lastEditedBy on the
 *   echo, we record the last raw value we mirrored from/seeded to
 *   and skip on byte-equal repeats.
 * ============================================================= */
(function () {
  'use strict';

  const TAX_KEY = 'taxSuiteInputs_v2';
  const EDITED_BY = 'tax';
  const DEBOUNCE_MS = 250;

  const store = window.WealthSuite && window.WealthSuite.store;
  if (!store) {
    console.warn('[tax-adapter] WealthSuite.store missing — adapter inactive');
    return;
  }

  // ---------- helpers ----------
  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function parseTax(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  // ---------- tax → suite ----------
  function buildSuitePatch(t) {
    if (!t || typeof t !== 'object') return null;
    const s1 = t.s1 || {};
    const s2 = t.s2 || {};
    return {
      preferences: { taxYear: t.year != null ? String(t.year) : null },
      household: {
        filingStatus: t.filingStatus === 'single' ? 'single' : 'mfj',
        spouseAges: [
          s1.age === '' || s1.age == null ? null : num(s1.age),
          s2.age === '' || s2.age == null ? null : num(s2.age),
        ],
      },
      income: {
        salary:   { s1: num(s1.salary), s2: num(s2.salary) },
        bonus:    { s1: num(s1.bonus),  s2: num(s2.bonus)  },
        rsuVests: { s1: num(s1.rsu),    s2: num(s2.rsu)    },
        capitalGains: { shortTerm: num(t.stcg), longTerm: num(t.ltcg) },
      },
      retirement: {
        contributions: {
          traditional401k: { s1: num(s1.k401Trad),     s2: num(s2.k401Trad)     },
          roth401k:        { s1: num(s1.k401Roth),     s2: num(s2.k401Roth)     },
          afterTax401k:    { s1: num(s1.k401AfterTax), s2: num(s2.k401AfterTax) },
          catchup:         { s1: num(s1.k401Catchup),  s2: num(s2.k401Catchup)  },
          ira: {
            s1: num(s1.iraTrad) + num(s1.iraRoth),
            s2: num(s2.iraTrad) + num(s2.iraRoth),
          },
          hsa: num(s1.hsa) + num(s2.hsa),
        },
      },
      deductions: {
        method:     t.deductionType === 'itemized' ? 'itemized' : 'standard',
        mortgage:   num(t.mortgage),
        salt:       num(t.salt),
        charitable: num(t.charitable),
      },
    };
  }

  function applyPatchToSuite(patch) {
    if (!patch) return;
    const opts = { editedBy: EDITED_BY };

    store.set('preferences.taxYear', patch.preferences.taxYear, opts);
    store.set('household.filingStatus', patch.household.filingStatus, opts);

    // Update ages without disturbing names (which Tax Estimator doesn't know).
    const curSpouses = store.get('household.spouses') || [];
    store.set('household.spouses', [
      { name: curSpouses[0]?.name || '', age: patch.household.spouseAges[0] },
      { name: curSpouses[1]?.name || '', age: patch.household.spouseAges[1] },
    ], opts);

    store.set('income.salary',        patch.income.salary,        opts);
    store.set('income.bonus',         patch.income.bonus,         opts);
    store.set('income.rsuVests',      patch.income.rsuVests,      opts);
    store.set('income.capitalGains',  patch.income.capitalGains,  opts);

    // Replace the entire contributions subtree — every field in it is
    // Tax-Estimator-authoritative. Preserves retirement.balances and
    // retirement.plan, which the Retirement Planner owns.
    store.set('retirement.contributions', patch.retirement.contributions, opts);

    // Merge over deductions (keep any fields we don't track).
    const curDed = store.get('deductions') || {};
    store.set('deductions', { ...curDed, ...patch.deductions }, opts);
  }

  // ---------- suite → tax ----------
  function buildTaxFromSuite(state) {
    const sp  = state.household?.spouses || [{}, {}];
    const inc = state.income || {};
    const ret = state.retirement?.contributions || {};
    const ded = state.deductions || {};

    function ageOf(person) {
      return person && person.age != null && person.age !== '' ? person.age : '';
    }

    // Field order mirrors DFLT_INPUTS in TaxEstimatorV5.html so the
    // serialized JSON byte-matches what React's useEffect would write.
    return {
      year: state.preferences?.taxYear || '2026',
      filingStatus: state.household?.filingStatus === 'single' ? 'single' : 'mfj',
      s1: {
        age: ageOf(sp[0]),
        salary: num(inc.salary?.s1),
        bonus:  num(inc.bonus?.s1),
        rsu:    num(inc.rsuVests?.s1),
        k401Trad:     num(ret.traditional401k?.s1),
        k401Roth:     num(ret.roth401k?.s1),
        k401Catchup:  num(ret.catchup?.s1),
        k401AfterTax: num(ret.afterTax401k?.s1),
        iraTrad: num(ret.ira?.s1),
        iraRoth: 0,
        hsa: num(ret.hsa),
        employerMatch: 0,
      },
      s2: {
        age: ageOf(sp[1]),
        salary: num(inc.salary?.s2),
        bonus:  num(inc.bonus?.s2),
        rsu:    num(inc.rsuVests?.s2),
        k401Trad:     num(ret.traditional401k?.s2),
        k401Roth:     num(ret.roth401k?.s2),
        k401Catchup:  num(ret.catchup?.s2),
        k401AfterTax: num(ret.afterTax401k?.s2),
        iraTrad: num(ret.ira?.s2),
        iraRoth: 0,
        hsa: 0,
        employerMatch: 0,
      },
      stcg: num(inc.capitalGains?.shortTerm),
      ltcg: num(inc.capitalGains?.longTerm),
      deductionType: ded.method === 'itemized' ? 'itemized' : 'standard',
      mortgage:   num(ded.mortgage),
      salt:       num(ded.salt),
      charitable: num(ded.charitable),
      otherItemized: 0,
    };
  }

  // ---------- bootstrap ----------
  let lastMirroredRaw = null;

  function mirrorIfChanged(rawValue) {
    if (rawValue === lastMirroredRaw) return;
    lastMirroredRaw = rawValue;
    const parsed = parseTax(rawValue);
    if (!parsed) return;
    try { applyPatchToSuite(buildSuitePatch(parsed)); }
    catch (e) { console.error('[tax-adapter] mirror failed', e); }
  }

  const suiteState = store.export();
  const suiteHasData = suiteState && suiteState.meta && suiteState.meta.lastUpdated != null;
  const suiteLastEditor = suiteState && suiteState.meta && suiteState.meta.lastEditedBy;
  const taxRaw = localStorage.getItem(TAX_KEY);

  // Decision: who's authoritative right now?
  //  - Suite was last edited by something that isn't tax/null → seed tax from suite.
  //  - Otherwise, mirror whatever the tax key currently has into suite (covers
  //    first-time migration and normal startups).
  if (suiteHasData && suiteLastEditor && suiteLastEditor !== EDITED_BY) {
    try {
      const seeded = JSON.stringify(buildTaxFromSuite(suiteState));
      lastMirroredRaw = seeded;
      localStorage.setItem(TAX_KEY, seeded);
    } catch (e) {
      console.error('[tax-adapter] seed-from-suite failed', e);
    }
  } else if (taxRaw) {
    lastMirroredRaw = taxRaw;
    try { applyPatchToSuite(buildSuitePatch(parseTax(taxRaw))); }
    catch (e) { console.error('[tax-adapter] initial mirror failed', e); }
  }

  // ---------- continuous mirror via setItem patch ----------
  // Debounced because Tax Estimator writes on every keystroke.
  let pending = null;
  function scheduleMirror(rawValue) {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = null;
      mirrorIfChanged(rawValue);
    }, DEBOUNCE_MS);
  }

  const origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    origSetItem.apply(this, arguments);
    if (this === window.localStorage && key === TAX_KEY) {
      scheduleMirror(value);
    }
  };

  // ---------- Stale-data indicator ----------
  // If another tool (or another tab) writes to the suite store while
  // Tax Estimator is open, surface a "Updated in X — Reload" chip so
  // the user knows their on-screen React state is now out of sync.
  // Reloading triggers the seed-from-suite path on next adapter load.
  const TOOL_LABEL = {
    tax: 'Tax Estimator',
    retirement: 'Retirement Planner',
    portfolio: 'Portfolio Review',
    asset: 'Asset Calculator',
    golden: 'Golden φ',
    dashboard: 'Dashboard',
    import: 'JSON import',
    reset: 'Reset',
  };
  const initialEditor = (suiteState && suiteState.meta && suiteState.meta.lastEditedBy) || EDITED_BY;
  let staleShown = false;

  function showStaleBanner(editor) {
    if (staleShown) return;
    staleShown = true;
    function attach() {
      const host = document.querySelector('header.bg-white') || document.body;
      if (!host) return;
      const bar = document.createElement('div');
      bar.id = 'suite-tax-stale';
      bar.style.cssText =
        'display:flex;align-items:center;gap:12px;flex-wrap:wrap;' +
        'padding:8px 16px;background:#FEF3C7;color:#7C2D12;' +
        'font-size:13px;border-bottom:1px solid #F59E0B;';
      bar.innerHTML =
        `<span><strong>Wealth Suite:</strong> data updated in <strong>${TOOL_LABEL[editor] || editor}</strong>. ` +
        'Your tax inputs may be out of date — reload to pull the latest.</span>';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Reload';
      btn.style.cssText =
        'padding:5px 14px;border-radius:6px;border:1px solid #7C2D12;' +
        'background:transparent;color:#7C2D12;font-weight:600;font-size:12px;cursor:pointer;';
      btn.addEventListener('click', () => location.reload());
      bar.appendChild(btn);
      // Drop it directly into the body so it sits below our fixed topbar.
      // 64px = topbar height (set in suite.css via --suite-topbar-height).
      bar.style.position = 'fixed';
      bar.style.top = '64px';
      bar.style.left = '0';
      bar.style.right = '0';
      bar.style.zIndex = '999';
      document.body.appendChild(bar);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attach);
    } else {
      attach();
    }
  }

  store.subscribe('', (state) => {
    const editor = state && state.meta && state.meta.lastEditedBy;
    if (!editor || editor === EDITED_BY) return;
    if (editor === initialEditor) return; // same source as when we loaded
    showStaleBanner(editor);
  });

  // Expose for debugging only — not a public contract.
  window.WealthSuite._taxAdapter = {
    mirror: () => mirrorIfChanged(localStorage.getItem(TAX_KEY)),
    reseed: () => {
      const s = JSON.stringify(buildTaxFromSuite(store.export()));
      lastMirroredRaw = s;
      localStorage.setItem(TAX_KEY, s);
    },
  };
})();
