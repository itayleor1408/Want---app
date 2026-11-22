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
  ok('onboarding is 2 steps (no monthly-spending question)', await p.evaluate(() => !/monthly spending/i.test(document.body.innerText) && /Open Brim/.test(document.body.innerText)));
  await p.fill('input.f', '1500'); await p.click('.btn.g'); await p.waitForTimeout(500);
  ok('onboarding saves cash and opens the app', await p.evaluate(() => S.ob === 1 && S.cash0 === 150000));
  ok('onboarding: no JS errors', !p.errs.length, p.errs.join('|'));
  // Apple Pay setup guide must be reachable from Settings, with working copy buttons
  p = await openPage(b, { state: baseState({ sync: { key: 'test-key-123456', bank: null, card: null, useBank: false, last: 0, err: '' } }) }); await p.waitForTimeout(1500);
  await p.evaluate(() => settings()); await p.waitForTimeout(700);
  ok('Settings has an Apple Pay row', await p.evaluate(() => [...document.querySelectorAll('#sh .gr')].some(x => /Apple Pay/.test(x.innerText))));
  await p.evaluate(() => [...document.querySelectorAll('#sh .gr')].find(x => /Apple Pay/.test(x.innerText)).click()); await p.waitForTimeout(500);
  ok('the guide shows the address and the copy-key button', await p.evaluate(() => /Copy key/.test(document.getElementById('sh').innerText) && /Copy address/.test(document.getElementById('sh').innerText)));
  // build id served matches the page
  const v = await (await fetch('http://localhost:8787/version')).text();
  ok('/version matches the page build', await p.evaluate(x => window.WANT_BUILD === x.trim(), v));
};
