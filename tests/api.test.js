// Server-side: private accounts, isolation, backups, Google sign-in, deleting an account. No browser needed.
const { ok } = require('./lib');
const U = 'http://localhost:8787';
const call = async (path, o = {}) => { const r = await fetch(U + path, { method: o.m || (o.body ? 'POST' : 'GET'), headers: Object.assign({ 'content-type': 'application/json' }, o.key ? { authorization: 'Bearer ' + o.key } : {}), body: o.body ? JSON.stringify(o.body) : undefined }); return { st: r.status, j: await r.json().catch(() => ({})) }; };
module.exports = async () => {
  const A = (await call('/api/join', { body: {} })).j.key, B = (await call('/api/join', { body: {} })).j.key;
  ok('join returns a long random key', A && A.length >= 30 && A !== B);
  await call('/api/ingest', { key: A, body: { amount: 45, merchant: 'CoffeeA' } });
  ok('owner of key A sees their payment', (await call('/api/state', { key: A })).j.inbox.length === 1);
  ok('key B cannot see A\'s payment', (await call('/api/state', { key: B })).j.inbox.length === 0);
  ok('wrong key is rejected', (await call('/api/state', { key: 'nope' })).st === 401);
  ok('no key is rejected', (await call('/api/state')).st === 401);
  ok('owner legacy key still works', (await call('/api/state', { key: 'test-key-123456' })).st === 200);
  ok('empty backup refused', (await call('/api/backup', { key: A, body: { tx: [], jars: [] } })).st === 400);
  ok('backup accepted', (await call('/api/backup', { key: A, body: { tx: [{ amt: 1 }], jars: [], sync: { key: 'SECRET' } } })).st === 200);
  const got = await call('/api/backup?n=0', { key: A });
  ok('backup round-trips and never stores the key', got.j.state.tx.length === 1 && !JSON.stringify(got.j).includes('SECRET'));
  ok('B cannot see A\'s backup', (await call('/api/backup', { key: B })).j.list.length === 0);
  ok('oversized backup refused', (await call('/api/backup', { key: A, body: { tx: [{ x: 'y'.repeat(4.1e6) }] } })).st === 413);
  // google
  ok('config exposes google client id', (await call('/api/config')).j.google === 'test-client');
  ok('bad google token refused', (await call('/api/google', { body: { credential: 'bad' } })).st === 401);
  const g1 = (await call('/api/google', { body: { credential: 'good-alice' } })).j, g2 = (await call('/api/google', { body: { credential: 'good-alice' } })).j;
  ok('google login issues a key per device', g1.key && g2.key && g1.key !== g2.key);
  await call('/api/ingest', { key: g1.key, body: { amount: 10, merchant: 'X' } });
  ok('both devices of one Google account share data', (await call('/api/state', { key: g2.key })).j.inbox.length === 1);
  const bob = (await call('/api/google', { body: { credential: 'good-bob' } })).j;
  ok('another Google account is separate', (await call('/api/state', { key: bob.key })).j.inbox.length === 0);
  ok('cannot link a Google account that already has other data', (await call('/api/google', { key: bob.key, body: { credential: 'good-alice' } })).st === 409);
  const csrf = await fetch(U + '/api/google-cb', { method: 'POST', body: new URLSearchParams({ credential: 'good-dave' }) });
  ok('redirect login without csrf cookie refused', csrf.status === 400);
  await call('/api/forget', { key: g1.key, body: {} });
  ok('deleting an account revokes all its devices', (await call('/api/state', { key: g2.key })).st === 401);
  ok('owner data cannot be deleted through the API', (await call('/api/forget', { key: 'test-key-123456', body: {} })).st === 400);
};
