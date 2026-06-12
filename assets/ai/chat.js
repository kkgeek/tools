/* =============================================================
 * Wealth Suite — GenAI chat (Phase 11)
 *
 * Conversational interface grounded on suite-store data via a
 * read-only tool registry. Two providers:
 *
 *   GeminiProvider — Gemini 2.5 Flash, direct browser fetch with
 *     native function calling. Requires a user-supplied API key,
 *     kept at localStorage['wealthSuite.aiKey'] (deliberately NOT
 *     in the store: export() would leak it into backup JSON).
 *
 *   WebLLMProvider — Llama 3.2 3B Instruct via @mlc-ai/web-llm,
 *     lazy-loaded from CDN on first use (~1.7GB model download,
 *     then cached by the browser). 3B models are unreliable at
 *     function-call protocols, so instead of tool calling the
 *     provider stuffs every tool slice (~5KB) into the system
 *     prompt — same grounding, zero data leaves the device.
 *
 * Privacy default: preferences.aiProvider === 'off'. The panel
 * shows an enable CTA; choosing Gemini in settings displays an
 * explicit consent note before the key can be saved.
 *
 * Conversation history lives in sessionStorage (not exported).
 * ============================================================= */
(function () {
  'use strict';

  const mount = document.getElementById('suite-chat');
  if (!mount) return;
  const store = window.WealthSuite && window.WealthSuite.store;
  if (!store) return;

  const KEY_STORAGE = 'wealthSuite.aiKey';
  const HISTORY_KEY = 'wealthSuite.chatHistory';
  const GEMINI_MODEL = 'gemini-2.5-flash';
  const WEBLLM_MODEL = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
  const MAX_TURNS = 12;          // messages sent to the model
  const MAX_TOOL_ROUNDS = 4;

  const SUGGESTED = [
    'Am I on track to retire?',
    'Where is my biggest spend leak this month?',
    'How is my portfolio allocated?',
  ];

  // ---------- small utils ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Minimal markdown: bold, inline code, bullet lines, paragraphs.
  // Input is escaped first, so the only HTML present is what we add.
  function renderMarkdown(text) {
    const esc = escapeHtml(text);
    const lines = esc.split(/\r?\n/);
    const out = [];
    let inList = false;
    for (const raw of lines) {
      const line = raw
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
      const m = line.match(/^\s*[-*•]\s+(.*)$/);
      if (m) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push(`<li>${m[1]}</li>`);
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        if (line.trim()) out.push(`<p>${line}</p>`);
      }
    }
    if (inList) out.push('</ul>');
    return out.join('');
  }

  function getKey() {
    try { return localStorage.getItem(KEY_STORAGE) || ''; } catch (_) { return ''; }
  }
  function setKey(k) {
    try { k ? localStorage.setItem(KEY_STORAGE, k) : localStorage.removeItem(KEY_STORAGE); } catch (_) {}
  }
  function maskKey(k) {
    return k ? '••••••••' + k.slice(-4) : '';
  }
  function getProvider() {
    return store.get('preferences.aiProvider') || 'off';
  }

  function loadHistory() {
    try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY)) || []; } catch (_) { return []; }
  }
  function saveHistory(h) {
    try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch (_) {}
  }

  function num(v) { return (v == null || v === '') ? null : Number(v); }
  function sumSpouse(o) {
    if (!o) return 0;
    return (num(o.s1) || 0) + (num(o.s2) || 0);
  }

  // ---------- tool registry (read-only store slices) ----------
  const TOOLS = [
    {
      name: 'getHousehold',
      description: 'Household profile: spouses with names and ages, tax filing status, state of residence.',
      run() {
        const h = store.get('household') || {};
        return {
          filingStatus: h.filingStatus,
          spouses: (h.spouses || []).filter((s) => s && (s.name || s.age != null)),
          state: h.location && h.location.state,
        };
      },
    },
    {
      name: 'getIncome',
      description: 'Annual income: salary, bonus, RSU vests per spouse, and short/long-term capital gains. USD.',
      run() {
        const inc = store.get('income') || {};
        return {
          salary: inc.salary, bonus: inc.bonus, rsuVests: inc.rsuVests,
          capitalGains: inc.capitalGains,
          totalCompensation: sumSpouse(inc.salary) + sumSpouse(inc.bonus) + sumSpouse(inc.rsuVests),
        };
      },
    },
    {
      name: 'getRetirementPlan',
      description: 'Retirement plan: target retirement age, planned annual expenses in retirement, growth assumption, current retirement balances, and this year\'s contributions.',
      run() {
        const r = store.get('retirement') || {};
        return { plan: r.plan, balances: r.balances, contributions: r.contributions };
      },
    },
    {
      name: 'getPortfolioHoldings',
      description: 'Investment portfolio: total value, asset-class allocations, and every holding with ticker, shares, current price and market value.',
      run() {
        const p = store.get('portfolio') || {};
        const holdings = (p.holdings || []).map((h) => ({
          ticker: h.ticker, name: h.name, shares: num(h.shares),
          currentPrice: num(h.currentPrice),
          value: (num(h.shares) || 0) * (num(h.currentPrice) || 0),
          costBasis: num(h.costBasis), assetClass: h.assetClass,
        }));
        return { totalValue: p.totalValue, allocations: p.allocations, holdings };
      },
    },
    {
      name: 'getSpending',
      description: 'Last 6 months of actual spending from the Expense Tracker: monthly totals and per-category totals with monthly budgets. Negative transaction amounts are expenses.',
      run() {
        const ex = store.get('expenses') || {};
        const txns = ex.transactions || [];
        const cats = ex.categories || [];
        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        const byMonth = {}; const byCategory = {};
        for (const t of txns) {
          const ym = String(t.date || '').slice(0, 7);
          if (!months.includes(ym)) continue;
          const spend = -Number(t.amount) || 0;
          byMonth[ym] = (byMonth[ym] || 0) + spend;
          byCategory[t.category || 'other'] = (byCategory[t.category || 'other'] || 0) + spend;
        }
        for (const k of Object.keys(byMonth)) byMonth[k] = Math.round(byMonth[k]);
        for (const k of Object.keys(byCategory)) byCategory[k] = Math.round(byCategory[k]);
        return {
          monthsCovered: months,
          totalByMonth: byMonth,
          totalByCategory: byCategory,
          budgets: cats.filter((c) => c.budgetMonthly != null)
            .map((c) => ({ category: c.id, budgetMonthly: c.budgetMonthly })),
          transactionCount: txns.length,
        };
      },
    },
    {
      name: 'getNetWorth',
      description: 'Net worth: investment portfolio value, retirement balances, manual assets (real estate, vehicles, other), and liabilities.',
      run() {
        const assets = store.get('assets') || {};
        const liab = store.get('liabilities') || {};
        const portfolio = num(store.get('portfolio.totalValue')) || 0;
        const manual = (num(assets.realEstate) || 0) + (num(assets.vehicles) || 0) + (num(assets.other) || 0);
        const liabilities = num(liab.total) || 0;
        return {
          portfolioValue: portfolio || null,
          manualAssets: assets,
          liabilities: liab,
          netWorth: (portfolio + manual - liabilities) || null,
        };
      },
    },
    {
      name: 'getTaxEstimate',
      description: 'Tax inputs: tax year, filing status, income totals and deductions. NOTE: the computed federal/state projection is not stored — it lives in the Tax Estimator tool (TaxEstimatorV5.html).',
      run() {
        const inc = store.get('income') || {};
        return {
          taxYear: store.get('preferences.taxYear'),
          filingStatus: store.get('household.filingStatus'),
          state: store.get('household.location.state'),
          incomeTotal: sumSpouse(inc.salary) + sumSpouse(inc.bonus) + sumSpouse(inc.rsuVests),
          capitalGains: inc.capitalGains,
          deductions: store.get('deductions'),
          note: 'Computed tax projection is not stored in the suite; direct the user to the Tax Estimator tool for the full bracket-level estimate.',
        };
      },
    },
    {
      name: 'getRothSchedule',
      description: 'Roth conversion schedule, if the user has built one.',
      run() {
        const sched = store.get('retirement.plan.rothConversionSchedule');
        return sched || { available: false, note: 'No conversion schedule stored. The user can build one in the Roth Conversion Planner (roth_conversion.html).' };
      },
    },
    {
      name: 'getMonteCarloResults',
      description: 'Monte Carlo retirement simulation results (p10/p50/p90), if available.',
      run() {
        return { available: false, note: 'Simulation results are not stored in the suite. The user can run projections in Monte Carlo Projections (monte_carlo.html), seeded from their plan.' };
      },
    },
  ];

  function runTool(name) {
    const t = TOOLS.find((x) => x.name === name);
    if (!t) return { error: `unknown tool ${name}` };
    try { return t.run(); } catch (e) { return { error: String(e && e.message) }; }
  }

  function systemPrompt() {
    return [
      'You are the Wealth Suite assistant, embedded in a private personal-finance dashboard that runs entirely in the user\'s browser.',
      'Answer questions about the user\'s finances using the read-only data tools. Call tools rather than guessing; if data is missing or null, say so and point to the suite tool where the user can enter it.',
      'All amounts are USD. Be concise: a short answer first, then at most a few supporting bullets. Round dollar figures sensibly.',
      'You may do arithmetic (totals, percentages, simple projections) but state your assumptions. You are not a licensed financial advisor; for major decisions suggest the relevant suite tool for deeper modeling.',
      `Today's date: ${new Date().toDateString()}.`,
    ].join(' ');
  }

  // ---------- providers ----------
  class GeminiProvider {
    constructor(key) { this.key = key; }

    async ask(history, onStatus) {
      const contents = history.slice(-MAX_TURNS).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));
      const used = [];

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key },
            signal: AbortSignal.timeout(45000),
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt() }] },
              contents,
              tools: [{ functionDeclarations: TOOLS.map((t) => ({ name: t.name, description: t.description })) }],
            }),
          }
        );
        if (res.status === 400 || res.status === 403) throw new Error('Gemini rejected the API key. Check it in chat settings.');
        if (res.status === 429) throw new Error('Gemini rate limit reached (free tier is 15 requests/min). Try again in a minute.');
        if (!res.ok) throw new Error(`Gemini error ${res.status}.`);
        const json = await res.json();
        const cand = json.candidates && json.candidates[0];
        const parts = (cand && cand.content && cand.content.parts) || [];
        const calls = parts.filter((p) => p.functionCall);

        if (!calls.length) {
          const text = parts.map((p) => p.text || '').join('').trim();
          if (!text) throw new Error('Gemini returned an empty answer. Try rephrasing.');
          return { text, used };
        }

        contents.push(cand.content);
        const responses = calls.map((p) => {
          used.push(p.functionCall.name);
          return {
            functionResponse: {
              name: p.functionCall.name,
              response: { result: runTool(p.functionCall.name) },
            },
          };
        });
        contents.push({ role: 'user', parts: responses });
        onStatus(`Looking up ${calls.map((p) => p.functionCall.name).join(', ')}…`);
      }
      throw new Error('Too many tool-call rounds — try a more specific question.');
    }
  }

  class WebLLMProvider {
    async ensureEngine(onStatus) {
      if (this.engine) return;
      if (!this.enginePromise) {
        this.enginePromise = (async () => {
          onStatus('Loading WebLLM runtime…');
          const webllm = await import('https://esm.run/@mlc-ai/web-llm');
          return webllm.CreateMLCEngine(WEBLLM_MODEL, {
            initProgressCallback: (p) => onStatus(p.text || 'Preparing local model…'),
          });
        })();
      }
      this.engine = await this.enginePromise;
    }

    async ask(history, onStatus) {
      await this.ensureEngine(onStatus);
      onStatus('Thinking locally…');
      // 3B models are unreliable at function-call protocols — ground by
      // stuffing every tool slice into the system prompt instead.
      const ctx = TOOLS.map((t) => `### ${t.name}\n${JSON.stringify(runTool(t.name))}`).join('\n');
      const messages = [
        { role: 'system', content: `${systemPrompt()}\n\nThe user's current financial data (all local to this device):\n${ctx}` },
        ...history.slice(-MAX_TURNS).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
      ];
      const reply = await this.engine.chat.completions.create({ messages, temperature: 0.4, max_tokens: 600 });
      const text = (reply.choices[0].message.content || '').trim();
      if (!text) throw new Error('The local model returned an empty answer.');
      return { text, used: ['local data snapshot'] };
    }
  }

  const webllmProvider = new WebLLMProvider();   // engine survives provider switches
  function makeProvider() {
    return getProvider() === 'local' ? webllmProvider : new GeminiProvider(getKey());
  }

  // ---------- UI ----------
  let history = loadHistory();
  let busy = false;

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function providerBadge() {
    const p = getProvider();
    if (p === 'gemini') return 'Gemini 2.5 Flash · data sent to Google';
    if (p === 'local')  return 'Local · Llama 3.2 3B · nothing leaves this device';
    return '';
  }

  function render() {
    const p = getProvider();
    if (p === 'off') { renderDisabled(); return; }
    renderPanel();
  }

  function renderDisabled() {
    mount.innerHTML = '';
    mount.appendChild(el(`
      <div class="suite-chat__card suite-chat__card--off">
        <div class="suite-chat__off-text">
          <h4 class="suite-chat__title">Ask anything about your finances</h4>
          <p class="suite-chat__desc">Chat with an AI grounded on your suite data — retirement readiness, spending, allocation. Off by default; nothing is sent anywhere until you enable it.</p>
        </div>
        <button type="button" class="suite-chat__enable">Enable AI chat</button>
      </div>`));
    mount.querySelector('.suite-chat__enable').addEventListener('click', openSettings);
  }

  function renderPanel() {
    mount.innerHTML = '';
    const card = el(`
      <div class="suite-chat__card">
        <div class="suite-chat__head">
          <h4 class="suite-chat__title">Ask anything about your finances</h4>
          <div class="suite-chat__head-actions">
            <span class="suite-chat__badge">${escapeHtml(providerBadge())}</span>
            <button type="button" class="suite-chat__icon-btn" data-act="clear" title="Clear conversation" aria-label="Clear conversation">⌫</button>
            <button type="button" class="suite-chat__icon-btn" data-act="settings" title="Chat settings" aria-label="Chat settings">⚙</button>
          </div>
        </div>
        <div class="suite-chat__messages" role="log" aria-live="polite"></div>
        <div class="suite-chat__suggested"></div>
        <form class="suite-chat__form">
          <input type="text" class="suite-chat__input" placeholder="e.g. Am I on track to retire at 62?" autocomplete="off" aria-label="Ask a question">
          <button type="submit" class="suite-chat__send">Ask</button>
        </form>
      </div>`);
    mount.appendChild(card);

    card.querySelector('[data-act="settings"]').addEventListener('click', openSettings);
    card.querySelector('[data-act="clear"]').addEventListener('click', () => {
      history = []; saveHistory(history); renderMessages();
    });

    const sugg = card.querySelector('.suite-chat__suggested');
    if (!history.length) {
      for (const s of SUGGESTED) {
        const b = el(`<button type="button" class="suite-chat__prompt">${escapeHtml(s)}</button>`);
        b.addEventListener('click', () => send(s));
        sugg.appendChild(b);
      }
    }

    card.querySelector('.suite-chat__form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = card.querySelector('.suite-chat__input');
      const q = input.value.trim();
      if (q) { input.value = ''; send(q); }
    });

    renderMessages();
  }

  function renderMessages() {
    const box = mount.querySelector('.suite-chat__messages');
    if (!box) return;
    box.innerHTML = '';
    for (const m of history) {
      if (m.role === 'user') {
        box.appendChild(el(`<div class="suite-chat__msg suite-chat__msg--user">${escapeHtml(m.text)}</div>`));
      } else {
        const msg = el(`<div class="suite-chat__msg suite-chat__msg--ai"></div>`);
        msg.appendChild(el(`<div class="suite-chat__msg-body">${renderMarkdown(m.text)}</div>`));
        const meta = el(`<div class="suite-chat__msg-meta"></div>`);
        if (m.tools && m.tools.length) {
          meta.appendChild(el(`<span class="suite-chat__tools">Used: ${escapeHtml([...new Set(m.tools)].join(', '))}</span>`));
        }
        const copy = el(`<button type="button" class="suite-chat__copy">Copy</button>`);
        copy.addEventListener('click', () => {
          navigator.clipboard && navigator.clipboard.writeText(m.text).then(() => {
            copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
          });
        });
        meta.appendChild(copy);
        msg.appendChild(meta);
        box.appendChild(msg);
      }
    }
    const sugg = mount.querySelector('.suite-chat__suggested');
    if (sugg && history.length) sugg.innerHTML = '';
    box.scrollTop = box.scrollHeight;
  }

  async function send(question) {
    if (busy) return;
    busy = true;
    history.push({ role: 'user', text: question });
    saveHistory(history);
    renderMessages();

    const box = mount.querySelector('.suite-chat__messages');
    const status = el(`<div class="suite-chat__msg suite-chat__msg--ai suite-chat__msg--status">Thinking…</div>`);
    box.appendChild(status);
    box.scrollTop = box.scrollHeight;
    const onStatus = (t) => { status.textContent = t; box.scrollTop = box.scrollHeight; };

    try {
      const { text, used } = await makeProvider().ask(history, onStatus);
      history.push({ role: 'ai', text, tools: used });
    } catch (e) {
      history.push({ role: 'ai', text: `⚠ ${e && e.message ? e.message : 'Something went wrong.'}`, tools: [] });
    }
    saveHistory(history);
    busy = false;
    renderMessages();
  }

  // ---------- settings modal ----------
  function openSettings() {
    const cur = getProvider();
    const key = getKey();
    const overlay = el(`
      <div class="suite-chat__overlay" role="dialog" aria-modal="true" aria-label="AI chat settings">
        <div class="suite-chat__modal">
          <h4 class="suite-chat__title">AI chat settings</h4>

          <label class="suite-chat__opt">
            <input type="radio" name="ws-ai-provider" value="off" ${cur === 'off' ? 'checked' : ''}>
            <span><strong>Off</strong> — no AI, no data sent anywhere. (Default)</span>
          </label>

          <label class="suite-chat__opt">
            <input type="radio" name="ws-ai-provider" value="gemini" ${cur === 'gemini' ? 'checked' : ''}>
            <span><strong>Gemini 2.5 Flash</strong> — best answers, needs a free Google AI API key.</span>
          </label>
          <div class="suite-chat__opt-detail" data-for="gemini" ${cur === 'gemini' ? '' : 'hidden'}>
            <p class="suite-chat__consent">Your financial data (the slices needed to answer each question) will be sent to Google's Gemini API. You can switch to the local model at any time.</p>
            <input type="password" class="suite-chat__key" placeholder="${key ? 'Current: ' + maskKey(key) : 'Paste Gemini API key (AIza…)'}" autocomplete="off" aria-label="Gemini API key">
            <p class="suite-chat__hint-sm">Free key at aistudio.google.com → "Get API key". Stored only in this browser's localStorage; never included in suite exports.</p>
          </div>

          <label class="suite-chat__opt">
            <input type="radio" name="ws-ai-provider" value="local" ${cur === 'local' ? 'checked' : ''}>
            <span><strong>Local — Llama 3.2 3B</strong> — runs in your browser, nothing leaves your device.</span>
          </label>
          <div class="suite-chat__opt-detail" data-for="local" ${cur === 'local' ? '' : 'hidden'}>
            <p class="suite-chat__consent">First use downloads ~1.7GB of model weights (then cached). Needs a reasonably recent GPU; answers are slower and simpler than Gemini.</p>
          </div>

          <div class="suite-chat__modal-actions">
            <button type="button" class="suite-chat__btn" data-act="cancel">Cancel</button>
            <button type="button" class="suite-chat__btn suite-chat__btn--primary" data-act="save">Save</button>
          </div>
        </div>
      </div>`);

    overlay.addEventListener('change', (e) => {
      if (e.target.name !== 'ws-ai-provider') return;
      for (const d of overlay.querySelectorAll('.suite-chat__opt-detail')) {
        d.hidden = d.dataset.for !== e.target.value;
      }
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-act="save"]').addEventListener('click', () => {
      const sel = overlay.querySelector('input[name="ws-ai-provider"]:checked').value;
      const typed = overlay.querySelector('.suite-chat__key').value.trim();
      if (typed) setKey(typed);
      if (sel === 'gemini' && !getKey()) {
        overlay.querySelector('.suite-chat__key').focus();
        return;
      }
      store.set('preferences.aiProvider', sel, { editedBy: 'chat' });
      overlay.remove();
      render();
    });

    document.body.appendChild(overlay);
  }

  // ---------- bootstrap ----------
  function init() {
    render();
    store.subscribe('preferences.aiProvider', render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
