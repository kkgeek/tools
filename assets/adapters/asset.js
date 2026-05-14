/* =============================================================
 * Wealth Suite — Asset Calculator adapter (Phase 2 step 4)
 *
 * TaxAssetCalcv4 is a what-if capital-gains + asset-allocation
 * calculator with React state and no persistence. Auto-filling
 * would defeat the "scenario" use case, so the adapter is opt-in:
 * it injects an "Apply Wealth Suite data" button at the top of
 * each form. Clicking populates the React-controlled inputs from
 * the suite store (income, capital gains, filing status, year,
 * portfolio total).
 *
 * No write direction — this tool is for scenario exploration, not
 * an authoritative source.
 *
 * React-controlled inputs need the native value setter + an
 * `input`/`change` event so React's onChange handlers fire. Radios
 * are toggled with .click().
 * ============================================================= */
(function () {
  'use strict';

  const store = window.WealthSuite && window.WealthSuite.store;
  if (!store) {
    console.warn('[asset-adapter] WealthSuite.store missing — adapter inactive');
    return;
  }

  // ---------- React-friendly DOM writers ----------
  function setReactInputValue(el, value) {
    if (!el) return;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function setReactSelectValue(el, value) {
    if (!el) return;
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clickRadio(name, value) {
    const r = document.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`);
    if (r) r.click();
  }

  // ---------- Suite → form mapping ----------
  function pullSuiteData() {
    const state = store.export() || {};
    const inc = state.income || {};
    const sum = (o) => (Number(o?.s1) || 0) + (Number(o?.s2) || 0);
    return {
      taxYear: state.preferences?.taxYear || null,
      filingStatus: state.household?.filingStatus === 'single' ? 'single' : 'married',
      ordinaryIncome: sum(inc.salary) + sum(inc.bonus) + sum(inc.rsuVests),
      shortTermGains: Number(inc.capitalGains?.shortTerm) || 0,
      longTermGains:  Number(inc.capitalGains?.longTerm) || 0,
      itemized: state.deductions?.method === 'itemized'
        ? (Number(state.deductions.mortgage) || 0)
          + (Number(state.deductions.salt) || 0)
          + (Number(state.deductions.charitable) || 0)
        : 0,
      portfolioTotal: Number(state.portfolio?.totalValue) || 0,
    };
  }

  function applyToCapitalGains() {
    const d = pullSuiteData();
    const yearSelect = document.getElementById('taxYear');
    if (yearSelect && d.taxYear) {
      // The Capital Gains Calculator only supports 2024 & 2025 — clamp.
      const supported = Array.from(yearSelect.options).map((o) => o.value);
      const wanted = supported.includes(String(d.taxYear))
        ? String(d.taxYear)
        : supported[supported.length - 1];
      setReactSelectValue(yearSelect, wanted);
    }
    clickRadio('filingStatus', d.filingStatus);
    if (d.ordinaryIncome) setReactInputValue(document.getElementById('ordinaryIncome'), String(d.ordinaryIncome));
    setReactInputValue(document.getElementById('shortTermGains'), String(d.shortTermGains || ''));
    setReactInputValue(document.getElementById('longTermGains'),  String(d.longTermGains || ''));
    if (d.itemized) setReactInputValue(document.getElementById('itemizedDeductions'), String(d.itemized));
  }

  function applyToAllocation() {
    const d = pullSuiteData();
    if (d.portfolioTotal) {
      setReactInputValue(document.getElementById('totalAmount'), String(d.portfolioTotal));
    }
  }

  // ---------- Banner / button injection ----------
  const BANNER_CLASS = 'suite-asset-banner';

  function bannerSummary() {
    const d = pullSuiteData();
    const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    const parts = [];
    if (d.ordinaryIncome) parts.push(`income ${usd.format(d.ordinaryIncome)}`);
    if (d.shortTermGains || d.longTermGains) {
      parts.push(`gains ${usd.format(d.shortTermGains)} ST · ${usd.format(d.longTermGains)} LT`);
    }
    if (d.portfolioTotal) parts.push(`portfolio ${usd.format(d.portfolioTotal)}`);
    return parts;
  }

  function buildBanner(label, onApply) {
    const wrap = document.createElement('div');
    wrap.className = BANNER_CLASS;
    wrap.style.cssText =
      'display:flex;align-items:center;gap:12px;flex-wrap:wrap;' +
      'margin:0 0 16px;padding:10px 14px;border-radius:8px;' +
      'background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);' +
      'font-size:13px;color:#374151;';

    const text = document.createElement('span');
    text.style.flex = '1 1 auto';
    const parts = bannerSummary();
    text.innerHTML = parts.length
      ? `<strong style="color:#1F2937">Wealth Suite:</strong> ${parts.join(' · ')}`
      : '<strong style="color:#1F2937">Wealth Suite:</strong> no household data yet — open the Tax Estimator first';
    wrap.appendChild(text);

    if (parts.length) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `Apply to ${label}`;
      btn.style.cssText =
        'padding:6px 12px;border-radius:6px;border:none;cursor:pointer;' +
        'background:#4F46E5;color:#fff;font-weight:600;font-size:12px;';
      btn.addEventListener('click', () => {
        try { onApply(); } catch (e) { console.error('[asset-adapter] apply failed', e); }
      });
      wrap.appendChild(btn);
    }
    return wrap;
  }

  function injectBanners() {
    // Capital Gains Calculator: anchor under its <h1>.
    const cgHeading = Array.from(document.querySelectorAll('h1'))
      .find((h) => /capital gains tax calculator/i.test(h.textContent));
    if (cgHeading && !cgHeading.parentElement.querySelector(`.${BANNER_CLASS}[data-target="cg"]`)) {
      const banner = buildBanner('Capital Gains', applyToCapitalGains);
      banner.dataset.target = 'cg';
      cgHeading.parentElement.insertBefore(banner, cgHeading.nextSibling);
    }

    // Asset Allocation Calculator: anchor under its <h1>.
    const aaHeading = Array.from(document.querySelectorAll('h1'))
      .find((h) => /asset allocation/i.test(h.textContent));
    if (aaHeading && !aaHeading.parentElement.querySelector(`.${BANNER_CLASS}[data-target="aa"]`)) {
      const banner = buildBanner('Allocation', applyToAllocation);
      banner.dataset.target = 'aa';
      aaHeading.parentElement.insertBefore(banner, aaHeading.nextSibling);
    }
  }

  // ---------- Watch the DOM for view switches ----------
  // The App component toggles between <CapitalGainsTaxCalculator/> and
  // <AssetAllocationCalculator/>, so only one form is mounted at a time.
  // A MutationObserver re-injects the banner whenever React swaps the
  // subtree in. The observer fires on every React render — including
  // every keystroke — so we coalesce callbacks into one per animation
  // frame to keep the page responsive.
  function startObserver() {
    const root = document.getElementById('root') || document.body;
    injectBanners();
    injectStaleBanner(store.export());

    let injectPending = false;
    function scheduleInject() {
      if (injectPending) return;
      injectPending = true;
      requestAnimationFrame(() => {
        injectPending = false;
        injectBanners();
        // Re-anchor the stale banner if React just remounted the form.
        if (lastSeenStaleSnapshot) injectStaleBanner(store.export(), /*force*/ true);
      });
    }
    const obs = new MutationObserver(scheduleInject);
    obs.observe(root, { childList: true, subtree: true });

    // Update banner copy + check staleness on every store change.
    store.subscribe('', (state) => {
      document.querySelectorAll(`.${BANNER_CLASS}`).forEach((b) => b.remove());
      injectBanners();
      injectStaleBanner(state);
    });
  }

  // ---------- Stale-data indicator ----------
  // If anything other than this adapter writes to the store while the
  // user is on this page, surface a small "Updated in [tool] — refresh"
  // chip so they know their applied scenario is now stale.
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

  let initialEditedBy = null;
  let lastSeenStaleSnapshot = null;

  function injectStaleBanner(state, force) {
    const editor = state && state.meta && state.meta.lastEditedBy;
    if (!editor || editor === 'asset') return;
    if (initialEditedBy == null) {
      // First observation — adopt as baseline, no banner.
      initialEditedBy = editor;
      return;
    }
    if (editor === initialEditedBy && !force) return;
    lastSeenStaleSnapshot = editor;

    document.querySelectorAll('.suite-asset-stale').forEach((b) => b.remove());
    const targetForms = document.querySelectorAll(`.${BANNER_CLASS}`);
    targetForms.forEach((banner) => {
      const note = document.createElement('div');
      note.className = 'suite-asset-stale';
      note.style.cssText =
        'display:flex;align-items:center;gap:10px;flex-wrap:wrap;' +
        'margin:6px 0 0;padding:6px 10px;border-radius:6px;' +
        'background:rgba(217,119,6,0.10);border:1px solid rgba(217,119,6,0.30);' +
        'font-size:12px;color:#7C2D12;flex-basis:100%';
      note.innerHTML =
        `<span><strong>Heads up:</strong> data updated in ${TOOL_LABEL[editor] || editor}. Apply again to use the latest.</span>`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Reload';
      btn.style.cssText =
        'padding:4px 10px;border-radius:5px;border:1px solid #7C2D12;' +
        'background:transparent;color:#7C2D12;font-weight:600;font-size:11px;cursor:pointer;';
      btn.addEventListener('click', () => location.reload());
      note.appendChild(btn);
      banner.appendChild(note);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  window.WealthSuite._assetAdapter = {
    applyToCapitalGains,
    applyToAllocation,
    pullSuiteData,
  };
})();
