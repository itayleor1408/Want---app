# AGENTS.md — start here (Codex, Claude Code, or a human)

Two phone-first PWAs live in this repo. Hebrew + English (RTL) must always work.

| App | What it is | Source | Ships how |
|---|---|---|---|
| **Penny** | Personal finance: savings jars, wishlist, expenses/income, bank/card/Apple Pay sync, private cloud accounts | `want3.html` (+ `sync_api.js`, `extract.js`) → built into generated `worker.js` | Push to `main` → Cloudflare Workers Builds. Check `https://want.itayleor1408.workers.dev/version` |
| **Tempo** | Schedule + time: day plan, places, travel time, live bus finder (Moovit-style) | `tempo/index.html` (single file, inline JS/CSS, `localStorage` key `tempo.v1`) | Push to `main` → `.github/workflows/tempo-pages.yml` → GitHub Pages |

Rules of the house:
- Both apps are single self-contained HTML files. No framework, no bundler for the UI.
- **Never hand-edit `worker.js`.** Edit sources, then `python3 build_worker.py` (needs `pip install pillow`). CI fails if `worker.js` is stale.
- Design language: `.claude/skills/penny-design/SKILL.md` (tokens in `tokens.css`). Read before touching any screen.
- **Owner's standing rule** (see `CLAUDE.md`): after *every* UI change, render the changed screens at 390x844 in English **and** Hebrew (also dark), look at the screenshots, go through the UI review questions in the design skill, fix, re-render, then commit. A note about one screen is a rule for every screen.
- Owner wants changes pushed to `main` without asking, minimal and polished UI, tests green.
- **Secrets never go in the repo** (`wrangler.toml`, code, tests). `WANT_TOKEN`, Brevo and Google keys are Worker secrets/vars only.

## Run and test

```bash
npm i -D playwright            # once (Chromium needed)
node tests/run.js              # all (~358 checks); starts serve.mjs with KV mocked
node tests/run.js bus          # only files whose name contains "bus"
python3 build_worker.py && node --check worker.js   # Penny build
```
`serve.mjs` is a local dev server (Worker with mocked KV; helpers `/__env`, `/__kvclear`, `/__mail`). Kill stray ones with `pkill -f "node serve.mjs"` if a run hangs.
Tempo tests stub `Date`, `window.fetch`, `window.L`/`loadLeaflet` (see `tests/bus.test.js` for the pattern).

## Where we are (Nov 2026)

**Penny** — feature complete and deployed: jars, wishlist with product-link reader, activity, Work/Personal/All profiles, bank/card/Apple Pay ingest, cloud backup + restore, Google and e-mail sign-in (need user-side keys to be live), subscriptions/recurring.

**Tempo** — most recent work is the bus finder (`findTrips`, `tripTop`, `tripRow`, `walkMap` in `tempo/index.html`):
- Data: Open Bus Stride API (`open-bus-stride-api.hasadna.org.il`) via `api()`/`pick()`; routing from routing.openstreetmap.de; Leaflet for the map.
- For a task at a set time, the list shows only buses arriving ~90 min before it (plus up to 2 just after). Each **line appears once**; later departures of that line are in the "Leaves in a, b, c" row.
- Top card: big minutes with bus icon + line number, LEAVE → ARRIVE, walk › bus › walk chain. Hours read as `6h 40m` (HE `6 ש' 40 ד'`).
- Rows: side card slides between leave/arrive and total minutes (all rows together, auto or swipe); map button opens dashed walk + solid bus route.
- The stop schedule tab also centres on the planned time, not "now".
- Window changes (mode/bus) animate with a height + fade swap.

Not verifiable from the sandbox: real bus data, the live Tempo site, real phones, real Google/Brevo.

## Open items (owner side)
- Rotate `WANT_TOKEN` and delete the leaked Brevo key.
- Optional: Google OAuth client ID, Brevo key as Worker secrets.

## Working with two tools on one repo
- Claude Code branches `claude/**` auto-merge to `main` via `.github/workflows/auto-merge-claude.yml`. Other tools' branches do not: open a PR or push to `main` deliberately.
- Pull before starting; commit small; run `node tests/run.js` before every push to `main`.
- Don't both edit `tempo/index.html` at the same time: it is one big file and merges conflict easily.
