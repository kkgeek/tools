/* =============================================================
 * Wealth Suite — dashboard widgets
 *
 * Currently renders the "Snapshot" widget into #suite-snapshot.
 * Pulls from WealthSuite.store and subscribes for reactive updates.
 *
 * Phase 2 step 1: read-only, no tool integration yet. Tools will
 * land adapters in step 2+ that write into the store; this widget
 * will then surface that data without further changes.
 * ============================================================= */
(function () {
  'use strict';

  const store = window.WealthSuite && window.WealthSuite.store;
  if (!store) {
    console.warn('[dashboard] WealthSuite.store missing — did suite-state.js load?');
    return;
  }

  const mount = document.getElementById('suite-snapshot');
  if (!mount) return;

  // ---------- Formatters ----------
  const usd0 = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  function fmtMoney(n) {
    if (n == null || !Number.isFinite(Number(n))) return null;
    return usd0.format(Number(n));
  }

  function sumSpouse(obj) {
    if (!obj) return null;
    // Note: Number(null) === 0, so we must explicitly check for null/undefined
    // first — otherwise an empty {s1:null,s2:null} would sum to 0 and the
    // tile would render "$0" with the empty-state hint.
    const aOK = obj.s1 != null && Number.isFinite(Number(obj.s1));
    const bOK = obj.s2 != null && Number.isFinite(Number(obj.s2));
    if (!aOK && !bOK) return null;
    return (aOK ? Number(obj.s1) : 0) + (bOK ? Number(obj.s2) : 0);
  }

  function sumNumbers(...vals) {
    let total = 0;
    let any = false;
    for (const v of vals) {
      if (v == null) continue;
      const n = Number(v);
      if (Number.isFinite(n)) { total += n; any = true; }
    }
    return any ? total : null;
  }

  function relTime(ts) {
    if (!ts) return null;
    const diff = Date.now() - ts;
    const sec = Math.round(diff / 1000);
    if (sec < 5) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min} min ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    const day = Math.round(hr / 24);
    if (day < 30) return `${day} d ago`;
    return new Date(ts).toLocaleDateString();
  }

  // ---------- Scenarios ----------
  const SCENARIOS = [
    { id: 'retire-55', label: 'Retire at 55', retireAge: 55 },
    { id: 'retire-60', label: 'Retire at 60', retireAge: 60 },
    { id: 'retire-65', label: 'Retire at 65', retireAge: 65 },
  ];

  const TOOL_LABEL = {
    tax: 'Tax Estimator',
    retirement: 'Retirement Planner',
    portfolio: 'Portfolio Review',
    asset: 'Asset Calculator',
    golden: 'Golden φ',
    expenses: 'Expense Tracker',
    dashboard: 'Dashboard',
    import: 'JSON import',
    reset: 'Reset',
  };

  const STALE_DAYS = 30;

  // ---------- Tile builders ----------
  function tile({ label, value, hint, stale }) {
    const el = document.createElement('div');
    el.className = 'suite-snapshot__tile';
    el.innerHTML = `
      <div class="suite-snapshot__label">${label}</div>
      <div class="suite-snapshot__value${value ? '' : ' is-empty'}">${value || '—'}</div>
      ${hint ? `<div class="suite-snapshot__hint">${hint}</div>` : ''}
      ${stale ? `<div class="suite-snapshot__stale" title="Data not updated in over ${STALE_DAYS} days">⚠ stale</div>` : ''}
    `;
    return el;
  }

  function spouseNames(spouses) {
    if (!Array.isArray(spouses)) return null;
    const names = spouses.map((s) => (s && s.name) ? s.name.trim() : '').filter(Boolean);
    return names.length ? names.join(' & ') : null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ---------- Render ----------
  function isEmpty(state) {
    return !state || !state.meta || state.meta.lastUpdated == null;
  }

  function render(state) {
    mount.innerHTML = '';

    if (isEmpty(state)) {
      const empty = document.createElement('div');
      empty.className = 'suite-snapshot__empty';
      empty.innerHTML = `
        <div class="suite-snapshot__empty-title">No household data yet</div>
        <p class="suite-snapshot__empty-body">
          Open a tool below to start populating your snapshot. As tools
          gain adapters in upcoming releases, their inputs will appear
          here automatically — your data stays in this browser.
        </p>
      `;
      mount.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'suite-snapshot__grid';

    const isStale = state.meta?.lastUpdated
      ? (Date.now() - state.meta.lastUpdated) > STALE_DAYS * 86400000
      : false;

    // Household
    const filing = state.household?.filingStatus === 'single' ? 'Single' : 'Married, filing jointly';
    const namesLabel = spouseNames(state.household?.spouses);
    grid.appendChild(tile({
      label: 'Household',
      value: namesLabel ? escapeHtml(namesLabel) : filing,
      hint: namesLabel ? filing : (state.household?.location?.state ? `WA · ${filing}` : null),
      stale: isStale,
    }));

    // Income (household total = salary + bonus + RSU + cap gains)
    const inc = state.income || {};
    const totalIncome = sumNumbers(
      sumSpouse(inc.salary),
      sumSpouse(inc.bonus),
      sumSpouse(inc.rsuVests),
      inc.capitalGains?.shortTerm,
      inc.capitalGains?.longTerm,
    );
    grid.appendChild(tile({
      label: 'Projected income',
      value: fmtMoney(totalIncome),
      hint: totalIncome ? 'Salary + bonus + RSU + cap gains' : 'Set in Tax Estimator',
      stale: isStale && totalIncome != null,
    }));

    // Retirement contributions (current-year, traditional + roth + after-tax + IRA + HSA + catch-up)
    const c = state.retirement?.contributions || {};
    const totalContrib = sumNumbers(
      sumSpouse(c.traditional401k),
      sumSpouse(c.roth401k),
      sumSpouse(c.afterTax401k),
      sumSpouse(c.catchup),
      sumSpouse(c.ira),
      c.hsa,
    );
    grid.appendChild(tile({
      label: 'Retirement contributions',
      value: fmtMoney(totalContrib),
      hint: totalContrib ? '401(k) + IRA + HSA, this year' : 'Set in Tax Estimator',
      stale: isStale && totalContrib != null,
    }));

    // Retirement balance (modeled in Retirement Planner via the RMD slider)
    const retBal = state.retirement?.balances?.total;
    grid.appendChild(tile({
      label: 'Retirement balance',
      value: fmtMoney(retBal),
      hint: retBal ? 'Modeled in Retirement Planner' : 'Set in Retirement Planner',
      stale: isStale && retBal != null,
    }));

    // Portfolio
    const portValue = state.portfolio?.totalValue;
    grid.appendChild(tile({
      label: 'Portfolio value',
      value: fmtMoney(portValue),
      hint: portValue ? 'Across all holdings' : 'Set in Portfolio Review',
      stale: isStale && portValue != null,
    }));

    // Liabilities
    const liabTotal = state.liabilities?.total;
    grid.appendChild(tile({
      label: 'Total liabilities',
      value: fmtMoney(liabTotal),
      hint: liabTotal ? 'Mortgage, loans & more' : 'Set in Net Worth Tracker',
      stale: isStale && liabTotal != null,
    }));

    // Net Worth
    const manualAssets = sumNumbers(
      state.assets?.realEstate,
      state.assets?.vehicles,
      state.assets?.other,
    );
    const totalAssets = sumNumbers(portValue, state.retirement?.balances?.total, manualAssets);
    const netWorth = totalAssets != null || liabTotal != null
      ? (totalAssets || 0) - (liabTotal || 0)
      : null;
    grid.appendChild(tile({
      label: 'Net worth',
      value: fmtMoney(netWorth),
      hint: netWorth != null ? 'Assets − Liabilities' : 'Set portfolio & liabilities',
      stale: isStale && netWorth != null,
    }));

    // Monthly spend (current calendar month, expenses are negative amounts)
    const txns = state.expenses?.transactions;
    if (Array.isArray(txns) && txns.length) {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthSpend = txns
        .filter((t) => typeof t.date === 'string' && t.date.startsWith(ym))
        .reduce((s, t) => s - (Number(t.amount) || 0), 0);
      grid.appendChild(tile({
        label: 'Spend this month',
        value: fmtMoney(Math.round(monthSpend)),
        hint: 'Tracked in Expenses',
        stale: false,
      }));
    }

    mount.appendChild(grid);

    // Meta line
    const meta = document.createElement('div');
    meta.className = 'suite-snapshot__meta';
    const editor = TOOL_LABEL[state.meta.lastEditedBy] || state.meta.lastEditedBy || 'a tool';
    const when = relTime(state.meta.lastUpdated);
    meta.innerHTML = `Last updated by <strong>${escapeHtml(editor)}</strong>${when ? ' · ' + escapeHtml(when) : ''}`;
    mount.appendChild(meta);
  }

  // ---------- Export / Import ----------
  const EXPORT_FORMAT = 'wealth-suite-export-v1';

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function downloadJSON(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleExport() {
    const state = store.export();
    downloadJSON(`wealth-suite-export-${todayISO()}.json`, {
      format: EXPORT_FORMAT,
      exportedAt: new Date().toISOString(),
      state,
    });
    showStatus('Exported to your downloads folder.');
  }

  // ---------- CSV export ----------
  function downloadCSV(filename, rows) {
    const csv = rows.map((row) =>
      row.map((cell) => {
        const s = cell == null ? '' : String(cell);
        return /[,"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',')
    ).join('\r\n');
    // BOM helps Excel on Windows open UTF-8 CSV correctly.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function spouseCols(state) {
    const sp = (state.household && state.household.spouses) || [];
    return [
      (sp[0] && sp[0].name) ? sp[0].name.trim() : 'Spouse 1',
      (sp[1] && sp[1].name) ? sp[1].name.trim() : 'Spouse 2',
    ];
  }

  function fmtNum(n) {
    const v = Number(n);
    return (n == null || !Number.isFinite(v)) ? '' : v;
  }

  function exportIncomeCSV() {
    const state = store.export();
    const inc = state.income || {};
    const cg = inc.capitalGains || {};
    const [n1, n2] = spouseCols(state);
    const rows = [
      ['Category', 'Item', n1, n2],
      ['Income', 'Salary', fmtNum(inc.salary && inc.salary.s1), fmtNum(inc.salary && inc.salary.s2)],
      ['Income', 'Bonus', fmtNum(inc.bonus && inc.bonus.s1), fmtNum(inc.bonus && inc.bonus.s2)],
      ['Income', 'RSU Vests', fmtNum(inc.rsuVests && inc.rsuVests.s1), fmtNum(inc.rsuVests && inc.rsuVests.s2)],
      ['Capital Gains', 'Short-term (shared)', fmtNum(cg.shortTerm), ''],
      ['Capital Gains', 'Long-term (shared)', fmtNum(cg.longTerm), ''],
    ];
    downloadCSV(`wealth-suite-income-${todayISO()}.csv`, rows);
    showStatus('Income CSV downloaded.');
  }

  function exportRetirementCSV() {
    const state = store.export();
    const [n1, n2] = spouseCols(state);
    const c = (state.retirement && state.retirement.contributions) || {};
    const bal = (state.retirement && state.retirement.balances) || {};
    const plan = (state.retirement && state.retirement.plan) || {};
    const rows = [
      ['Category', 'Item', n1, n2],
      ['Contributions', 'Traditional 401(k)', fmtNum(c.traditional401k && c.traditional401k.s1), fmtNum(c.traditional401k && c.traditional401k.s2)],
      ['Contributions', 'Roth 401(k)', fmtNum(c.roth401k && c.roth401k.s1), fmtNum(c.roth401k && c.roth401k.s2)],
      ['Contributions', 'After-tax 401(k)', fmtNum(c.afterTax401k && c.afterTax401k.s1), fmtNum(c.afterTax401k && c.afterTax401k.s2)],
      ['Contributions', 'Catch-up', fmtNum(c.catchup && c.catchup.s1), fmtNum(c.catchup && c.catchup.s2)],
      ['Contributions', 'IRA', fmtNum(c.ira && c.ira.s1), fmtNum(c.ira && c.ira.s2)],
      ['Contributions', 'HSA (shared)', fmtNum(c.hsa), ''],
      ['Balance', 'Total Retirement Balance', fmtNum(bal.total), ''],
      ['Plan', 'Target Retire Age', fmtNum(plan.targetRetireAge), ''],
      ['Plan', 'Annual Expenses', fmtNum(plan.annualExpenses), ''],
      ['Plan', 'Growth Assumption', fmtNum(plan.growthAssumption), ''],
    ];
    downloadCSV(`wealth-suite-retirement-${todayISO()}.csv`, rows);
    showStatus('Retirement CSV downloaded.');
  }

  function exportPortfolioCSV() {
    const state = store.export();
    const port = state.portfolio || {};
    const total = Number(port.totalValue) || 0;
    const allocs = port.allocations || {};
    const rows = [['Asset Class', 'Current %', 'Current $']];
    for (const [key, fraction] of Object.entries(allocs)) {
      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
      const pct = Number.isFinite(Number(fraction)) ? +(Number(fraction) * 100).toFixed(2) : '';
      const dollars = (total && Number.isFinite(Number(fraction))) ? Math.round(total * Number(fraction)) : '';
      rows.push([label, pct, dollars]);
    }
    rows.push(['', '', '']);
    rows.push(['Total', '', total || '']);
    downloadCSV(`wealth-suite-portfolio-${todayISO()}.csv`, rows);
    showStatus('Portfolio CSV downloaded.');
  }

  function handleImportFile(file) {
    const reader = new FileReader();
    reader.onerror = () => showStatus('Import failed: could not read file', true);
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        // Accept either {format, state} envelope or raw state.
        const incoming = parsed && typeof parsed === 'object' && parsed.state
          ? parsed.state
          : parsed;
        if (!incoming || typeof incoming !== 'object') {
          throw new Error('not a valid Wealth Suite JSON');
        }
        const ok = window.confirm(
          'Import this file and replace your current Wealth Suite data?\n\n' +
          'Your existing snapshot will be overwritten. Use Export first if you want a backup.'
        );
        if (!ok) { showStatus('Import cancelled.'); return; }
        store.import(incoming, { editedBy: 'import' });
        showStatus('Imported.');
      } catch (err) {
        console.error('[dashboard] import failed', err);
        showStatus('Import failed: ' + (err.message || err), true);
      }
    };
    reader.readAsText(file);
  }

  let statusTimer = null;
  function showStatus(msg, isError) {
    const el = document.querySelector('.suite-snapshot__status');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('is-error', !!isError);
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      el.textContent = '';
      el.classList.remove('is-error');
    }, 4500);
  }

  function renderActions() {
    const host = document.getElementById('suite-snapshot-actions');
    if (!host || host.dataset.suiteBound) return;
    host.dataset.suiteBound = '1';

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'suite-action-btn';
    exportBtn.textContent = 'Export JSON';
    exportBtn.addEventListener('click', handleExport);

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'suite-action-btn suite-action-btn--ghost';
    importBtn.textContent = 'Import JSON';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'suite-action-btn suite-action-btn--danger';
    resetBtn.textContent = 'Reset';
    resetBtn.title = 'Clear the suite snapshot — tool-specific data like taxSuiteInputs_v2 is reset on the next tool load.';
    resetBtn.addEventListener('click', () => {
      const ok = window.confirm(
        'Reset Wealth Suite data?\n\n' +
        'Clears household, income, contributions, retirement balance, portfolio total, and allocations from the snapshot.\n' +
        'Tools (Tax Estimator, etc.) will be re-seeded from this empty state on next load.\n\n' +
        'Use Export first if you want a backup.'
      );
      if (!ok) { showStatus('Reset cancelled.'); return; }
      store.reset();
      // Also wipe tool-specific mirror keys so adapters don't re-seed the
      // store from stale localStorage on next tool load. Theme preference,
      // confirmed IRS years, and GitHub PAT are intentionally preserved.
      try { localStorage.removeItem('taxSuiteInputs_v2'); } catch (_) {}
      showStatus('Snapshot reset.');
    });

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.hidden = true;
    fileInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) handleImportFile(f);
      e.target.value = ''; // allow re-importing the same file
    });
    importBtn.addEventListener('click', () => fileInput.click());

    const status = document.createElement('span');
    status.className = 'suite-snapshot__status';
    status.setAttribute('aria-live', 'polite');

    // CSV export dropdown
    const csvWrap = document.createElement('div');
    csvWrap.className = 'suite-csv-dropdown';

    const csvTrigger = document.createElement('button');
    csvTrigger.type = 'button';
    csvTrigger.className = 'suite-action-btn suite-action-btn--ghost';
    csvTrigger.setAttribute('aria-haspopup', 'menu');
    csvTrigger.setAttribute('aria-expanded', 'false');
    csvTrigger.textContent = 'Export CSV ▾';

    const csvMenu = document.createElement('ul');
    csvMenu.className = 'suite-csv-menu';
    csvMenu.setAttribute('role', 'menu');
    csvMenu.hidden = true;

    [
      { label: 'Income', fn: exportIncomeCSV },
      { label: 'Retirement', fn: exportRetirementCSV },
      { label: 'Portfolio', fn: exportPortfolioCSV },
    ].forEach(({ label, fn }) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'none');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suite-csv-item';
      btn.setAttribute('role', 'menuitem');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        csvMenu.hidden = true;
        csvTrigger.setAttribute('aria-expanded', 'false');
        fn();
      });
      li.appendChild(btn);
      csvMenu.appendChild(li);
    });

    csvTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !csvMenu.hidden;
      csvMenu.hidden = open;
      csvTrigger.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', () => {
      csvMenu.hidden = true;
      csvTrigger.setAttribute('aria-expanded', 'false');
    });

    csvWrap.appendChild(csvTrigger);
    csvWrap.appendChild(csvMenu);

    const printBtn = document.createElement('a');
    printBtn.href = 'print.html';
    printBtn.target = '_blank';
    printBtn.rel = 'noopener';
    printBtn.className = 'suite-action-btn suite-action-btn--ghost';
    printBtn.textContent = 'Print Snapshot';
    printBtn.style.textDecoration = 'none';

    host.appendChild(exportBtn);
    host.appendChild(csvWrap);
    host.appendChild(printBtn);
    host.appendChild(importBtn);
    host.appendChild(resetBtn);
    host.appendChild(fileInput);
    host.appendChild(status);
  }

  function renderScenarios() {
    const host = document.getElementById('suite-scenarios');
    if (!host || host.dataset.suiteBound) return;
    host.dataset.suiteBound = '1';

    SCENARIOS.forEach((sc) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suite-scenario-chip';
      btn.dataset.retireAge = sc.retireAge;
      btn.textContent = sc.label;
      btn.addEventListener('click', () => {
        const current = store.get('retirement.plan.targetRetireAge');
        if (current === sc.retireAge) {
          store.set('retirement.plan.targetRetireAge', null, { editedBy: 'dashboard' });
          showStatus('Scenario cleared.');
        } else {
          store.set('retirement.plan.targetRetireAge', sc.retireAge, { editedBy: 'dashboard' });
          showStatus(`Scenario: ${sc.label} active.`);
        }
      });
      host.appendChild(btn);
    });
  }

  function updateScenarioChips(state) {
    const active = state && state.retirement && state.retirement.plan
      ? state.retirement.plan.targetRetireAge
      : null;
    document.querySelectorAll('.suite-scenario-chip').forEach((chip) => {
      chip.classList.toggle('is-active', Number(chip.dataset.retireAge) === active);
    });
  }

  // ---------- Compact entry panel ----------
  const COMPACT_KEY = 'wealthSuite.compactOpen';

  renderScenarios();
  renderActions();
  const syncCompact = renderCompact();

  // Initial render + subscribe to any future change
  const _initialState = store.export();
  render(_initialState);
  updateScenarioChips(_initialState);
  if (syncCompact) syncCompact(_initialState);

  store.subscribe('', (state) => {
    render(state);
    updateScenarioChips(state);
    if (syncCompact) syncCompact(state);
  });

  // Re-render relative time every minute so "3 min ago" stays accurate
  setInterval(() => {
    const s = store.export();
    render(s);
    updateScenarioChips(s);
    if (syncCompact) syncCompact(s);
  }, 60_000);

  function renderCompact() {
    const headEl = document.getElementById('suite-compact-head');
    const panelEl = document.getElementById('suite-compact-panel');
    if (!headEl || !panelEl) return null;

    const setOpen = (val) => {
      try { localStorage.setItem(COMPACT_KEY, val ? '1' : '0'); } catch (_) {}
      panelEl.hidden = !val;
      toggleBtn.textContent = val ? '▲ Collapse' : '▼ Expand';
    };
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'suite-compact-toggle';
    toggleBtn.addEventListener('click', () => setOpen(panelEl.hidden));
    headEl.appendChild(toggleBtn);
    setOpen(localStorage.getItem(COMPACT_KEY) !== '0');

    return buildCompactPanel(panelEl);
  }

  function buildCompactPanel(panel) {
    const OPTS = { editedBy: 'dashboard' };
    let activeInput = null;

    // ---- Micro DOM helpers ----
    function mkInput(type, id, attrs) {
      const el = document.createElement('input');
      el.type = type;
      if (id) el.id = id;
      if (attrs) Object.assign(el, attrs);
      el.className = 'suite-compact-input';
      el.addEventListener('focus', () => { activeInput = el; });
      el.addEventListener('blur',  () => { if (activeInput === el) activeInput = null; });
      return el;
    }

    function mkSelect(id, pairs) {
      const el = document.createElement('select');
      el.id = id;
      el.className = 'suite-compact-input';
      pairs.forEach(([v, t]) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = t;
        el.appendChild(o);
      });
      return el;
    }

    function fld(lbl, inp, sizeClass) {
      const wrap = document.createElement('span');
      wrap.className = 'suite-compact-field';
      const label = document.createElement('label');
      label.className = 'suite-compact-label';
      label.textContent = lbl;
      if (inp.id) label.htmlFor = inp.id;
      if (sizeClass) inp.classList.add(sizeClass);
      wrap.append(label, inp);
      return wrap;
    }

    function row(...items) {
      const r = document.createElement('div');
      r.className = 'suite-compact-row';
      items.forEach(el => r.appendChild(el));
      return r;
    }

    function sec(title) {
      const s = document.createElement('div');
      s.className = 'suite-compact-section';
      const t = document.createElement('div');
      t.className = 'suite-compact-section-title';
      t.textContent = title;
      s.appendChild(t);
      return s;
    }

    function hr() {
      const el = document.createElement('hr');
      el.className = 'suite-compact-divider';
      return el;
    }

    // ---- Wiring helpers ----
    function parseMoney(s) {
      const n = parseFloat(String(s || '').replace(/[$,\s]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    function fmtC(n) {
      if (n == null || !Number.isFinite(Number(n))) return '';
      return usd0.format(Number(n));
    }

    function wireMoney(input, path) {
      input.value = fmtC(store.get(path));
      input.addEventListener('focus', () => {
        const n = parseMoney(input.value);
        input.value = n != null ? String(n) : '';
      });
      input.addEventListener('blur', () => {
        const n = parseMoney(input.value);
        store.set(path, n, OPTS);
        input.value = fmtC(n);
      });
      return (val) => { if (activeInput !== input) input.value = fmtC(val); };
    }

    function wireInt(input, path) {
      const v = store.get(path);
      input.value = v != null ? String(v) : '';
      input.addEventListener('blur', () => {
        const n = parseInt(input.value, 10);
        store.set(path, Number.isFinite(n) ? n : null, OPTS);
      });
      return (val) => { if (activeInput !== input) input.value = val != null ? String(val) : ''; };
    }

    // ---- Build structure ----

    // Household
    const hhSec   = sec('Household');
    const filingEl = mkSelect('sc-filing', [['mfj', 'Married (MFJ)'], ['single', 'Single']]);
    const n1El = mkInput('text',   'sc-n1', { placeholder: 'Name' });
    const a1El = mkInput('number', 'sc-a1', { placeholder: '—', min: 18, max: 100 });
    const n2El = mkInput('text',   'sc-n2', { placeholder: 'Name' });
    const a2El = mkInput('number', 'sc-a2', { placeholder: '—', min: 18, max: 100 });
    const sp2Row = row(fld('Spouse 2', n2El, 'suite-compact-input--name'), fld('Age', a2El, 'suite-compact-input--sm'));

    hhSec.appendChild(row(
      fld('Filing', filingEl),
      fld('Spouse 1', n1El, 'suite-compact-input--name'),
      fld('Age', a1El, 'suite-compact-input--sm'),
    ));
    hhSec.appendChild(sp2Row);

    // Income
    const incSec = sec('Income');
    const salS1 = mkInput('text', 'sc-sal-s1', { placeholder: '$0' });
    const salS2 = mkInput('text', 'sc-sal-s2', { placeholder: '$0' });
    const bonS1 = mkInput('text', 'sc-bon-s1', { placeholder: '$0' });
    const bonS2 = mkInput('text', 'sc-bon-s2', { placeholder: '$0' });
    const rsuS1 = mkInput('text', 'sc-rsu-s1', { placeholder: '$0' });
    const rsuS2 = mkInput('text', 'sc-rsu-s2', { placeholder: '$0' });
    const stcgEl = mkInput('text', 'sc-stcg',  { placeholder: '$0' });
    const ltcgEl = mkInput('text', 'sc-ltcg',  { placeholder: '$0' });

    const salS2F = fld('S2', salS2, 'suite-compact-input--md');
    const bonS2F = fld('S2', bonS2, 'suite-compact-input--md');
    const rsuS2F = fld('S2', rsuS2, 'suite-compact-input--md');
    const s2Inc  = [salS2F, bonS2F, rsuS2F];

    incSec.appendChild(row(fld('Salary', salS1, 'suite-compact-input--md'), salS2F));
    incSec.appendChild(row(fld('Bonus',  bonS1, 'suite-compact-input--md'), bonS2F));
    incSec.appendChild(row(fld('RSU',    rsuS1, 'suite-compact-input--md'), rsuS2F));
    incSec.appendChild(row(fld('STCG', stcgEl, 'suite-compact-input--md'), fld('LTCG', ltcgEl, 'suite-compact-input--md')));

    // Retirement
    const retSec    = sec('Retirement');
    const retBalEl  = mkInput('text',   'sc-ret-bal',  { placeholder: '$0' });
    const retAgeEl  = mkInput('number', 'sc-ret-age',  { placeholder: '65', min: 40, max: 80 });
    const retGrowEl = mkInput('number', 'sc-ret-grow', { placeholder: '7',  min: 0, max: 20, step: 0.1 });
    const retExpEl  = mkInput('text',   'sc-ret-exp',  { placeholder: '$0' });

    retSec.appendChild(row(
      fld('Balance', retBalEl, 'suite-compact-input--md'),
      fld('Target age', retAgeEl, 'suite-compact-input--sm'),
      fld('Growth %', retGrowEl, 'suite-compact-input--sm'),
      fld('Expenses/yr', retExpEl, 'suite-compact-input--md'),
    ));

    // Portfolio
    const portSec   = sec('Portfolio');
    const portValEl = mkInput('text', 'sc-port-val', { placeholder: '$0' });
    portSec.appendChild(row(fld('Total value', portValEl, 'suite-compact-input--lg')));

    panel.append(hhSec, hr(), incSec, hr(), retSec, hr(), portSec);

    // ---- MFJ visibility (defined after s2Inc is ready) ----
    function updateMfj(mfj) {
      sp2Row.hidden = !mfj;
      s2Inc.forEach(el => { el.hidden = !mfj; });
    }

    // ---- Wire filing ----
    filingEl.value = store.get('household.filingStatus') || 'mfj';
    filingEl.addEventListener('change', () => {
      store.set('household.filingStatus', filingEl.value, OPTS);
      updateMfj(filingEl.value === 'mfj');
    });

    // ---- Wire spouse name/age ----
    function getSpouse(idx, f) {
      const sp = store.get('household.spouses') || [];
      return sp[idx] ? sp[idx][f] : null;
    }
    function setSpouse(idx, f, val) {
      const sp = (store.get('household.spouses') || [{ name: '', age: null }, { name: '', age: null }]).slice();
      sp[idx] = Object.assign({}, sp[idx] || {}, { [f]: val });
      store.set('household.spouses', sp, OPTS);
    }

    n1El.value = getSpouse(0, 'name') || '';
    a1El.value = getSpouse(0, 'age') != null ? String(getSpouse(0, 'age')) : '';
    n2El.value = getSpouse(1, 'name') || '';
    a2El.value = getSpouse(1, 'age') != null ? String(getSpouse(1, 'age')) : '';

    n1El.addEventListener('blur', () => setSpouse(0, 'name', n1El.value.trim()));
    a1El.addEventListener('blur', () => { const n = parseInt(a1El.value, 10); setSpouse(0, 'age', Number.isFinite(n) ? n : null); });
    n2El.addEventListener('blur', () => setSpouse(1, 'name', n2El.value.trim()));
    a2El.addEventListener('blur', () => { const n = parseInt(a2El.value, 10); setSpouse(1, 'age', Number.isFinite(n) ? n : null); });

    // ---- Wire income ----
    const syncSalS1 = wireMoney(salS1, 'income.salary.s1');
    const syncSalS2 = wireMoney(salS2, 'income.salary.s2');
    const syncBonS1 = wireMoney(bonS1, 'income.bonus.s1');
    const syncBonS2 = wireMoney(bonS2, 'income.bonus.s2');
    const syncRsuS1 = wireMoney(rsuS1, 'income.rsuVests.s1');
    const syncRsuS2 = wireMoney(rsuS2, 'income.rsuVests.s2');
    const syncStcg  = wireMoney(stcgEl, 'income.capitalGains.shortTerm');
    const syncLtcg  = wireMoney(ltcgEl, 'income.capitalGains.longTerm');

    // ---- Wire retirement ----
    const syncRetBal = wireMoney(retBalEl, 'retirement.balances.total');
    const syncRetAge = wireInt(retAgeEl,   'retirement.plan.targetRetireAge');
    const syncRetExp = wireMoney(retExpEl, 'retirement.plan.annualExpenses');

    // Growth % stored as decimal (0.07), displayed as percent (7)
    const g0 = store.get('retirement.plan.growthAssumption');
    retGrowEl.value = g0 != null ? String(+(g0 * 100).toFixed(2)) : '';
    retGrowEl.addEventListener('blur', () => {
      const n = parseFloat(retGrowEl.value);
      store.set('retirement.plan.growthAssumption', Number.isFinite(n) ? n / 100 : null, OPTS);
    });
    const syncRetGrow = (val) => {
      if (activeInput !== retGrowEl) retGrowEl.value = val != null ? String(+(val * 100).toFixed(2)) : '';
    };

    // ---- Wire portfolio ----
    const syncPortVal = wireMoney(portValEl, 'portfolio.totalValue');

    // ---- Initial MFJ visibility ----
    updateMfj(filingEl.value === 'mfj');

    // ---- Return sync fn for external store updates ----
    return function syncFromStore(state) {
      const sp  = state.household?.spouses || [{}, {}];
      const mfj = (state.household?.filingStatus || 'mfj') === 'mfj';
      const inc  = state.income || {};
      const ret  = state.retirement || {};
      const port = state.portfolio || {};

      if (activeInput !== filingEl) { filingEl.value = state.household?.filingStatus || 'mfj'; updateMfj(mfj); }
      if (activeInput !== n1El) n1El.value = (sp[0] && sp[0].name) || '';
      if (activeInput !== a1El) a1El.value = sp[0]?.age != null ? String(sp[0].age) : '';
      if (activeInput !== n2El) n2El.value = (sp[1] && sp[1].name) || '';
      if (activeInput !== a2El) a2El.value = sp[1]?.age != null ? String(sp[1].age) : '';

      syncSalS1(inc.salary?.s1);     syncSalS2(inc.salary?.s2);
      syncBonS1(inc.bonus?.s1);      syncBonS2(inc.bonus?.s2);
      syncRsuS1(inc.rsuVests?.s1);   syncRsuS2(inc.rsuVests?.s2);
      syncStcg(inc.capitalGains?.shortTerm);
      syncLtcg(inc.capitalGains?.longTerm);

      syncRetBal(ret.balances?.total);
      syncRetAge(ret.plan?.targetRetireAge);
      syncRetGrow(ret.plan?.growthAssumption);
      syncRetExp(ret.plan?.annualExpenses);

      syncPortVal(port.totalValue);
    };
  }
})();
