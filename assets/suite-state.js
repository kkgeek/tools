/* =============================================================
 * Wealth Suite — central state store (Phase 2 foundation)
 *
 * One JSON blob in localStorage.wealthSuite.state is the source of
 * truth shared between every tool. Tools never read this directly;
 * a per-tool adapter (Phase 2 step ≥ 2) reads/writes here so the
 * tool's own UI stays unchanged.
 *
 * Public API on window.WealthSuite.store:
 *   .get(path)              → deep-clone of value at dotted path
 *   .set(path, value, opts) → write + persist + notify subscribers
 *   .update(path, fn, opts) → functional set
 *   .subscribe(path, fn)    → returns an unsubscribe function
 *   .export()               → deep-clone of full state
 *   .import(jsonOrObj, opt) → replace state (passes through migrate)
 *   .reset(opts)            → reset to initial schema
 *
 *   `opts.editedBy` ∈ {'tax','retirement','portfolio','asset','golden',
 *                      'dashboard','import','reset'} — recorded in
 *   meta.lastEditedBy so the snapshot widget can show provenance.
 *
 * Storage: localStorage.wealthSuite.state. Cross-tab sync via the
 * `storage` event — every tab listens and re-notifies subscribers.
 *
 * Schema is per-spouse (s1/s2) by design (see project memory). If a
 * future schema bump rearranges shape, raise CURRENT_VERSION and add
 * a migration step in migrate().
 * ============================================================= */
(function () {
  'use strict';

  const STORAGE_KEY = 'wealthSuite.state';
  const CURRENT_VERSION = 1;

  function emptySpouse() { return { s1: null, s2: null }; }

  function initialState() {
    return {
      meta: {
        version: CURRENT_VERSION,
        lastUpdated: null,
        lastEditedBy: null,
      },
      household: {
        filingStatus: 'mfj',
        spouses: [
          { name: '', age: null },
          { name: '', age: null },
        ],
        location: { state: 'WA' },
      },
      income: {
        salary: emptySpouse(),
        bonus: emptySpouse(),
        rsuVests: emptySpouse(),
        capitalGains: { shortTerm: null, longTerm: null },
      },
      retirement: {
        contributions: {
          traditional401k: emptySpouse(),
          roth401k: emptySpouse(),
          afterTax401k: emptySpouse(),
          hsa: null,
          catchup: emptySpouse(),
          ira: emptySpouse(),
        },
        balances: { total: null, breakdown: {} },
        plan: {
          targetRetireAge: null,
          annualExpenses: null,
          growthAssumption: null,
        },
      },
      portfolio: {
        totalValue: null,
        allocations: {},
        holdings: [],
      },
      deductions: {
        method: 'standard',
        mortgage: null,
        salt: null,
        charitable: null,
      },
      preferences: {
        taxYear: null,
      },
    };
  }

  // ---------- Path helpers ----------
  function getPath(obj, path) {
    if (!path) return obj;
    const parts = path.split('.');
    let cur = obj;
    for (const k of parts) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[k];
    }
    return cur;
  }

  function setPath(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (cur[k] == null || typeof cur[k] !== 'object' || Array.isArray(cur[k])) {
        cur[k] = {};
      }
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function deepClone(x) {
    if (x == null || typeof x !== 'object') return x;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(x); } catch (_) { /* fall through */ }
    }
    return JSON.parse(JSON.stringify(x));
  }

  function deepMerge(target, source) {
    if (source === null || source === undefined) return target;
    if (typeof source !== 'object' || Array.isArray(source)) return source;
    if (target == null || typeof target !== 'object' || Array.isArray(target)) target = {};
    for (const k of Object.keys(source)) {
      target[k] = deepMerge(target[k], source[k]);
    }
    return target;
  }

  // ---------- Migrations ----------
  function migrate(state) {
    if (!state || typeof state !== 'object') return initialState();
    const v = state.meta && state.meta.version;
    if (v === CURRENT_VERSION) return state;
    // Unknown / missing version: merge into initial schema so future
    // additions get defaults without clobbering existing user data.
    const fresh = initialState();
    const merged = deepMerge(fresh, state);
    merged.meta = merged.meta || {};
    merged.meta.version = CURRENT_VERSION;
    return merged;
  }

  // ---------- Load / persist ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initialState();
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.warn('[WealthSuite.store] failed to parse stored state — resetting', e);
      return initialState();
    }
  }

  let state = load();

  function persist(editedBy) {
    state.meta = state.meta || {};
    state.meta.version = CURRENT_VERSION;
    state.meta.lastUpdated = Date.now();
    if (editedBy) state.meta.lastEditedBy = editedBy;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('[WealthSuite.store] persist failed', e);
    }
  }

  // ---------- Subscriptions ----------
  // Map<pathPrefix, Set<fn>>. '' means root.
  const subscribers = new Map();

  function safeCall(fn, arg) {
    try { fn(arg); } catch (e) { console.error('[WealthSuite.store] subscriber error', e); }
  }

  function notify(changedPath) {
    for (const [p, set] of subscribers) {
      const matches =
        p === '' ||
        p === changedPath ||
        changedPath === '' ||
        changedPath.startsWith(p + '.') ||
        p.startsWith(changedPath + '.');
      if (!matches) continue;
      const value = p === '' ? deepClone(state) : deepClone(getPath(state, p));
      set.forEach((fn) => safeCall(fn, value));
    }
  }

  // Cross-tab sync: another tab wrote → adopt and notify.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    try {
      state = migrate(e.newValue ? JSON.parse(e.newValue) : null);
      notify('');
    } catch (err) {
      console.warn('[WealthSuite.store] failed to ingest cross-tab update', err);
    }
  });

  // ---------- Public API ----------
  const store = {
    get(path) { return deepClone(getPath(state, path)); },

    set(path, value, options) {
      const opts = options || {};
      setPath(state, path, value);
      persist(opts.editedBy);
      notify(path);
    },

    update(path, fn, options) {
      const cur = deepClone(getPath(state, path));
      this.set(path, fn(cur), options);
    },

    subscribe(path, fn) {
      const key = path || '';
      if (!subscribers.has(key)) subscribers.set(key, new Set());
      subscribers.get(key).add(fn);
      return () => {
        const set = subscribers.get(key);
        if (set) set.delete(fn);
      };
    },

    export() { return deepClone(state); },

    import(input, options) {
      const opts = options || {};
      const incoming = typeof input === 'string' ? JSON.parse(input) : input;
      state = migrate(incoming);
      persist(opts.editedBy || 'import');
      notify('');
    },

    reset(options) {
      const opts = options || {};
      state = initialState();
      // Reset deliberately leaves meta.lastUpdated null so the dashboard's
      // empty-state branch triggers — we don't want a freshly-reset store
      // to look "edited just now." Provenance still flows via lastEditedBy.
      state.meta.lastEditedBy = opts.editedBy || 'reset';
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error('[WealthSuite.store] persist failed', e);
      }
      notify('');
    },

    get version() { return CURRENT_VERSION; },
  };

  // Attach to the WealthSuite namespace (suite.js sets the other half).
  window.WealthSuite = window.WealthSuite || {};
  window.WealthSuite.store = store;
})();
