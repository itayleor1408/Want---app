# Brim.

Personal finance PWA (Hebrew/English RTL — savings jars, wishlist, expense/income tracking,
Work/Personal/All profiles, Discount Bank + Max card + Apple Pay sync) — deployed as a
Cloudflare Worker at `want.itayleor1408.workers.dev`.

Push to `main` to auto-deploy (connected to Cloudflare Workers Builds).

## Source layout

- `want3.html` — the whole app: one self-contained HTML/CSS/JS file (inline `<script>`,
  `localStorage` persistence). This is the file to edit.
- `extract.js` — shared product-link reader (JSON-LD, Open Graph, microdata, plus
  site-specific readers for AliExpress/Amazon) used by the Worker's `/api/product` endpoint.
- `sync_api.js` — the `/api/ping`, `/api/state`, `/api/ingest`, `/api/bank`, `/api/card`,
  `/api/ack`, `/api/reset-seen` endpoints (Apple Pay quick-add, bank/card sync, KV-backed).
- `build_worker.py` — bundles the three files above (plus a generated manifest, service
  worker and app icon) into the single deployable `worker.js`. Requires `pip install pillow`.
- `worker.js` — **generated** by `build_worker.py`. This is what `wrangler.toml` points at
  and what Cloudflare actually runs. Don't hand-edit it — edit the source files and rebuild.
- `serve.mjs` — a tiny local dev server (plain Node, no Cloudflare account needed) that runs
  the built `worker.js` with `fetch()` and KV mocked, for testing before deploying.

## Workflow

```bash
# 1. edit want3.html (and/or extract.js, sync_api.js)

# 2. rebuild worker.js
pip install --break-system-packages pillow   # once
python3 build_worker.py

# 3. sanity-check the build
node --check worker.js

# 4. optional: test locally
node serve.mjs &            # serves http://localhost:8787
# ... open it, click around, or drive it with Playwright ...
kill %1

# 5. ship it
git add want3.html extract.js sync_api.js build_worker.py worker.js
git commit -m "..."
git push origin main         # Cloudflare Workers Builds auto-deploys this
```

## Notes

- Bank sync (`want-bank/sync.mjs`, not in this repo) runs on the user's own Windows PC via a
  Scheduled Task every 4 hours — it only syncs while that PC is on. Apple Pay and Back Tap
  quick-add send straight from the phone and don't need the PC.
- `S.sync.key` / `WANT_TOKEN` is the shared secret between the app and the Worker's
  `/api/ingest`-family endpoints. Never commit a real value for it.
