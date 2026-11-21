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
- `sync_api.js` — the `/api/*` endpoints (KV-backed): `join`, `google`, `google-cb`, `config`,
  `ping`, `state`, `ingest`, `bank`, `card`, `ack`, `wish`, `backup`, `forget`, `reset-seen`.
  Apple Pay quick-add, bank/card sync, cloud backup, private accounts.
- `build_worker.py` — bundles the three files above (plus a generated manifest, service
  worker and app icon) into the single deployable `worker.js`. Requires `pip install pillow`.
- `worker.js` — **generated** by `build_worker.py`. This is what `wrangler.toml` points at
  and what Cloudflare actually runs. Don't hand-edit it — edit the source files and rebuild.
- `tests/` — Playwright tests (`npm test`), see **Testing**.
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

## Accounts, keys and privacy

Many people can use one deployment. All app data (jars, activity, wishlist) lives in the
phone's own storage. Only sync and backups live in the Worker's KV, and each person's part is
stored under a hash of their own key, so nobody can read anyone else's.

- **Private cloud:** Settings → "Turn on cloud sync & backup" creates a random key
  (`POST /api/join`). It is capped at `MAX_JOINS_PER_DAY` (default 200) new accounts a day.
  Set a `JOIN_CODE` secret to make joining invite-only (the app has no field for it yet).
- **Google sign-in (optional):** create a free OAuth *Web* client in Google Cloud Console
  (APIs & Services → Credentials), add `https://want.itayleor1408.workers.dev` under *Authorized
  JavaScript origins*, then add the client ID as the Worker variable `GOOGLE_CLIENT_ID`
  (Cloudflare → Workers & Pages → want → Settings → Variables). The button then appears in
  Settings on its own. Each device gets its own key; the Google account itself is only a hash of
  Google's user id (the email is never stored). An existing key can be linked to Google from
  Settings, so a new phone can sign in and restore the backup.
- **Owner key:** the `WANT_TOKEN` secret keeps working and maps to the original un-prefixed
  data. **Rotate it** if it was ever exposed (an old version of the app had it inside the page):
  Cloudflare → Variables and Secrets → set a new `WANT_TOKEN`, then paste the new value into
  the app (Settings → Sync key), the Apple Pay / Back Tap Shortcuts, and the bank-sync script.
- **Backups:** automatic (at most every 4 hours, only when something changed), three rolling
  snapshots (latest, ~a day old, ~a week old), never containing the key. Restore keeps a copy of
  the previous data so it can be undone.
- **Free-plan limits:** Workers KV free tier is 1,000 writes and 100,000 reads a day across all
  users. Each active phone costs a few thousand reads a day, so about 15–20 active people fit;
  beyond that the $5/month Workers plan removes the limit.

## Testing

```bash
npm install
npx playwright install chromium     # once
npm test                            # builds nothing; tests the committed worker.js via serve.mjs
npm test -- fuzz                    # run just the files whose name contains "fuzz"
```

Covers: server-side account isolation and backups (`api`), cloud backup/restore (`cloud`),
Google sign-in with a faked Google script (`google`), subscriptions totals and price alerts
(`subs`), recurring-vs-card double counting (`recur`), old/odd saved data, storage-full warning,
onboarding and version check (`data`), and a seeded fuzz of random wallets that checks totals
stay finite and split cleanly across profiles (`fuzz`). GitHub Actions (`.github/workflows/ci.yml`)
rebuilds `worker.js`, fails if it is stale, and runs the suite on every push and pull request.

## Safer deploys

- `build_worker.py` refuses to build if the page script has a JavaScript syntax error.
- Run `npm test` before pushing to `main` (Cloudflare deploys on push; CI runs alongside it).
- If a bad version ships: Cloudflare → Workers & Pages → want → Deployments → pick the previous
  one → **Rollback**. Phones pick the rolled-back version up on their own (the app checks
  `/version` and refreshes itself).

## Notes

- Bank sync (`want-bank/sync.mjs`, not in this repo) runs on the user's own Windows PC via a
  Scheduled Task every 4 hours — it only syncs while that PC is on. Apple Pay and Back Tap
  quick-add send straight from the phone and don't need the PC.
- Sync keys are secrets: never commit a real one, and never paste one into the page source.
