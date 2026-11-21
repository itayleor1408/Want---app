// Browser: Google sign-in (Google's script is faked), second phone restores, sign out.
const { ok, baseState, openPage } = require('./lib');
const fake = `window.google={accounts:{id:{initialize(o){window.__o=o},renderButton(el){el.innerHTML='<button id=fg>G</button>';document.getElementById('fg').onclick=()=>window.__o.callback({credential:window.__cred})}}}}`;
module.exports = async b => {
  const st = baseState({ tx: [{ id: 'a', type: 'inc', amt: 100000, ts: Date.now() - 864e5, title: 'pay', cat: 'salary', pay: 'bank', prof: 'pers' }], jars: [{ id: 'j1', name: 'Trip', goal: 100000, prof: 'pers' }] });
  const routes = [['https://accounts.google.com/gsi/client', fake]];
  const p = await openPage(b, { state: st, routes, init: "window.__cred='good-eve'" });
  await p.waitForTimeout(1200); await p.evaluate(() => settings()); await p.waitForTimeout(900);
  ok('Google button appears in Settings', await p.locator('#fg').count() === 1);
  await p.click('#fg'); await p.waitForTimeout(1800);
  ok('signed in: key and email stored', await p.evaluate(() => S.sync.key.length >= 30 && S.sync.google === 'eve@example.com'));
  ok('first backup uploaded', await p.evaluate(() => S.bk.last > 0));
  const k1 = await p.evaluate(() => S.sync.key);
  // a brand-new phone: the very first screen is the sign-in screen
  const q = await openPage(b, { routes, init: "window.__cred='good-eve'" }); await q.waitForTimeout(1500);
  ok('fresh phone opens on the sign-in screen, not onboarding', await q.evaluate(() => /Sign in to start/.test(document.body.innerText) && !/Get started/.test(document.body.innerText)));
  await q.click('#fg'); await q.waitForTimeout(2500);
  ok('second phone is offered the cloud backup', await q.evaluate(() => /Latest backup/.test(document.body.innerText)));
  ok('second phone gets its own key', await q.evaluate(k => S.sync.key && S.sync.key !== k, k1));
  await Promise.all([q.waitForNavigation(), q.evaluate(() => cloudRestore(0))]); await q.waitForTimeout(1000);
  ok('restored data and still signed in', await q.evaluate(() => S.tx.length === 1 && S.jars.length === 1 && S.sync.google === 'eve@example.com'));
  await q.evaluate(() => signOut());
  ok('sign out clears the key but keeps the data', await q.evaluate(() => S.sync.key === '' && S.tx.length === 1));
  ok('no JS errors', !p.errs.length && !q.errs.length, p.errs.concat(q.errs).join('|'));
};
