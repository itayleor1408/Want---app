// ---- sync: Apple Pay payments and bank updates waiting for the app ----
// Storage: one KV namespace bound as WANT_KV. Auth: a secret WANT_TOKEN, sent as "Authorization: Bearer <key>".
const JS = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' } });
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join(''); }
function authed(req, env) {
  const h = req.headers.get('authorization') || '';
  const k = h.replace(/^Bearer\s+/i, '').trim();
  if (!env.WANT_TOKEN || !k || k.length !== env.WANT_TOKEN.length) return false;
  let d = 0; for (let i = 0; i < k.length; i++) d |= k.charCodeAt(i) ^ env.WANT_TOKEN.charCodeAt(i);
  return d === 0;
}
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
async function syncApi(req, env, path) {
  if (!env.WANT_KV || !env.WANT_TOKEN) return JS({ error: 'not_set_up', need: [!env.WANT_KV && 'WANT_KV', !env.WANT_TOKEN && 'WANT_TOKEN'].filter(Boolean) }, 503);
  if (!authed(req, env)) return JS({ error: 'bad_key' }, 401);
  if (path === '/api/ping') return JS({ ok: true, bank: await kvGet(env, 'bank', null), card: await kvGet(env, 'card', null) });
  if (path === '/api/state') return JS({ ok: true, bank: await kvGet(env, 'bank', null), card: await kvGet(env, 'card', null), inbox: await kvGet(env, 'inbox', []) });
  if (req.method !== 'POST') return JS({ error: 'post_only' }, 405);
  const b = await readBody(req);
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
