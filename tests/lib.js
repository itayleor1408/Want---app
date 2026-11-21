// Tiny test helpers: assertions that collect results, and page factories.
const { chromium } = require('playwright');
const BASE = 'http://localhost:8787/';
const T = d => new Date(d).getTime();
let results = [];
const ok = (name, v, extra) => { results.push({ name, pass: !!v, extra }); };
const take = () => { const r = results; results = []; return r; };
const baseState = (o = {}) => Object.assign({
  cash0: 5000, allow: 0, sal: 0, tx: [], jars: [], wish: [], recur: [], pending: [], mem: {},
  tags: { exp: [], inc: [] }, hide: { exp: [], inc: [] }, prof: 'pers', jarView: 'g2', wishView: 'g2',
  v: 3, memSeeded: 1, lang: 'en', theme: 'light', ob: 1, profFixV: 2,
}, o);
// opens a fresh phone-sized page. state: seeded into localStorage only if the phone has none (so reloads keep data).
// date: freezes "now". routes: [[url, body]] fake external scripts.
async function openPage(b, { state, date, routes = [], init = '' } = {}) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c.route('https://accounts.google.com/**', r => r.abort()); // tests never touch the real Google
  for (const [u, body] of routes) await c.route(u, r => r.fulfill({ contentType: 'application/javascript', body }));
  const p = await c.newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(([s, d, extra]) => {
    if (d) { const t = new Date(d).getTime(), R = Date; class D extends R { constructor(...a) { a.length ? super(...a) : super(t) } static now() { return t } } window.Date = D; }
    if (s && !localStorage.getItem('want.v1')) localStorage.setItem('want.v1', JSON.stringify(s));
    if (extra) (0, eval)(extra);
  }, [state || null, date || null, init]);
  await p.goto(BASE);
  return p;
}
module.exports = { chromium, BASE, T, ok, take, baseState, openPage };
