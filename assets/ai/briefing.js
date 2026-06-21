/* =============================================================
 * Wealth Suite — Daily briefing, computed layer (Phase 10)
 *
 * Renders a market briefing card at the top of the dashboard:
 *   - portfolio value, day $ / %, vs S&P 500
 *   - week / MTD / YTD returns
 *   - today's biggest mover among holdings
 *   - S&P 500 + QQQ benchmark day moves
 *
 * Narrative layer (Phase 11): when preferences.aiProvider === 'gemini'
 * and a key is present, a 2-sentence Gemini Flash summary of the
 * computed stats is appended to the card, cached per trading day in
 * localStorage.wealthSuite.briefingNarrative. 'off' and 'local'
 * providers skip it (booting a 1.7GB local model for one line is
 * not worth it). Quote series come from the
 * Yahoo Finance v8 chart endpoint (public market data only; no
 * personal info leaves the browser). Per-ticker series are cached
 * in sessionStorage for 15 min; the last fully-computed stats are
 * kept in localStorage so a fetch outage degrades to a stale view
 * instead of an empty card.
 *
 * With no holdings in the store the card runs in benchmark-only
 * mode with a hint to import holdings in the Portfolio Tracker.
 * ============================================================= */
(function () {
  'use strict';

  const mount = document.getElementById('suite-briefing');
  if (!mount) return;
  const store = window.WealthSuite && window.WealthSuite.store;

  const SERIES_TTL_MS = 15 * 60 * 1000;
  // Cloudflare Worker that proxies Yahoo with CORS (see worker/README.md).
  // Set to your deployed URL (no trailing slash) for reliable quotes; leave ''
  // to fall back to the public CORS-proxy chain.
  const QUOTE_WORKER = '';
  const STATS_KEY = 'wealthSuite.briefingStats';
  const BENCHMARKS = [
    { sym: '^GSPC', label: 'S&P 500' },
    { sym: 'QQQ',   label: 'QQQ' },
  ];

  // ---------- formatters ----------
  const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const fmt$ = (n) => (n == null || !Number.isFinite(n)) ? '—' : usd0.format(n);
  const sign$ = (n) => (n == null || !Number.isFinite(n)) ? '—' : (n >= 0 ? '+' : '−') + usd0.format(Math.abs(n));
  const signPct = (n, dp) => (n == null || !Number.isFinite(n)) ? '—' : (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(dp == null ? 2 : dp) + '%';
  const toneClass = (n) => (n == null || !Number.isFinite(n)) ? '' : (n >= 0 ? 'is-up' : 'is-down');

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Yahoo's public endpoint sends no Access-Control-Allow-Origin header, so
  // direct fetches are blocked from a browser. Try direct first (cheap, fails
  // fast), then relay through public CORS proxies. Only public ticker symbols
  // leave the browser — never balances or holdings. Returns parsed JSON or null.
  function yahooUrls(path) {
    const direct1 = `https://query1.finance.yahoo.com/${path}`;
    const direct2 = `https://query2.finance.yahoo.com/${path}`;
    const enc = encodeURIComponent(direct1);
    return [
      ...(QUOTE_WORKER ? [`${QUOTE_WORKER}/${path}`] : []),
      direct2,
      direct1,
      `https://api.allorigins.win/raw?url=${enc}`,
      `https://api.codetabs.com/v1/proxy/?quest=${enc}`,
    ];
  }

  async function fetchYahoo(path) {
    for (const url of yahooUrls(path)) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const json = await res.json();
        if (json && json.chart) return json;
      } catch (_) { /* try next candidate */ }
    }
    return null;
  }

  // ---------- Yahoo series fetch ----------
  async function fetchSeries(ticker) {
    const key = `yfb_${ticker.toUpperCase()}`;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < SERIES_TTL_MS) return data;
      }
    } catch (_) {}

    const path = `v8/finance/chart/${encodeURIComponent(ticker.toUpperCase())}?interval=1d&range=1y`;
    const json = await fetchYahoo(path);
    const result = json && json.chart && json.chart.result && json.chart.result[0];
    const meta = result && result.meta;
    if (!meta || !meta.regularMarketPrice) return null;

    const ts = (result.timestamp || []);
    const closes = ((result.indicators && result.indicators.quote && result.indicators.quote[0]) || {}).close || [];
    const series = [];
    for (let i = 0; i < ts.length; i++) {
      if (closes[i] != null) series.push({ t: ts[i] * 1000, c: closes[i] });
    }
    const prev = meta.previousClose || meta.chartPreviousClose
      || (series.length > 1 ? series[series.length - 2].c : meta.regularMarketPrice);
    const data = {
      price: meta.regularMarketPrice,
      prevClose: prev,
      marketTime: (meta.regularMarketTime || 0) * 1000,
      name: meta.shortName || meta.longName || ticker.toUpperCase(),
      series,
    };
    try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch (_) {}
    return data;
  }

  // Last close at-or-before a timestamp; null if series doesn't reach back.
  function closeBefore(series, ms) {
    let best = null;
    for (const p of series) {
      if (p.t <= ms) best = p.c;
      else break;
    }
    return best;
  }

  function periodAnchors() {
    const now = new Date();
    return {
      week: now.getTime() - 7 * 86400000,
      mtd: new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1,
      ytd: new Date(now.getFullYear(), 0, 1).getTime() - 1,
    };
  }

  function pct(cur, base) {
    return (base && Number.isFinite(base)) ? ((cur - base) / base) * 100 : null;
  }

  // ---------- stats computation ----------
  async function computeStats() {
    const holdings = (store && store.get('portfolio.holdings')) || [];
    const valid = holdings.filter((h) => h && h.ticker && Number(h.shares) > 0);
    const anchors = periodAnchors();

    const tickers = [...new Set(valid.map((h) => h.ticker.toUpperCase()))];
    const symbols = [...tickers, ...BENCHMARKS.map((b) => b.sym)];
    const fetched = await Promise.all(symbols.map(fetchSeries));
    const bySym = {};
    symbols.forEach((s, i) => { bySym[s] = fetched[i]; });

    const benchmarks = BENCHMARKS.map((b) => {
      const d = bySym[b.sym];
      return {
        label: b.label,
        dayPct: d ? pct(d.price, d.prevClose) : null,
        ytdPct: d ? pct(d.price, closeBefore(d.series, anchors.ytd)) : null,
        marketTime: d ? d.marketTime : null,
      };
    });

    let portfolio = null;
    let mover = null;
    let missing = 0;

    if (valid.length) {
      let value = 0, prevValue = 0, weekValue = 0, mtdValue = 0, ytdValue = 0;
      let weekOk = true, mtdOk = true, ytdOk = true;

      for (const h of valid) {
        const shares = Number(h.shares);
        const d = bySym[h.ticker.toUpperCase()];
        if (!d) missing++;
        const price = d ? d.price : (Number(h.currentPrice) || null);
        if (price == null) continue;
        value += shares * price;
        prevValue += shares * (d ? d.prevClose : price);

        const wk = d ? closeBefore(d.series, anchors.week) : null;
        const mt = d ? closeBefore(d.series, anchors.mtd) : null;
        const yt = d ? closeBefore(d.series, anchors.ytd) : null;
        if (wk != null) weekValue += shares * wk; else weekOk = false;
        if (mt != null) mtdValue += shares * mt; else mtdOk = false;
        if (yt != null) ytdValue += shares * yt; else ytdOk = false;

        const dayPct = d ? pct(d.price, d.prevClose) : null;
        if (dayPct != null && (!mover || Math.abs(dayPct) > Math.abs(mover.dayPct))) {
          mover = { ticker: h.ticker.toUpperCase(), dayPct };
        }
      }

      const dayPct = pct(value, prevValue);
      portfolio = {
        value,
        day$: value - prevValue,
        dayPct,
        weekPct: weekOk ? pct(value, weekValue) : null,
        mtdPct: mtdOk ? pct(value, mtdValue) : null,
        ytdPct: ytdOk ? pct(value, ytdValue) : null,
        vsSpxBps: (dayPct != null && benchmarks[0].dayPct != null)
          ? Math.round((dayPct - benchmarks[0].dayPct) * 100) : null,
        holdingCount: valid.length,
        missing,
      };
    }

    // Portfolio counts as data only if at least one holding had a live
    // quote — all-fallback prices would render a misleading flat day.
    const anyData = benchmarks.some((b) => b.dayPct != null)
      || (portfolio && missing < valid.length);
    if (!anyData) return null;

    const stats = { computedAt: Date.now(), portfolio, mover, benchmarks };
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (_) {}
    return stats;
  }

  // ---------- narrative layer (Gemini only) ----------
  const NARRATIVE_KEY = 'wealthSuite.briefingNarrative';

  function tradingDayOf(stats) {
    const t = stats.benchmarks && stats.benchmarks[0] && stats.benchmarks[0].marketTime;
    return new Date(t || stats.computedAt).toDateString();
  }

  function showNarrative(text) {
    const card = mount.querySelector('.suite-briefing__card');
    if (!card || card.querySelector('.suite-briefing__narrative')) return;
    const p = document.createElement('p');
    p.className = 'suite-briefing__narrative';
    p.textContent = text;
    card.appendChild(p);
  }

  async function maybeNarrative(stats) {
    if (!store || store.get('preferences.aiProvider') !== 'gemini') return;
    let key = '';
    try { key = localStorage.getItem('wealthSuite.aiKey') || ''; } catch (_) {}
    if (!key) return;

    const day = tradingDayOf(stats);
    try {
      const cached = JSON.parse(localStorage.getItem(NARRATIVE_KEY));
      if (cached && cached.day === day && cached.text) { showNarrative(cached.text); return; }
    } catch (_) {}

    const prompt = [
      'Write a 2-sentence plain-text market briefing for a personal-finance dashboard. No preamble, no markdown.',
      'Cover the portfolio day move vs the S&P 500 and, if notable, the top mover or a period return. Round numbers conversationally.',
      `Stats: ${JSON.stringify({
        portfolio: stats.portfolio, mover: stats.mover, benchmarks: stats.benchmarks,
      })}`,
    ].join('\n');

    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      if (!res.ok) return;
      const json = await res.json();
      const parts = (((json.candidates || [])[0] || {}).content || {}).parts || [];
      const text = parts.map((p) => p.text || '').join('').trim();
      if (!text) return;
      try { localStorage.setItem(NARRATIVE_KEY, JSON.stringify({ day, text })); } catch (_) {}
      showNarrative(text);
    } catch (_) { /* narrative is best-effort */ }
  }

  // ---------- render ----------
  function chip(label, value, tone) {
    return `<span class="suite-briefing__chip"><span class="suite-briefing__chip-label">${label}</span><strong class="${tone || ''}">${value}</strong></span>`;
  }

  function dateLabel() {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function render(stats, stale) {
    const p = stats.portfolio;
    const benchChips = stats.benchmarks
      .filter((b) => b.dayPct != null)
      .map((b) => chip(escapeHtml(b.label), signPct(b.dayPct), toneClass(b.dayPct)))
      .join('');

    let main;
    if (p) {
      const vsSpx = p.vsSpxBps == null ? '' :
        `<span class="suite-briefing__vs">${p.vsSpxBps >= 0 ? 'leading' : 'trailing'} S&P 500 by ${Math.abs(p.vsSpxBps)} bps</span>`;
      main = `
        <div class="suite-briefing__main">
          <span class="suite-briefing__value">${fmt$(p.value)}</span>
          <span class="suite-briefing__day ${toneClass(p.day$)}">${sign$(p.day$)} (${signPct(p.dayPct)})</span>
          ${vsSpx}
        </div>
        <div class="suite-briefing__chips">
          ${p.weekPct != null ? chip('Week', signPct(p.weekPct, 1), toneClass(p.weekPct)) : ''}
          ${p.mtdPct != null ? chip('MTD', signPct(p.mtdPct, 1), toneClass(p.mtdPct)) : ''}
          ${p.ytdPct != null ? chip('YTD', signPct(p.ytdPct, 1), toneClass(p.ytdPct)) : ''}
          ${stats.mover ? chip('Top mover', `${escapeHtml(stats.mover.ticker)} ${signPct(stats.mover.dayPct, 1)}`, toneClass(stats.mover.dayPct)) : ''}
          ${benchChips}
        </div>`;
    } else {
      main = `
        <div class="suite-briefing__chips">${benchChips}</div>
        <p class="suite-briefing__hint">Import holdings in the <a href="portfolio_tracker.html">Portfolio Tracker</a> to see portfolio-level performance here.</p>`;
    }

    const staleNote = stale
      ? `<span class="suite-briefing__stale">as of ${new Date(stats.computedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} — live quotes unavailable</span>`
      : '';

    mount.innerHTML = `
      <div class="suite-briefing__card">
        <div class="suite-briefing__head">
          <span class="suite-briefing__date">${dateLabel()}</span>
          ${p && p.missing ? `<span class="suite-briefing__stale">${p.missing} holding${p.missing === 1 ? '' : 's'} without quotes</span>` : ''}
          ${staleNote}
        </div>
        ${main}
      </div>`;
  }

  function renderSkeleton() {
    mount.innerHTML = `
      <div class="suite-briefing__card is-loading" aria-hidden="true">
        <div class="suite-briefing__skel" style="width:140px"></div>
        <div class="suite-briefing__skel suite-briefing__skel--lg" style="width:300px"></div>
        <div class="suite-briefing__skel" style="width:420px"></div>
      </div>`;
  }

  // ---------- bootstrap ----------
  async function init() {
    renderSkeleton();
    let stats = null;
    try { stats = await computeStats(); } catch (_) {}
    if (stats) { render(stats, false); maybeNarrative(stats); return; }

    // Network failed entirely — fall back to today's cached stats if any.
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (new Date(cached.computedAt).toDateString() === new Date().toDateString()) {
          render(cached, true);
          return;
        }
      }
    } catch (_) {}

    // Total outage, no usable cache — collapse the section silently rather
    // than showing an outage note. It reappears automatically once quotes load.
    mount.innerHTML = '';
    mount.hidden = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
