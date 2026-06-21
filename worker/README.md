# Yahoo quote proxy — Cloudflare Worker

Relays Yahoo Finance chart requests and adds CORS headers so the suite can
fetch live quotes from the browser. Stateless, free-tier friendly, no API key.

## Deploy (CLI — recommended)

From this `worker/` directory:

```bash
npx wrangler login      # opens a browser; authorize Cloudflare (one time)
npx wrangler deploy
```

`deploy` prints the live URL, e.g.:

```
https://wealth-suite-quotes.<your-subdomain>.workers.dev
```

Copy that URL — it goes into the suite (see "Wire it up" below).

## Deploy (dashboard — no CLI)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Create Worker**.
2. Name it `wealth-suite-quotes`, **Deploy**, then **Edit code**.
3. Paste the contents of [`yahoo-proxy.js`](yahoo-proxy.js), **Deploy**.
4. Note the `*.workers.dev` URL shown.

## Wire it up

Set the URL as `QUOTE_WORKER` in:

- `portfolio_tracker.html` (the `QUOTE_WORKER` constant near the top of the script)
- `assets/ai/briefing.js` (same constant)

No trailing slash. Leaving it `''` falls back to the public CORS-proxy chain.

## Test

```bash
curl "https://wealth-suite-quotes.<your-subdomain>.workers.dev/v8/finance/chart/AAPL?interval=1d&range=2d"
```

You should get Yahoo chart JSON. A non-Yahoo path (e.g. `/foo`) returns `404`
by design — this Worker only forwards `/v6|v7|v8/finance/...`.

## Security notes

- **Not an open proxy:** only Yahoo finance paths are forwarded.
- **CORS allowlist:** edit `ALLOWED_ORIGINS` in `yahoo-proxy.js` if you add a
  custom domain. `localhost`/`127.0.0.1` (any port) is allowed for local dev.
- Responses are edge-cached ~60s to limit upstream calls.
