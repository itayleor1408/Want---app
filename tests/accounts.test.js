// Several accounts on ONE phone must never mix: each keeps its own data, and nothing is uploaded under the wrong account.
const { ok, baseState, openPage } = require('./lib');
const fake = `window.google={accounts:{id:{initialize(o){window.__o=o},renderButton(el){el.innerHTML='<button id=fg>G</button>';document.getElementById('fg').onclick=()=>window.__o.callback({credential:window.__cred})}}}}`;
const tx = (id, t) => ({ id, type: 'exp', amt: 1000, ts: Date.now() - 36e5, title: t, cat: 'food', pay: 'card', prof: 'pers' });
const list = async (p, key) => p.evaluate(async k => (await (await fetch('/api/backup', { headers: { authorization: 'Bearer ' + k } })).json()).list || [], key);
const dump = async (p, key) => p.evaluate(async k => { const r = await fetch('/api/backup?n=0', { headers: { authorization: 'Bearer ' + k } }); return r.ok ? JSON.stringify((await r.json()).state) : '' }, key);
module.exports = async b => {
  const routes = [['https://accounts.google.com/gsi/client', fake]];
  // --- A has data and signs in
  const p = await openPage(b, { state: baseState({ tx: [tx('a1', 'AROMA-A'), tx('a2', 'SHUFERSAL-A')], jars: [{ id: 'j1', name: 'Trip-A', goal: 1000, prof: 'pers' }] }), routes, init: "window.__cred='good-acc-a'" });
  await p.waitForTimeout(1500); await p.evaluate(() => settings()); await p.waitForTimeout(900);
  await p.click('#fg'); await p.waitForTimeout(3000);
  const keyA = await p.evaluate(() => S.sync.key);
  ok('A signed in; phone data is now bound to A', await p.evaluate(() => !!S.dataFor && S.sync.verified === true && S.tx.length === 2));
  ok('A\'s data was backed up under A', (await dump(p, keyA)).includes('AROMA-A'));
  // --- A signs out: the phone must show nothing of A
  await Promise.all([p.waitForNavigation(), p.evaluate(() => signOut())]); await p.waitForTimeout(1500);
  ok('after sign-out the phone shows the sign-in screen with no data', await p.evaluate(() => S.tx.length === 0 && S.jars.length === 0 && S.sync.key === '' && /Sign in to start/.test(document.body.innerText)));
  // --- B signs in on the same phone
  await p.evaluate(() => { window.__cred = 'good-acc-b' }); await p.click('#fg'); await p.waitForTimeout(3500);
  const keyB = await p.evaluate(() => S.sync.key);
  ok('B is a different account', keyB && keyB !== keyA);
  ok('B starts empty: none of A\'s data leaked in', await p.evaluate(() => S.tx.length === 0 && S.jars.length === 0));
  ok('nothing of A was uploaded under B', !(await dump(p, keyB)).includes('AROMA-A'));
  await p.evaluate(() => { S.ob = 1; S.tx.push({ id: 'b1', type: 'exp', amt: 500, ts: Date.now(), title: 'PIZZA-B', cat: 'food', pay: 'card', prof: 'pers' }); sv(); render() });
  await p.evaluate(() => bkNow(true)); await p.waitForTimeout(900);
  const dB = await dump(p, keyB);
  ok('B\'s backup has only B\'s data', dB.includes('PIZZA-B') && !dB.includes('AROMA-A'));
  ok('A\'s cloud backup is untouched by B', (await dump(p, keyA)).includes('AROMA-A') && !(await dump(p, keyA)).includes('PIZZA-B'));
  // --- back to A
  await Promise.all([p.waitForNavigation(), p.evaluate(() => signOut())]); await p.waitForTimeout(1500);
  await p.evaluate(() => { window.__cred = 'good-acc-a' }); await p.click('#fg'); await p.waitForTimeout(3500);
  ok('A signs back in and gets A\'s own data back (2 activities + jar)', await p.evaluate(() => S.tx.length === 2 && S.jars.length === 1 && S.tx.every(x => /-A$/.test(x.title))));
  ok('A still owns only A\'s cloud data', !(await dump(p, keyA)).includes('PIZZA-B'));
  // --- typing someone else's key in Settings must also swap data, not mix it
  await p.evaluate(k => { S.sync.key = k; S.sync.verified = false; sv() }, keyB);
  await Promise.all([p.waitForNavigation(), p.evaluate(() => syncNow(true))]); await p.waitForTimeout(1500);
  ok('pasting B\'s key shows B\'s data, not A\'s', await p.evaluate(() => S.tx.length === 1 && S.tx[0].title === 'PIZZA-B'));
  // --- a phone with its own data and no account that turns on the private cloud keeps its data
  const q = await openPage(b, { state: baseState({ tx: [tx('q1', 'LOCAL-Q')] }) }); await q.waitForTimeout(1200);
  await q.evaluate(() => joinCloud()); await q.waitForTimeout(2500);
  ok('turning on the private cloud keeps the phone\'s own data and backs it up', await q.evaluate(() => S.tx.length === 1 && S.sync.verified === true && !!S.dataFor && S.bk.last > 0));
  // --- an old phone (key set before this feature existed) is adopted, not wiped
  const kOld = (await (await fetch('http://localhost:8787/api/join', { method: 'POST', body: '{}' })).json()).key;
  const r = await openPage(b, { state: baseState({ sync: { key: kOld, bank: null, card: null, useBank: false, last: 0, err: '' }, tx: [tx('r1', 'OLD-R')] }) }); await r.waitForTimeout(2500);
  ok('existing phone keeps its data and gets bound to its account', await r.evaluate(() => S.tx.length === 1 && S.tx[0].title === 'OLD-R' && !!S.dataFor && S.sync.verified === true));
  ok('no JS errors', !p.errs.length && !q.errs.length && !r.errs.length, [...p.errs, ...q.errs, ...r.errs].join('|'));
};
