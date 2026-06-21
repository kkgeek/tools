/* =============================================================================
 * Wealth Suite — Yahoo Finance quote proxy (Cloudflare Worker)
 *
 * Yahoo's public chart endpoint sends no Access-Control-Allow-Origin header, so
 * browsers block direct fetches from the suite. This Worker relays requests to
 * Yahoo and adds CORS headers, giving the Tracker (and briefing) a reliable
 * quote source without exposing any API key.
 *
 * It is NOT an open proxy: only Yahoo finance chart/quote paths are forwarded,
 * and CORS is granted only to the suite's own origins.
 *
 * Client usage — swap the Yahoo host for this Worker, keep the path:
 *   https://<worker>.workers.dev/v8/finance/chart/AAPL?interval=1d&range=2d
 *
 * Deploy: see worker/README.md
 * ========================================================================== */

// Origins allowed to call this Worker. Add a custom domain here if you set one.
const ALLOWED_ORIGINS = ['https://kkgeek.github.io'];

// Only these Yahoo path prefixes are forwarded (keeps this from being an open proxy).
const ALLOWED_PATH = /^\/v[678]\/finance\//;

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow local dev on any port.
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders(origin) {
  const allow = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    const url = new URL(request.url);
    if (!ALLOWED_PATH.test(url.pathname)) {
      return new Response('Not found', { status: 404, headers: cors });
    }

    // Forward the same path + query to Yahoo. query1 first, query2 as a fallback.
    const upstream = `finance.yahoo.com${url.pathname}${url.search}`;
    let resp = null;
    for (const host of ['query1', 'query2']) {
      try {
        resp = await fetch(`https://${host}.${upstream}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WealthSuite/1.0)' },
          cf: { cacheTtl: 60, cacheEverything: true },
        });
        if (resp.ok) break;
      } catch (_) { /* try next host */ }
    }
    if (!resp) {
      return new Response(JSON.stringify({ error: 'upstream unreachable' }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: {
        ...cors,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  },
};
