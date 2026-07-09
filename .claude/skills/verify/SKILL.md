---
name: verify
description: Verify Wealth Suite changes by driving the real pages in headless Chrome via a same-origin harness page
---

# Verifying Wealth Suite changes

No build step — the surface is the HTML pages themselves. Serve the repo
root and drive the changed page in headless Chrome.

## Recipe

1. `python3 -m http.server 8017` from the repo root (background).
2. Write a **same-origin harness page in the repo root** (e.g.
   `_verify_x.html`, delete after): an `<iframe>` loading the page under
   test + an inline async script that drives it and logs results into a
   `<pre id="out">`. Same origin gives the harness full access to the
   iframe's DOM, `window.WealthSuite.store`, and shared localStorage.
3. Run: `google-chrome --headless --disable-gpu --window-size=1300,2400
   --virtual-time-budget=45000 --dump-dom http://localhost:8017/_verify_x.html`
   then grep for `id="out"`. For evidence use `--screenshot=out.png`
   instead of `--dump-dom`.

## Harness patterns that work

- Clear state first: `localStorage.removeItem('wealthSuite.state');
  sessionStorage.clear();` then re-set `iframe.src`.
- Wait for `fr.contentWindow.WealthSuite.store` + a known element id
  before driving (tools init via polling for the store).
- Inputs: set `.value` then `dispatchEvent(new W.Event('input'|'change',
  {bubbles:true}))` — use the **iframe's** constructors (`W.Event`).
- File drop zones: `new W.DataTransfer()` + `dt.items.add(new W.File(...))`
  + `new W.DragEvent('drop', {dataTransfer: dt, bubbles:true,
  cancelable:true})` — works in headless Chrome.
- Real network (quote worker / Yahoo) works under `--virtual-time-budget`;
  give 25s+ waits for quote fetches.
- Flash/status assertions race under virtual time when two async actions
  are close together — re-test a suspect case in isolation before calling
  it a failure.

## Gotchas

- **TaxAssetCalcv4.html renders blank in headless Chrome** (Babel+D3 vs
  virtual time) — pre-existing; don't chase it, verify that page in a
  real browser.
- React/Babel pages (expenses, tracker, tax, roth) DO render headless but
  need long budgets (30–45s virtual) before content appears.
- Kill the server when done: `pkill -f "http.server 8017"` (exit 144 is
  normal). Delete harness files from the repo root.
