# Penny.

Personal finance PWA (Hebrew/English RTL — savings jars, wishlist, expense/income tracking,
Work/Personal/All profiles, Discount Bank + Max card + Apple Pay sync) — deployed as a
Cloudflare Worker at `want.itayleor1408.workers.dev`.

Push to `main` to auto-deploy (connected to Cloudflare Workers Builds).

## Source layout

- `want3.html` — the whole app: one self-contained HTML/CSS/JS file (inline `<script>`,
  `localStorage` persistence). This is the file to edit.
- `extract.js` — the product-link reader (JSON-LD, Open Graph, microdata, plus AliExpress/Amazon readers) behind
  the Wishlist's automatic name, photo and price (`/api/product`).
- `sync_api.js` — the `/api/*` endpoints (KV-backed): `join`, `google`, `google-cb`, `email-start`, `email-verify`, `config`,
  `ping`, `state`, `ingest`, `bank`, `card`, `ack`, `wish`, `product`, `backup`, `forget`, `reset-seen`.
  Apple Pay quick-add, bank/card sync, cloud backup, private accounts.
- `build_worker.py` — bundles the files above (plus a generated manifest, service
  worker and app icon) into the single deployable `worker.js`. Requires `pip install pillow`.
- `worker.js` — **generated** by `build_worker.py`. This is what `wrangler.toml` points at
  and what Cloudflare actually runs. Don't hand-edit it — edit the source files and rebuild.
- `tests/` — Playwright tests (`npm test`), see **Testing**.
- `serve.mjs` — a tiny local dev server (plain Node, no Cloudflare account needed) that runs
  the built `worker.js` with `fetch()` and KV mocked, for testing before deploying.

## Workflow

```bash
# 1. edit want3.html (and/or sync_api.js)

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
git add want3.html sync_api.js build_worker.py worker.js
git commit -m "..."
git push origin main         # Cloudflare Workers Builds auto-deploys this
```

## Accounts, keys and privacy

Many people can use one deployment. All app data (jars, activity) lives in the
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
- **First screen + email codes (optional):** a brand-new install opens on a sign-in screen
  (Google and/or "send me a code"; there's a small "Use without an account" link). The code is a
  6-digit number valid for 10 minutes, emailed through [Brevo](https://www.brevo.com) (free tier,
  300 emails/day). In Brevo, verify a sender address, create an API key, then add two Worker
  variables in Cloudflare: secret `BREVO_API_KEY` and variable `MAIL_FROM` (the verified sender).
  Until they exist the email option is hidden. Without your own domain, mail from a Gmail sender
  can land in spam; Google sign-in avoids that. Limits: one code a minute per address, 5 wrong
  tries, `MAX_EMAILS_PER_DAY` (default 300). Both ways of signing in create the same kind of
  account, and each device gets its own key.
- **Owner:** only the owner account (the original `WANT_TOKEN` data) has bank and card sync
  (`/api/bank`, `/api/card` return 403 for everyone else, and the bank rows are hidden in the
  app). The owner phone is asked once to "Connect your account" (Google or email); that email is
  then remembered, and signing in with it on any new phone gives the owner account back.
- **Several accounts on one phone never mix:** the phone remembers which account its data belongs
  to (`S.dataFor`, taken from the server's `acct` id). Signing out, or signing in as a different
  account (or pasting a different key), puts the current data away under its own account and loads
  that other account's data, or a blank start. Backups are only uploaded once the server has
  confirmed the data belongs to the signed-in account (`S.sync.verified`). Covered by
  `tests/accounts.test.js`.
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

## Design language (reusable skill)

The look and motion of the app are written down as a Claude skill in `.claude/skills/penny-design/`
(`SKILL.md` principles and rules, `tokens.css` real tokens and component CSS, `starter.html` a page that
already has the style). Copy that folder into a new project to start another app in the same vibe.

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

### Ask Tempo

The microphone beside **Add** opens a recording sheet. Pause to edit the transcript, or send while recording. Typed requests work even on browsers without speech recognition. Common commands and assistant undo run locally. Voice recognition may use the browser or device provider's speech service.

For more conversational requests, the optional Workers AI interpreter uses the authenticated Tempo backup account and a free-plan quota. Keep the Cloudflare account on **Workers Free** for this mode, deploy the Worker with the `AI` binding, and set the Worker variable `TEMPO_AI_FREE=1`. The route stays disabled without the flag. The user then enables **Language model** in Ask Tempo. The service receives the request, recent conversation and a bounded list of nearby task titles and times. When the model or quota is unavailable, Tempo offers its local commands. [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
