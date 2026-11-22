// Data safety: old/odd saved data loads cleanly, nothing is lost, leftovers are zeroed, storage-full is surfaced.
const { ok, T, baseState, openPage } = require('./lib');
module.exports = async b => {
  const old = { cash0: 100000, allow: 0, buf: 5000, bills: 7000, tx: [
    { id: 't1', type: 'inc', amt: 500000, ts: T('2026-11-01T09:00'), title: 'salary' },
    { id: 't2', type: 'exp', amt: 12000, ts: T('2026-11-03T09:00'), title: 'food', note: 'lunch' },
    { id: 't3', type: 'dep', amt: 30000, ts: T('2026-11-04T09:00'), jar: 'j1' }], jars: [{ id: 'j1', name: 'Trip', goal: 100000 }], wish: [{ id: 'w1', name: 'Lamp', price: 4000 }], ob: 1, lang: 'en' };
  let p = await openPage(b, { state: old, date: '2026-11-20T10:00' }); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => ({ n: S.tx.length, prof: S.tx.every(x => x.prof), jp: S.jars[0].prof, wp: S.wish[0].prof, bills: S.bills, buf: S.buf, c: C() }));
  ok('old data: no activity lost', r.n === 3);
  ok('old data: everything stamped Personal', r.prof && r.jp === 'pers' && r.wp === 'pers');
  ok('leftover hidden bills/buffer are zeroed', r.bills === 0 && r.buf === 0);
  ok('money adds up: free = cash − jars', r.c.un === r.c.cash - r.c.saved);
  ok('old data: no JS errors', !p.errs.length, p.errs.join('|'));
  // missing arrays / nulls
  p = await openPage(b, { state: { ob: 1, tx: [] }, date: '2026-11-20T10:00' }); await p.waitForTimeout(1000);
  ok('nearly-empty state loads', await p.evaluate(() => Array.isArray(S.jars) && Array.isArray(S.wish) && !!S.sync && !!S.bk) && !p.errs.length, p.errs.join('|'));
  // storage full
  p = await openPage(b, { state: baseState() }); await p.waitForTimeout(1000);
  await p.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('QuotaExceededError') }; sv() }); await p.waitForTimeout(2200);
  ok('storage full shows a warning', await p.evaluate(() => /Storage is full/.test(document.getElementById('tt').innerText)));
  // onboarding
  p = await openPage(b, {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { O.s = 1; onb() }); await p.waitForTimeout(300);
  ok('onboarding is 2 steps (no monthly-spending question)', await p.evaluate(() => !/monthly spending/i.test(document.body.innerText) && /Open Penny/.test(document.body.innerText)));
  await p.fill('input.f', '1500'); await p.click('.btn.g'); await p.waitForTimeout(500);
  ok('onboarding saves cash and opens the app', await p.evaluate(() => S.ob === 1 && S.cash0 === 150000));
  ok('onboarding: no JS errors', !p.errs.length, p.errs.join('|'));
  // the balance question can be skipped
  const k = await openPage(b, {}); await k.waitForTimeout(1500);
  await k.evaluate(() => { S.sync.skip = 1; sv(); render() }); await k.waitForTimeout(500);
  await k.evaluate(() => { O.s = 1; onb() }); await k.waitForTimeout(300);
  ok('the balance step has a Skip option', await k.evaluate(() => /Skip/.test(document.body.innerText)));
  await k.click('text=Skip'); await k.waitForTimeout(600);
  ok('Skip opens the app with no balance set', await k.evaluate(() => S.ob === 1 && S.cash0 === 0 && !document.querySelector('.ob')));
  // after skipping, the starting balance can still be set from Settings
  await k.evaluate(() => settings()); await k.waitForTimeout(700);
  ok('Settings has a Starting balance row', await k.evaluate(() => /Starting balance/.test(document.getElementById('sh').innerText)));
  await k.evaluate(() => balSheet()); await k.waitForTimeout(600);
  await k.fill('#bal', '1500'); await k.evaluate(() => saveBal()); await k.waitForTimeout(600);
  ok('setting it changes the balance (₪1,500)', await k.evaluate(() => S.cash0 === 150000 && C().cash === 150000));
  ok('and Settings shows it', await k.evaluate(() => /1,500/.test(document.getElementById('sh').innerText)));
  ok('skip: no JS errors', !k.errs.length, k.errs.join('|'));
  // build id served matches the page
  const v = await (await fetch('http://localhost:8787/version')).text();
  ok('/version matches the page build', await p.evaluate(x => window.WANT_BUILD === x.trim(), v));
};
