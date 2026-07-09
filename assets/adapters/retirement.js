/* =============================================================
 * Wealth Suite — Retirement Planner adapter (Phase 2 step 3 / Phase 3)
 *
 * Phase 2:
 *   1. Mirrors RMD slider → suite store (retirement.balances.total)
 *   2. Restores slider from store on load
 *   3. Injects household banner in header
 *
 * Phase 13q additions:
 *   9. Includes annual retirement contributions (compounded as an
 *      ordinary annuity) in portAtRetire, matching the dashboard's
 *      readiness model and the tool's own savings-roadmap card.
 *  10. Patches window.runMC (and re-labels the MC chart axis) so the
 *      Monte Carlo scenario uses store-derived inputs too.
 *  11. Rewrites the tool's remaining hardcoded copy from the store:
 *      header subtitle + document title, "Target at N" stat (25x spend,
 *      4% SWR), buffer-ladder tiers + inflation schedule + age-70 SS
 *      note, and the savings-roadmap card. Empty store keeps the sample.
 *  12. SS base aligned to the tool's current baked estimate ($69.6k/yr
 *      combined at 70, in at-retirement dollars) — the old $124,872
 *      base came from a prior version of the tool.
 *
 * Phase 3 additions:
 *   4. Reads portfolio.totalValue, retirement.plan.{targetRetireAge,
 *      annualExpenses, growthAssumption}, and household ages to derive
 *      portAtRetire and spendAtRetire (compound growth / inflation to
 *      the target retire age).
 *   5. Patches window.calcPortfolio so the lazy-built Projections
 *      chart uses store-derived inputs instead of the hardcoded
 *      $6.52M / $287k / age-55 defaults.
 *   6. Recomputes bullD/baseD/stressD globals immediately; updates
 *      the v70/v85/v85s tiles and the "Starting portfolio" tile.
 *   7. Updates the overview summary tiles: Current portfolio,
 *      Projected at age X, Spend at retirement, Spend at age 70,
 *      3-yr buffer needed. Also updates the header portfolio stat.
 *   8. Expands the household banner to surface portfolio and
 *      spending context alongside the existing income/age data.
 *
 * The tool's own UI/state code is never modified. All contact is
 * through the global namespace and DOM updates.
 * ============================================================= */
(function () {
  'use strict';

  const store = window.WealthSuite && window.WealthSuite.store;
  if (!store) {
    console.warn('[retirement-adapter] WealthSuite.store missing — adapter inactive');
    return;
  }

  const EDITED_BY = 'retirement';
  const DEBOUNCE_MS = 250;
  const INFLATION = 0.035;

  // ---------- formatters ----------
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

  // ---------- DOM helpers ----------
  function findScTile(labelText) {
    for (const el of document.querySelectorAll('.sc')) {
      const l = el.querySelector('.sc-l');
      if (l && l.textContent.trim() === labelText) {
        return el.querySelector('.sc-v');
      }
    }
    return null;
  }

  // Prefix match — labels like "Projected at age 62" carry a hardcoded
  // age that this adapter rewrites, so exact matching would break on
  // the second pass (and broke silently when the tool's sample age changed).
  function findScByPrefix(prefix) {
    for (const el of document.querySelectorAll('.sc')) {
      const l = el.querySelector('.sc-l');
      if (l && l.textContent.trim().indexOf(prefix) === 0) return el;
    }
    return null;
  }

  // ---------- Projection state (closure vars shared with patched calcPortfolio) ----------
  var _port      = 2250000;   // portAtRetire — default matches tool hardcode
  var _spend     = 90000;     // spendAtRetire — default matches tool hardcode
  var _retireAge = 62;        // default matches tool hardcode
  var _curAge    = 45;        // default matches tool hardcode

  // Combined household SS at age 70, in at-retirement dollars — the
  // tool's baked estimate ($5,800/mo × 2 spouses). No store field yet.
  var SS_BASE = 69600;
  function ssAt(age, ir) {
    if (age < 70) return 0;
    var ssAt70 = SS_BASE * Math.pow(1 + (ir || INFLATION), Math.max(0, 70 - _retireAge));
    return ssAt70 * Math.pow(1.025, age - 70);
  }

  // ---------- calcPortfolio patch ----------
  // Replaces the tool's hardcoded function with one that uses store-derived
  // inputs while preserving the identical loop logic (SS at 70, COLA, etc.).
  function patchCalcPortfolio() {
    window.calcPortfolio = function (gr, ir) {
      var port = _port, spend = _spend;
      var startAge = _retireAge;
      var years = Math.max(35, 90 - startAge);
      var labels = [], vals = [];
      for (var yr = 0; yr <= years; yr++) {
        var age = startAge + yr;
        labels.push(age);
        vals.push(parseFloat((port / 1e6).toFixed(2)));
        var ss = ssAt(age, ir);
        port = Math.max(0, port * (1 + gr) - Math.max(0, spend - ss));
        spend *= (1 + ir);
      }
      return { labels: labels, vals: vals };
    };
  }

  // ---------- runMC / MC chart patch ----------
  // Same treatment for the Monte Carlo path generator: the tool hardcodes
  // $2.25M / $90k / age 62 inside runMC, and buildMCChart hardcodes the
  // 62-based x-axis labels. The wrapper re-labels after the tool builds.
  function patchMonteCarlo() {
    window.runMC = function (N, mu, sigma, ir) {
      var YEARS = Math.max(1, 90 - _retireAge), successes = 0, paths = [];
      for (var s = 0; s < N; s++) {
        var port = _port, spend = _spend;
        var path = [+(port / 1e6).toFixed(2)];
        for (var yr = 0; yr < YEARS; yr++) {
          var age = _retireAge + yr;
          var r = mu + sigma * window.randn();
          var ss = ssAt(age, ir);
          port = Math.max(0, port * (1 + r) - Math.max(0, spend - ss));
          spend *= (1 + ir);
          path.push(+(port / 1e6).toFixed(2));
        }
        if (port > 0) successes++;
        paths.push(path);
      }
      return { paths: paths, successRate: successes / N };
    };
    window.mcCache = null;

    var origMC = window.buildMCChart;
    if (typeof origMC === 'function' && !origMC.__wsPatched) {
      var wrappedMC = function () {
        origMC();
        var chart = window.projChart;
        var cache = window.mcCache;
        if (chart && cache && cache.paths && cache.paths[0]) {
          var labels = [];
          for (var i = 0; i < cache.paths[0].length; i++) labels.push(_retireAge + i);
          chart.data.labels = labels;
          chart.options.scales.x.ticks.callback = function (v, i) {
            return (_retireAge + i) % 5 === 0 ? 'Age ' + (_retireAge + i) : '';
          };
          chart.update('none');
        }
      };
      wrappedMC.__wsPatched = true;
      window.buildMCChart = wrappedMC;
    }

    // The deterministic chart's tick callback also hardcodes 62+i even
    // though its labels come from baseD — re-point ticks at the labels.
    var origProj = window.buildProjChart;
    if (typeof origProj === 'function' && !origProj.__wsPatched) {
      var wrappedProj = function (scen) {
        origProj(scen);
        var chart = window.projChart;
        if (chart) {
          chart.options.scales.x.ticks.callback = function (v, i) {
            var a = _retireAge + i;
            return a % 5 === 0 ? 'Age ' + a : '';
          };
          chart.update('none');
        }
      };
      wrappedProj.__wsPatched = true;
      window.buildProjChart = wrappedProj;
    }
  }

  // ---------- Projection seeding ----------
  function seedProjections() {
    const state = store.export();
    if (!state || !state.meta || state.meta.lastUpdated == null) return;

    const currentPortfolio = state.portfolio && state.portfolio.totalValue;
    const retireAge        = state.retirement && state.retirement.plan && state.retirement.plan.targetRetireAge;
    const annualExpenses   = state.retirement && state.retirement.plan && state.retirement.plan.annualExpenses;
    const growthAssumption = state.retirement && state.retirement.plan && state.retirement.plan.growthAssumption;

    const spouses  = (state.household && state.household.spouses) || [];
    const rawAges  = spouses
      .map((s) => (s && s.age != null && s.age !== '') ? Number(s.age) : NaN)
      .filter((n) => !isNaN(n) && n > 0);
    const currentAge = rawAges.length > 0 ? Math.min(...rawAges) : null;

    const hasPortfolio = currentPortfolio && currentPortfolio > 0;
    const hasExpenses  = annualExpenses && annualExpenses > 0;
    if (!hasPortfolio && !hasExpenses) return;

    const growthRate     = (growthAssumption && growthAssumption > 0) ? growthAssumption : 0.07;
    const retireAgeVal   = (retireAge && retireAge > 0) ? retireAge : 55;
    const curAgeVal      = currentAge || 51;
    const yearsToRetire  = Math.max(0, retireAgeVal - curAgeVal);

    // Annual retirement contributions (both spouses), compounded to the
    // retirement date as an ordinary annuity — matches the dashboard's
    // readiness model and the tool's own savings-roadmap card.
    const c     = (state.retirement && state.retirement.contributions) || {};
    const c401k = sumSpouse(c.traditional401k) + sumSpouse(c.roth401k)
                + sumSpouse(c.afterTax401k) + sumSpouse(c.catchup);
    const cIra  = sumSpouse(c.ira);
    const cHsa  = (c.hsa != null && c.hsa !== '') ? (Number(c.hsa) || 0) : 0;
    const annuityFV = (annual) => (annual > 0 && yearsToRetire > 0)
      ? annual * (Math.pow(1 + growthRate, yearsToRetire) - 1) / growthRate
      : 0;
    const baseFV    = hasPortfolio ? currentPortfolio * Math.pow(1 + growthRate, yearsToRetire) : 0;
    const contribFV = annuityFV(c401k) + annuityFV(cIra) + annuityFV(cHsa);

    // Update closure vars used by the patched calcPortfolio / runMC
    _retireAge = retireAgeVal;
    _curAge    = curAgeVal;
    if (hasPortfolio) {
      _port = baseFV + contribFV;
    }
    if (hasExpenses) {
      _spend = annualExpenses * Math.pow(1 + INFLATION, yearsToRetire);
    }

    // Patch and recompute datasets (chart is lazy — runs before any tab click)
    patchCalcPortfolio();
    patchMonteCarlo();
    window.bullD   = window.calcPortfolio(0.09, 0.035);
    window.baseD   = window.calcPortfolio(0.07, 0.035);
    window.stressD = window.calcPortfolio(0.05, 0.04);

    // v70/v85/v85s use age-relative indices
    const idx70 = 70 - retireAgeVal;
    const idx85 = 85 - retireAgeVal;
    const safeVal = (arr, i) => (i >= 0 && arr && arr[i] != null) ? arr[i].toFixed(1) : null;

    const v70El  = document.getElementById('v70');
    const v85El  = document.getElementById('v85');
    const v85sEl = document.getElementById('v85s');
    if (v70El  && safeVal(window.baseD.vals,   idx70)) v70El.textContent  = '$' + safeVal(window.baseD.vals, idx70)   + 'M';
    if (v85El  && safeVal(window.baseD.vals,   idx85)) v85El.textContent  = '$' + safeVal(window.baseD.vals, idx85)   + 'M';
    if (v85sEl && safeVal(window.stressD.vals, idx85)) v85sEl.textContent = '$' + safeVal(window.stressD.vals, idx85) + 'M';

    // Overview tiles
    if (hasPortfolio) {
      const portTile = findScTile('Current portfolio');
      if (portTile) portTile.textContent = fmtM(currentPortfolio);

      const projSc = findScByPrefix('Projected at age');
      if (projSc) {
        projSc.querySelector('.sc-l').textContent = 'Projected at age ' + retireAgeVal;
        const v = projSc.querySelector('.sc-v');
        if (v) v.textContent = '~' + fmtM(_port);
      }

      const hsVals = document.querySelectorAll('.hs-v');
      if (hsVals[0]) hsVals[0].textContent = fmtM(currentPortfolio);

      const startSc = findScByPrefix('Starting portfolio (age');
      if (startSc) {
        startSc.querySelector('.sc-l').textContent = 'Starting portfolio (age ' + retireAgeVal + ')';
        const v = startSc.querySelector('.sc-v');
        if (v) v.textContent = fmtM(_port);
      }
    }

    if (hasExpenses) {
      const spendRetireTile = findScTile('Spend at retirement');
      if (spendRetireTile) spendRetireTile.textContent = fmtK(_spend) + '/yr';

      const spend70 = _spend * Math.pow(1 + INFLATION, 70 - retireAgeVal);
      const spend70Tile = findScTile('Spend at age 70');
      if (spend70Tile) spend70Tile.textContent = fmtK(spend70) + '/yr';

      const bufferTile = findScTile('3-yr buffer needed');
      if (bufferTile) bufferTile.textContent = fmtK(_spend * 3);
    }

    // If the Projections chart was somehow already built (e.g. deep-link),
    // destroy it so the next tab-click re-builds it with the new datasets.
    if (window.projBuilt && window.projChart) {
      try { window.projChart.destroy(); } catch (_) { /* ignore */ }
      window.projChart = null;
      window.projBuilt = false;
    }

    seedStaticContent({
      filingStatus: state.household && state.household.filingStatus,
      hasAge: currentAge != null,
      curAge: curAgeVal,
      retireAge: retireAgeVal,
      growthRate: growthRate,
      yearsToRetire: yearsToRetire,
      hasPortfolio: hasPortfolio,
      hasExpenses: hasExpenses,
      currentPortfolio: currentPortfolio,
      spendNow: annualExpenses,
      spendR: _spend,
      projPort: _port,
      baseFV: baseFV,
      c401k: c401k, c401kFV: annuityFV(c401k),
      cIra: cIra, cIraFV: annuityFV(cIra),
      cHsa: cHsa, cHsaFV: annuityFV(cHsa),
    });
  }

  // ---------- static content seeding (Phase 13q) ----------
  // Rewrites the tool's remaining hardcoded copy — header subtitle/title,
  // target stat, buffer ladder, inflation schedule, savings roadmap —
  // from store data. Only runs when seedProjections' gate passed, so an
  // empty store keeps the illustrative sample untouched.
  function seedStaticContent(ctx) {
    const retireAge = ctx.retireAge;
    const target = ctx.hasExpenses ? ctx.spendNow * 25 : null; // 4% SWR

    // Header subtitle + document title
    const filing = ctx.filingStatus === 'single' ? 'Single'
                 : ctx.filingStatus === 'mfj' ? 'Married couple' : null;
    const parts = [];
    if (filing) parts.push(filing);
    if (ctx.hasAge) parts.push('Age ' + ctx.curAge);
    parts.push('WA State');
    parts.push('Retiring at ' + retireAge);
    if (ctx.hasExpenses) parts.push(fmtK(ctx.spendNow) + '/yr spending target');
    const sub = document.querySelector('.hdr-l p');
    if (sub) sub.textContent = parts.join(' · ');
    if (ctx.hasAge) {
      document.title = 'Retirement Master Plan — Age ' + ctx.curAge
        + (filing ? ' | ' + filing : '') + ' | WA State';
    }

    // Header "Target at N" stat + overview target tile (25× spend)
    if (target) {
      const hs = document.querySelectorAll('.hdr-r .hs');
      if (hs[1]) {
        const tv = hs[1].querySelector('.hs-v');
        const tl = hs[1].querySelector('.hs-l');
        if (tv) tv.textContent = fmtM(target);
        if (tl) tl.textContent = 'Target at ' + retireAge;
      }
      const tgtSc = findScByPrefix('Target at age');
      if (tgtSc) {
        tgtSc.querySelector('.sc-l').textContent = 'Target at age ' + retireAge;
        const v = tgtSc.querySelector('.sc-v');
        if (v) v.textContent = fmtM(target);
      }
    }

    // Buffer tab — every figure derives from spend at retirement
    if (ctx.hasExpenses) {
      const spendR = ctx.spendR;
      const bufCards = document.querySelectorAll('#buf .card');
      if (bufCards[0]) {
        const ct = bufCards[0].querySelector('.ct');
        if (ct) ct.textContent = '3-tier SRR buffer ladder — funded at retirement (age ' + retireAge + ')';
        const cs = bufCards[0].querySelector('.cs');
        if (cs) cs.textContent = 'Total: ' + fmtK(spendR * 3)
          + '  |  Average yield: ~4.8%  |  Annual interest: ~'
          + fmtK(spendR * 3 * 0.048) + ' — meaningfully offsets yield drag';
        bufCards[0].querySelectorAll('.tier-v').forEach(function (el) {
          el.textContent = fmtK(spendR);
        });
      }
      // Inflation schedule: retirement age +0 / +5 / +10 / +15
      document.querySelectorAll('#buf .g4 .sc').forEach(function (tile, i) {
        const k = i * 5;
        const age = retireAge + k;
        const spendAtAge = spendR * Math.pow(1 + INFLATION, k);
        const l = tile.querySelector('.sc-l');
        const v = tile.querySelector('.sc-v');
        const note = tile.lastElementChild;
        if (l) l.textContent = 'Age ' + age;
        if (v) v.textContent = fmtK(spendAtAge) + '/yr';
        if (note && note !== v && !note.classList.contains('sc-v')) {
          note.textContent = (i === 3 && age >= 70)
            ? 'Net after SS: ~' + fmtK(Math.max(0, spendAtAge - ssAt(age)))
            : 'Buffer total: ' + fmtK(spendAtAge * 3);
        }
      });
      // Age-70 SS note
      const ib = document.querySelector('#buf .ib');
      if (ib) {
        const spend70 = spendR * Math.pow(1 + INFLATION, Math.max(0, 70 - retireAge));
        const ss70 = ssAt(70);
        const net70 = Math.max(0, spend70 - ss70);
        const pct = spend70 > 0 ? Math.round((1 - net70 / spend70) * 100) : 0;
        ib.textContent = 'At age 70, combined SS income for both spouses (~'
          + fmtK(ss70) + ' nominal, assuming both claim at 70) reduces the net '
          + 'annual portfolio draw from ' + fmtK(spend70) + ' to ~' + fmtK(net70)
          + ' — a ' + pct + '% reduction that significantly extends longevity '
          + 'and eases replenishment pressure.';
      }
    }

    // Savings roadmap — needs both a portfolio and a spending target
    if (ctx.hasPortfolio && ctx.hasExpenses && target) {
      const road = document.querySelectorAll('#proj .card')[1];
      if (!road) return;
      const projected = ctx.projPort;
      const gPct = Math.round(ctx.growthRate * 100);
      const pace = projected >= target * 1.5 ? 'well ahead of pace'
                 : projected >= target ? 'on pace' : 'behind pace';
      const rc = road.querySelector('.ct');
      if (rc) rc.textContent = 'Savings roadmap to ' + fmtM(target) + ' by age ' + retireAge + ' — ' + pace;
      const rcs = road.querySelector('.cs');
      if (rcs) rcs.textContent = projected >= target
        ? 'At current savings pace you are on track — figures below compound at ' + gPct + '%/yr to age ' + retireAge
        : 'At current savings pace you fall short of the minimum target — consider higher contributions or a later retirement date';
      const kv = road.querySelector('.kv');
      if (kv) {
        const rows = [[
          fmtM(ctx.currentPortfolio) + ' current at ' + gPct + '% for ' + ctx.yearsToRetire + ' years',
          fmtM(ctx.baseFV),
        ]];
        if (ctx.c401kFV > 0) rows.push(['401k contributions (' + fmtK(ctx.c401k) + '/yr, compounded)', '+' + fmtK(ctx.c401kFV)]);
        if (ctx.cIraFV > 0)  rows.push(['IRA contributions (' + fmtK(ctx.cIra) + '/yr, compounded)', '+' + fmtK(ctx.cIraFV)]);
        if (ctx.cHsaFV > 0)  rows.push(['HSA contributions (' + fmtK(ctx.cHsa) + '/yr, compounded)', '+' + fmtK(ctx.cHsaFV)]);
        let html = rows.map(function (r) {
          return '<span class="kv-k">' + r[0] + '</span><span class="kv-v">' + r[1] + '</span>';
        }).join('');
        html += '<span class="kv-k kv-sep" style="font-weight:600;color:var(--text)">Projected at retirement (age '
          + retireAge + ')</span><span class="kv-sep-g">' + fmtM(projected) + '</span>';
        html += '<span class="kv-k">Minimum target needed (4% SWR on ' + fmtK(ctx.spendNow)
          + '/yr spend)</span><span class="kv-v b">' + fmtM(target) + '</span>';
        kv.innerHTML = html;
      }
      const note = road.querySelector('.ib');
      if (note) {
        if (projected >= target) {
          note.className = 'ib ib-g';
          note.textContent = 'On track. The ~' + fmtK(projected - target)
            + ' surplus above the minimum target means you can retire earlier if you '
            + 'choose, increase spending in early retirement, fund legacy goals, or '
            + 'carry extra cushion as a margin of safety.';
        } else {
          note.className = 'ib ib-a';
          note.textContent = 'Behind target by ~' + fmtK(target - projected)
            + '. Options: increase contributions, extend the retirement date, or reduce '
            + 'the spending target — small changes compound significantly over '
            + ctx.yearsToRetire + ' years.';
        }
      }
    }
  }

  // ---------- slider mirror (Phase 2 — unchanged) ----------
  function wireSlider() {
    const slider = document.getElementById('balSlider');
    if (!slider) return;

    const stored = store.get('retirement.balances.total');
    if (typeof stored === 'number' && stored > 0) {
      const min = Number(slider.min) || 100;
      const max = Number(slider.max) || 4000;
      const step = Number(slider.step) || 50;
      const inK = Math.round(stored / 1000 / step) * step;
      slider.value = String(Math.max(min, Math.min(max, inK)));
      if (typeof window.updateRMD === 'function') {
        try { window.updateRMD(); } catch (e) { /* ignore */ }
      }
    }

    let timer = null;
    let lastWritten = null;
    slider.addEventListener('input', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const dollars = (parseInt(slider.value, 10) || 0) * 1000;
        if (dollars === lastWritten) return;
        lastWritten = dollars;
        const opts = { editedBy: EDITED_BY };
        store.set('retirement.balances.total', dollars, opts);
        store.set('retirement.balances.breakdown.traditionalIRA', dollars, opts);
      }, DEBOUNCE_MS);
    });
  }

  // ---------- "Adopt actual spend" (Phase 9) ----------
  // Trailing-12-month average monthly spend from the Expense Tracker,
  // offered as the annualExpenses assumption instead of a hand-typed guess.
  function computeActualAnnualSpend() {
    const txns = store.get('expenses.transactions');
    if (!Array.isArray(txns) || txns.length === 0) return null;

    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    const byMonth = {};
    for (const t of txns) {
      if (typeof t.date !== 'string' || t.date.length < 7) continue;
      const d = new Date(t.date + 'T00:00:00');
      if (isNaN(d) || d < cutoff) continue;
      const ym = t.date.slice(0, 7);
      byMonth[ym] = (byMonth[ym] || 0) - (Number(t.amount) || 0);
    }
    const months = Object.values(byMonth).filter((v) => v > 0);
    if (months.length === 0) return null;
    const avgMonthly = months.reduce((a, b) => a + b, 0) / months.length;
    return { annual: Math.round(avgMonthly * 12), monthsOfData: months.length };
  }

  function renderAdoptSpendButton() {
    const existing = document.getElementById('ws-adopt-spend');
    const actual = computeActualAnnualSpend();
    if (!actual) { if (existing) existing.remove(); return; }

    const current = store.get('retirement.plan.annualExpenses');
    const adopted = current != null && Math.abs(Number(current) - actual.annual) < 1;

    let el = existing;
    if (!el) {
      const anchor = document.querySelector('.hdr-l p');
      if (!anchor) return;
      el = document.createElement('button');
      el.id = 'ws-adopt-spend';
      el.type = 'button';
      el.style.cssText = [
        'display:inline-flex', 'align-items:center', 'gap:6px',
        'margin-top:8px', 'padding:4px 12px', 'font:500 12px Inter,sans-serif',
        'border-radius:999px', 'cursor:pointer',
        'border:1px solid var(--md-sys-color-outline-variant,#34353B)',
        'background:var(--md-sys-color-surface-container-high,#26272D)',
        'color:var(--md-sys-color-on-surface,#E2E2E9)',
      ].join(';');
      el.addEventListener('click', () => {
        const a = computeActualAnnualSpend();
        if (!a) return;
        store.set('retirement.plan.annualExpenses', a.annual, { editedBy: EDITED_BY });
        seedProjections();
        renderAdoptSpendButton();
      });
      anchor.insertAdjacentElement('afterend', el);
    }

    el.disabled = adopted;
    el.style.opacity = adopted ? '0.6' : '1';
    el.style.cursor = adopted ? 'default' : 'pointer';
    el.textContent = adopted
      ? '✓ Using actual spend ' + fmtMoney(actual.annual) + '/yr from Expense Tracker'
      : 'Adopt actual spend: ' + fmtMoney(actual.annual) + '/yr (' + actual.monthsOfData + '-mo avg from Expense Tracker)';
  }

  // ---------- household banner ----------
  function renderHouseholdBanner() {
    var WS = window.WealthSuite;
    if (!WS || !WS.renderHouseholdBanner) return;
    WS.renderHouseholdBanner({
      anchor: '.hdr-l p',
      fields: ['portfolio', 'expenses', 'income', 'contributions', 'ages'],
    });
  }

  // ---------- bootstrap ----------
  function init() {
    seedProjections();
    wireSlider();
    renderHouseholdBanner();
    renderAdoptSpendButton();
    store.subscribe('', renderHouseholdBanner);
    store.subscribe('expenses', renderAdoptSpendButton);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.WealthSuite._retirementAdapter = { seedProjections, renderHouseholdBanner };
})();
