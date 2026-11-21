// ---- sync: Apple Pay payments and bank updates waiting for the app ----
// Storage: one KV namespace bound as WANT_KV. Auth: "Authorization: Bearer <key>".
// Many people can use one deployment: each person's key maps (via a hash) to a private key-prefix, so nobody can read anyone else's data.
// The owner's WANT_TOKEN (if set) keeps working and maps to the old, un-prefixed data.
const JS = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' } });
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join(''); }
async function kvGet(env, key, dflt) { try { const v = await env.WANT_KV.get(key); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; } }
const kvPut = (env, key, v) => env.WANT_KV.put(key, JSON.stringify(v));
async function readBody(req) {
  const ct = req.headers.get('content-type') || '';
  const txt = await req.text();
  if (/json/.test(ct) || /^\s*[{[]/.test(txt)) { try { return JSON.parse(txt); } catch (e) { } }
  const o = {}; try { new URLSearchParams(txt).forEach((v, k) => (o[k] = v)); } catch (e) { }
  return o;
}
// amount in agorot from "₪45.00", "45,00 ₪", 45, "-120.5"
function agorot(v) {
  if (typeof v === 'number') return Math.round(Math.abs(v) * 100);
  const p = numPrice(String(v || '').replace(/[‎‏]/g, ''));
  return p ? Math.round(parseFloat(p) * 100) : 0;
}
async function enqueue(env, items) {
  const inbox = await kvGet(env, 'inbox', []), seen = await kvGet(env, 'seen', []);
  const S = new Set(seen); let added = 0;
  for (const it of items) { if (!it.amt || S.has(it.id)) continue; S.add(it.id); seen.push(it.id); inbox.push(it); added++; }
  if (added) { await kvPut(env, 'inbox', inbox.sort((a, b) => b.ts - a.ts).slice(0, 500)); await kvPut(env, 'seen', seen.slice(-3000)); }
  return added;
}
const hashKey = async k => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(k)))].map(x => x.toString(16).padStart(2, '0')).join('');
const bearer = req => (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
function scoped(env, pfx) { const K = env.WANT_KV; return { WANT_KV: { get: k => K.get(pfx + k), put: (k, v) => K.put(pfx + k, v), delete: k => K.delete(pfx + k) } }; }
// who is calling? the owner's WANT_TOKEN -> '' (the original data); a person's key -> their own prefix (own account, or the prefix of the Google account the key was issued for)
async function resolve(req, env) {
  const k = bearer(req); if (!k) return null;
  if (env.WANT_TOKEN && k.length === env.WANT_TOKEN.length) { let d = 0; for (let i = 0; i < k.length; i++) d |= k.charCodeAt(i) ^ env.WANT_TOKEN.charCodeAt(i); if (d === 0) return { pfx: '', owner: true }; }
  const h = await hashKey(k), rec = await kvGet(env, 'acct:' + h, null);
  return rec ? { pfx: typeof rec.pfx === 'string' ? rec.pfx : 'u:' + h.slice(0, 32) + ':', h, rec } : null;
}
// Google sign-in: the app sends Google's signed ID token; Google itself checks it for us. We keep only a hash of Google's stable user id, never the email.
async function verifyGoogle(env, cred) {
  if (!env.GOOGLE_CLIENT_ID || !cred || cred.length > 4096) return null;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred)); if (!r.ok) return null;
    const t = await r.json();
    if (t.aud !== env.GOOGLE_CLIENT_ID || !/^(https:\/\/)?accounts\.google\.com$/.test(t.iss || '') || !(Number(t.exp) * 1000 > Date.now()) || !t.sub) return null;
    return { sub: String(t.sub), email: String(t.email || '') };
  } catch (e) { return null; }
}
async function googleLogin(req, env, path) {
  if (req.method !== 'POST') return JS({ error: 'post_only' }, 405);
  const redirect = path === '/api/google-cb'; // iPhone home-screen apps can't use popups, so Google can post back here instead
  let b = {}; if (redirect) { const f = await req.formData().catch(() => null); if (f) f.forEach((v, k) => (b[k] = v)); const ck = (req.headers.get('cookie') || '').match(/g_csrf_token=([^;]+)/); if (!ck || ck[1] !== b.g_csrf_token) return new Response('bad request', { status: 400 }); } else b = await readBody(req);
  const fail = (e, st) => redirect ? new Response('<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><body style="font:16px system-ui;padding:40px;text-align:center"><p>Sign-in failed.</p><a href="/">Back</a>', { status: st, headers: { 'content-type': 'text/html; charset=utf-8' } }) : JS({ error: e }, st);
  const g = await verifyGoogle(env, b.credential); if (!g) return fail('bad_google', 401);
  const gh = await hashKey('google:' + g.sub), gk = 'gacct:' + gh;
  let rec = await kvGet(env, gk, null);
  const who = redirect ? null : await resolve(req, env);
  if (who) { // link mode: an app that already has a key attaches this Google account to the same data
    if (rec && rec.pfx !== who.pfx) return fail('already_linked', 409);
    if (!rec) await kvPut(env, gk, { pfx: who.pfx, keys: [], at: Date.now() });
    return JS({ ok: true, linked: true, email: g.email });
  }
  let isNew = false;
  if (!rec) {
    const day = 'joins:' + new Date().toISOString().slice(0, 10), n = parseInt(await env.WANT_KV.get(day) || '0', 10);
    if (n >= (parseInt(env.MAX_JOINS_PER_DAY, 10) || 200)) return fail('busy', 429);
    await env.WANT_KV.put(day, String(n + 1), { expirationTtl: 172800 });
    rec = { pfx: 'g:' + gh.slice(0, 32) + ':', keys: [], at: Date.now() }; isNew = true;
  }
  const raw = crypto.getRandomValues(new Uint8Array(24)), key = btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''), kh = await hashKey(key);
  await env.WANT_KV.put('acct:' + kh, JSON.stringify({ at: Date.now(), pfx: rec.pfx, g: gh }));
  rec.keys = (rec.keys || []).concat(kh); while (rec.keys.length > 20) await env.WANT_KV.delete('acct:' + rec.keys.shift()); // one key per signed-in device; the oldest fall away
  await kvPut(env, gk, rec);
  if (!redirect) return JS({ ok: true, key, email: g.email, isNew });
  const page = '<!doctype html><meta charset=utf-8><body style="font:16px system-ui;padding:40px;text-align:center">Signing in…<script>try{var k="want.v1",s=JSON.parse(localStorage.getItem(k)||"{}");s.sync=s.sync||{};s.sync.key=' + JSON.stringify(key) + ';s.sync.google=' + JSON.stringify(g.email) + ';s.sync.fresh=1;localStorage.setItem(k,JSON.stringify(s))}catch(e){}location.replace("/")</script>';
  return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
async function syncApi(req, env, path) {
  if (!env.WANT_KV) return JS({ error: 'not_set_up', need: ['WANT_KV'] }, 503);
  if (path === '/api/join') { // anyone can make their own private account; an optional JOIN_CODE secret makes it invite-only
    if (req.method !== 'POST') return JS({ error: 'post_only' }, 405);
    const b = await readBody(req);
    if (env.JOIN_CODE && String(b.code || '').trim() !== String(env.JOIN_CODE)) return JS({ error: 'bad_code' }, 403);
    const day = 'joins:' + new Date().toISOString().slice(0, 10), n = parseInt(await env.WANT_KV.get(day) || '0', 10);
    if (n >= (parseInt(env.MAX_JOINS_PER_DAY, 10) || 200)) return JS({ error: 'busy' }, 429);
    const raw = crypto.getRandomValues(new Uint8Array(24)), key = btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    await env.WANT_KV.put('acct:' + await hashKey(key), JSON.stringify({ at: Date.now() }));
    await env.WANT_KV.put(day, String(n + 1), { expirationTtl: 172800 });
    return JS({ ok: true, key });
  }
  if (path === '/api/config') return JS({ ok: true, google: env.GOOGLE_CLIENT_ID || '' });
  if (path === '/api/google' || path === '/api/google-cb') return googleLogin(req, env, path);
  const who = await resolve(req, env);
  if (!who) return JS({ error: 'bad_key' }, 401);
  const pfx = who.pfx;
  return syncCore(req, scoped(env, pfx), path, pfx, env);
}
async function syncCore(req, env, path, pfx, root) {
  if (path === '/api/ping') return JS({ ok: true, bank: await kvGet(env, 'bank', null), card: await kvGet(env, 'card', null) });
  if (path === '/api/state') return JS({ ok: true, bank: await kvGet(env, 'bank', null), card: await kvGet(env, 'card', null), inbox: await kvGet(env, 'inbox', []), wishbox: await kvGet(env, 'wishbox', []) });
  if (path === '/api/backup' && req.method === 'GET') { // list snapshots, or ?n=0|1|2 to fetch one
    const n = new URL(req.url).searchParams.get('n');
    if (n !== null) { const o = await kvGet(env, 'bk' + (parseInt(n, 10) || 0), null); return o ? JS({ ok: true, at: o.at, state: o.state }) : JS({ error: 'none' }, 404); }
    const out = []; for (let i = 0; i < 3; i++) { const o = await kvGet(env, 'bk' + i, null); if (o) out.push({ n: i, at: o.at, size: JSON.stringify(o.state).length, tx: (o.state.tx || []).length, jars: (o.state.jars || []).length }); }
    return JS({ ok: true, list: out });
  }
  if (path === '/api/backup' && req.method === 'POST') { // rolling snapshots: latest, and older ones at least ~a day / ~a week apart
    const txt = await req.text();
    if (txt.length > 4e6) return JS({ error: 'too_big' }, 413);
    let st; try { st = JSON.parse(txt); } catch (e) { return JS({ error: 'bad_json' }, 400); }
    if (st && st.state && typeof st.state === 'object') st = st.state;
    if (!st || typeof st !== 'object' || !((st.tx || []).length || (st.jars || []).length || (st.wish || []).length)) return JS({ error: 'empty' }, 400);
    delete st.sync; // the key never goes into a backup
    const now = Date.now(), s0 = await kvGet(env, 'bk0', null);
    if (s0 && now - s0.at > 20 * 36e5) { const s1 = await kvGet(env, 'bk1', null), s2 = await kvGet(env, 'bk2', null); if (s1 && (!s2 || s1.at - s2.at > 6 * 864e5)) await kvPut(env, 'bk2', s1); await kvPut(env, 'bk1', s0); }
    await kvPut(env, 'bk0', { at: now, state: st });
    return JS({ ok: true, at: now });
  }
  if (path === '/api/forget' && req.method === 'POST') { // delete everything stored for this account (never the owner's legacy data)
    if (!pfx) return JS({ error: 'owner_account' }, 400);
    for (const k of ['inbox', 'seen', 'bank', 'card', 'wishbox', 'bk0', 'bk1', 'bk2']) await env.WANT_KV.delete(k);
    const me = await resolve(req, root), rec = me && me.rec;
    if (rec && rec.g) { const g = await kvGet(root, 'gacct:' + rec.g, null); for (const kh of (g && g.keys) || []) await root.WANT_KV.delete('acct:' + kh); await root.WANT_KV.delete('gacct:' + rec.g); }
    if (me) await root.WANT_KV.delete('acct:' + me.h);
    return JS({ ok: true });
  }
  if (req.method !== 'POST') return JS({ error: 'post_only' }, 405);
  const b = await readBody(req);
  if (path === '/api/wish') { // "Add to Brim." in Safari's Share menu: the product as read from the live page on the phone
    let p = b.page;
    if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = null; } }
    p = p && typeof p === 'object' ? p : {};
    const url = String(p.url || b.url || '').slice(0, 2000);
    const firstNum = v => { const m = String(v || '').match(/\d[\d.,]*/); return m ? numPrice(m[0]) : ''; };
    const d = { title: String(p.title || '').replace(/\s+/g, ' ').trim().slice(0, 120), price: firstNum(p.price), currency: curOf(p.currency) || curOf(p.price), image: /^https?:/.test(p.image || '') && !/HTB18eCBQXXXXXXfXXXX760XFXXXa|\/(logo|sprite|placeholder)[^/]*$/i.test(p.image) ? String(p.image).slice(0, 2000) : '', store: String(p.store || '').slice(0, 40) };
    // anything the page didn't give us, try to read from the link on the server
    if ((!d.title || !d.price || !d.image) && /^https?:/.test(url) && typeof productData === 'function') {
      try { const s = await productData(url); if (s && !s.error) for (const k of ['title', 'price', 'currency', 'image', 'store']) if (!d[k] && s[k]) d[k] = s[k]; } catch (e) { }
    }
    if (!d.title || /^(aliexpress|amazon)(\.[a-z.]+)?$/i.test(d.title) || /not found|can ?not be found|\b404\b|error page|access denied|captcha|just a moment/i.test(d.title)) return JS({ ok: false, msg: "Couldn't find a product on this page. Nothing was added." });
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(d.store)) { // "aliexpress.com" -> "AliExpress"
      const n = d.store.replace(/^(www|m|he|il|shop)\./i, '').split('.')[0], NICE = { aliexpress: 'AliExpress', amazon: 'Amazon', ebay: 'eBay', ikea: 'IKEA', shein: 'SHEIN', temu: 'Temu', ksp: 'KSP', zara: 'Zara' };
      d.store = NICE[n.toLowerCase()] || (n.length <= 4 ? n.toUpperCase() : n[0].toUpperCase() + n.slice(1));
    }
    if (d.price && d.currency && d.currency !== 'ILS' && typeof rates === 'function') { try { const r = await rates(d.currency); if (r && r.ils) d.priceILS = String(Math.round(parseFloat(d.price) * r.ils * 100) / 100); } catch (e) { } }
    const box = await kvGet(env, 'wishbox', []);
    box.push(Object.assign({ id: 'wi_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), url, ts: Date.now() }, d));
    await kvPut(env, 'wishbox', box.slice(-50));
    return JS({ ok: true, msg: 'Sent to Brim.: ' + d.title.slice(0, 50) + (d.price ? '' : ' (add the price in the app)') + '. Open Brim. to save it.' });
  }
  if (path === '/api/ingest') { // Apple Pay automation or quick add from a Shortcut
    const amt = agorot(b.amount), title = String(b.merchant || b.title || '').trim().slice(0, 60);
    if (!amt) return JS({ error: 'no_amount' }, 400);
    const ts = b.date && !isNaN(Date.parse(b.date)) ? Date.parse(b.date) : Date.now();
    const type = b.type === 'inc' ? 'inc' : 'exp', src = b.source === 'quick' ? 'quick' : 'applepay';
    const id = b.id ? String(b.id).slice(0, 80) : 'ap_' + await sha([src, title, amt, Math.floor(ts / 60000)].join('|'));
    const added = await enqueue(env, [{ id, type, amt, ts, title, src, card: String(b.card || '').slice(0, 40) }]);
    return JS({ ok: true, id, duplicate: !added });
  }
  if (path === '/api/bank') { // the Discount script on your computer
    const bal = Number(b.balance);
    if (isFinite(bal)) await kvPut(env, 'bank', { bal: Math.round(bal * 100), at: Date.now(), acct: String(b.accountNumber || '').slice(-4), name: String(b.bankName || 'Bank').slice(0, 30) });
    const items = [];
    for (const x of Array.isArray(b.txns) ? b.txns : []) {
      const a = Number(x.amount); if (!isFinite(a) || !a) continue;
      const ts = Date.parse(x.date) || Date.now();
      const id = 'bk_' + (x.id ? String(x.id) : await sha([x.date, a, x.description].join('|')));
      items.push({ id, type: a < 0 ? 'exp' : 'inc', amt: Math.round(Math.abs(a) * 100), ts, title: String(x.description || '').trim().slice(0, 60), src: 'bank' });
    }
    const added = await enqueue(env, items);
    return JS({ ok: true, added, balance: isFinite(bal) });
  }
  if (path === '/api/ack') {
    const ids = new Set(Array.isArray(b.ids) ? b.ids : []);
    const inbox = await kvGet(env, 'inbox', []);
    const left = inbox.filter(x => !ids.has(x.id));
    if (left.length !== inbox.length) await kvPut(env, 'inbox', left);
    const wb = await kvGet(env, 'wishbox', []), wl = wb.filter(x => !ids.has(x.id));
    if (wl.length !== wb.length) await kvPut(env, 'wishbox', wl);
    return JS({ ok: true, left: left.length });
  }
  if (path === '/api/card') { // a credit-card company's scraper on your computer (per-purchase items, never a balance)
    const items = [];
    for (const x of Array.isArray(b.txns) ? b.txns : []) {
      const a = Number(x.amount); if (!isFinite(a) || !a) continue;
      const ts = Date.parse(x.date) || Date.now();
      const id = 'cd_' + (x.id ? String(x.id) : await sha([x.date, a, x.description].join('|')));
      items.push({ id, type: a < 0 ? 'exp' : 'inc', amt: Math.round(Math.abs(a) * 100), ts, title: String(x.description || '').trim().slice(0, 60), src: 'card' });
    }
    if (b.cardName) await kvPut(env, 'card', { name: String(b.cardName).slice(0, 30), at: Date.now() });
    const added = await enqueue(env, items);
    return JS({ ok: true, added });
  }
  if (path === '/api/reset-seen') { // clears the de-dup memory so the next bank sync can re-send anything that was lost to a past bug, without re-sending things you already have
    await kvPut(env, 'seen', []);
    return JS({ ok: true });
  }
  return JS({ error: 'not_found' }, 404);
}
