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
  // --- the owner can step out of their account, try the app as a brand-new user, create another user, and come back with one tap
  const OWN = 'test-key-123456';
  const o = await openPage(b, { state: baseState({ sync: { key: OWN, bank: null, card: null, useBank: false, last: 0, err: '' }, tx: [tx('o1', 'OWNER-1'), tx('o2', 'OWNER-2')], jars: [{ id: 'jo', name: 'Owner jar', goal: 1000, prof: 'pers' }] }), routes });
  await o.waitForTimeout(3200);
  ok('owner phone is bound to the owner account', await o.evaluate(() => S.dataFor === 'owner' && S.sync.verified === true));
  await o.evaluate(() => settings()); await o.waitForTimeout(800);
  ok('owner can sign out (key only, no email needed)', await o.evaluate(() => /Sign out on this phone/.test(document.getElementById('sh').innerText)));
  await Promise.all([o.waitForNavigation(), o.evaluate(() => signOut())]); await o.waitForTimeout(1500);
  ok('after sign-out: the new-user first screen, no data, no key', await o.evaluate(() => /Sign in to start/.test(document.body.innerText) && S.tx.length === 0 && S.sync.key === ''));
  await o.evaluate(() => { S.sync.skip = 1; S.ob = 1; sv(); render(); settings() }); await o.waitForTimeout(900);
  ok('Settings lists the owner account to switch back to', await o.evaluate(() => /Accounts on this phone/i.test(document.getElementById('sh').innerText) && /Owner \(original key\)/.test(document.getElementById('sh').innerText) && /2 activities/.test(document.getElementById('sh').innerText)));
  await o.evaluate(() => joinCloud()); await o.waitForTimeout(2800);
  const newKey = await o.evaluate(() => S.sync.key);
  ok('created another user (its own key, empty)', newKey && newKey !== OWN && await o.evaluate(() => S.tx.length === 0 && S.dataFor && S.dataFor !== 'owner'));
  await o.evaluate(() => { S.tx.push({ id: 'n1', type: 'exp', amt: 700, ts: Date.now(), title: 'NEWUSER-1', cat: 'food', pay: 'card', prof: 'pers' }); sv(); return bkNow(true) }); await o.waitForTimeout(1200);
  ok('the new user\'s backup holds only their data', (await dump(o, newKey)).includes('NEWUSER-1') && !(await dump(o, newKey)).includes('OWNER-1'));
  await Promise.all([o.waitForNavigation(), o.evaluate(() => switchStash('owner'))]); await o.waitForTimeout(3000);
  ok('one tap back to the owner: all data and key restored', await o.evaluate(k => S.tx.length === 2 && S.jars.length === 1 && S.sync.key === k && S.dataFor === 'owner', OWN));
  ok('owner\'s cloud was not touched by the other user', !(await dump(o, OWN)).includes('NEWUSER-1'));
  await o.evaluate(() => settings()); await o.waitForTimeout(800);
  ok('and the other user is now in the list to switch to', await o.evaluate(() => /1 activities|1 activity/.test(document.getElementById('sh').innerText) || /Private cloud/.test(document.getElementById('sh').innerText)));
  // --- a key alone brings the data back only if a cloud backup exists: a fresh app that is given the key offers it
  await o.evaluate(() => { S.tx.push({ id: 'k1', type: 'exp', amt: 900, ts: Date.now(), title: 'KEYTEST-1', cat: 'food', pay: 'card', prof: 'pers' }); sv(); return bkNow(true) }); await o.waitForTimeout(1500);
  const kf = await openPage(b, {}); await kf.waitForTimeout(1500);
  await kf.click('text=I have a key'); await kf.waitForTimeout(500);
  await kf.fill('#ky', OWN); await kf.evaluate(() => saveKey()); await kf.waitForTimeout(3000);
  ok('a fresh app given the key offers the cloud backup', await kf.evaluate(() => /Latest backup/.test(document.body.innerText) && S.tx.length === 0));
  await Promise.all([kf.waitForNavigation(), kf.evaluate(() => cloudRestore(0))]); await kf.waitForTimeout(1500);
  ok('restoring from the cloud brings the data back, and the key stays', await kf.evaluate(k => S.tx.some(x => x.title === 'KEYTEST-1') && S.sync.key === k, OWN));
  // --- an account on this phone can be removed (before handing the phone to someone), with its cloud copy untouched
  const idNew = await o.evaluate(() => stashes().find(x => x.id !== 'owner').id);
  await o.evaluate(i => stashSheet(i), idNew); await o.waitForTimeout(600);
  ok('tapping another account offers Switch and Remove', await o.evaluate(() => /Switch to this account/.test(document.getElementById('sh').innerText) && /Remove from this phone/.test(document.getElementById('sh').innerText)));
  await o.evaluate(i => removeAsk(i), idNew); await o.waitForTimeout(500);
  ok('removing asks first and says what happens to the data', await o.evaluate(() => /Remove from this phone/.test(document.getElementById('sh').innerText) && /(cloud|phone)/i.test(document.getElementById('sh').innerText)));
  await o.evaluate(i => removeStash(i), idNew); await o.waitForTimeout(600);
  ok('the removed account is gone from this phone', await o.evaluate(() => stashes().length === 0 && !/Accounts on this phone/i.test(document.getElementById('sh').innerText)));
  ok('but its cloud backup is still there', (await dump(o, newKey)).includes('NEWUSER-1'));
  ok('and the owner is still signed in with all data', await o.evaluate(k => S.tx.length === 3 && S.sync.key === k, OWN));
  // --- with no Google/email set up, a new user still gets a first screen where a private account (key) can be created
  await fetch('http://localhost:8787/__env?GOOGLE_CLIENT_ID=&BREVO_API_KEY=');
  const f = await openPage(b, {}); await f.waitForTimeout(1800);
  ok('first screen offers "Create my private account" even without Google/email', await f.evaluate(() => /(Sign in|Create your account) to start/.test(document.body.innerText) && /Create my private account/.test(document.body.innerText) && !document.getElementById('em')));
  await f.click('text=Create my private account'); await f.waitForTimeout(2800);
  ok('creating it gives a real key and continues to setup', await f.evaluate(() => S.sync.key.length >= 30 && S.sync.verified === true && /Get started|How much money/.test(document.body.innerText)));
  ok('a user with a key but no owner rights has no bank rows', await f.evaluate(() => { settings(); return true }) && (await f.waitForTimeout(700), await f.evaluate(() => !/Sync bank & card/i.test(document.body.innerText) && !/Owner/i.test(document.getElementById('sh').innerText))));
  await fetch('http://localhost:8787/__env?GOOGLE_CLIENT_ID=test-client&BREVO_API_KEY=k');
  ok('no JS errors', !p.errs.length && !q.errs.length && !r.errs.length && !o.errs.length && !f.errs.length && !kf.errs.length, [...p.errs, ...q.errs, ...r.errs, ...o.errs, ...f.errs].join('|'));
};
