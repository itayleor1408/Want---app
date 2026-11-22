// A monthly item you set up and the same card charge arriving from sync must stay ONE payment.
const { ok, baseState, openPage } = require('./lib');
const D = '2026-12-10T10:00';
const rec = { id: 'r1', type: 'exp', amt: 6500, title: 'NETFLIX', freq: 'monthly', day: 1, cat: 'subs', prof: 'pers' };
module.exports = async b => {
  // A: the recurring item logs itself first, then the real card charge arrives
  let p = await openPage(b, { state: baseState({ recur: [rec] }), date: D }); await p.waitForTimeout(1200);
  await p.evaluate(() => joinCloud()); await p.waitForTimeout(1200);
  await p.evaluate(() => checkRecurAuto());
  ok('A: recurring item logged once', await p.evaluate(() => S.tx.filter(x => x.src == 'recur:r1').length === 1));
  await p.evaluate(() => fetch('/api/ingest', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, AUTH()), body: JSON.stringify({ amount: 65.4, merchant: 'NETFLIX.COM', date: '2026-12-08T08:00', id: 'cd_x1', source: 'applepay' }) }));
  await p.evaluate(() => syncNow(true)); await p.waitForTimeout(1200);
  const A = await p.evaluate(() => ({ tx: S.tx.filter(x => /netflix/i.test(x.title)).length, pend: S.pending.length, amt: S.tx.find(x => x.src == 'recur:r1').amt, ext: S.tx.find(x => x.src == 'recur:r1').ext }));
  ok('A: card charge merged into it (1 payment, 0 waiting)', A.tx === 1 && A.pend === 0 && A.ext === 'cd_x1');
  ok('A: the real card amount wins', A.amt === 6540);
  // B: the real charge arrives first, then the recurring day passes
  p = await openPage(b, { state: baseState({ recur: [Object.assign({}, rec, { day: 28 })] }), date: D }); await p.waitForTimeout(1200); // its day (28th) has not come yet
  await p.evaluate(() => joinCloud()); await p.waitForTimeout(1200);
  await p.evaluate(() => fetch('/api/ingest', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, AUTH()), body: JSON.stringify({ amount: 65, merchant: 'NETFLIX.COM', date: '2026-12-02T08:00', id: 'cd_x2' }) }));
  await p.evaluate(() => syncNow(true)); await p.waitForTimeout(1200);
  await p.evaluate(() => { S.recur[0].day = 5; sv(); checkRecurAuto() }); // ...and now its day passes
  ok('B: recurring item does not add a second copy', await p.evaluate(() => !S.tx.some(x => x.src == 'recur:r1')));
  ok('B: the card charge is waiting for review once', await p.evaluate(() => S.pending.length === 1));
  // C: unrelated charge of a similar amount is NOT swallowed
  p = await openPage(b, { state: baseState({ recur: [rec] }), date: D }); await p.waitForTimeout(1200);
  await p.evaluate(() => joinCloud()); await p.waitForTimeout(1200);
  await p.evaluate(() => checkRecurAuto());
  await p.evaluate(() => fetch('/api/ingest', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, AUTH()), body: JSON.stringify({ amount: 64, merchant: 'SUPERMARKET', date: '2026-12-05T08:00', id: 'cd_x3' }) }));
  await p.evaluate(() => syncNow(true)); await p.waitForTimeout(1200);
  ok('C: a different merchant stays separate', await p.evaluate(() => S.tx.filter(x => x.src == 'recur:r1' && !x.ext).length === 1 && S.pending.length === 1));
  // D: the sync report in Settings tells what arrived (owner only)
  p = await openPage(b, { state: baseState({ sync: { key: 'test-key-123456', bank: null, card: null, useBank: false, last: 0, err: '' } }), date: D }); await p.waitForTimeout(1500);
  await p.evaluate(async () => { const h = Object.assign({ 'content-type': 'application/json' }, AUTH()); await fetch('/api/card', { method: 'POST', headers: h, body: JSON.stringify({ cardName: 'Max', txns: [{ date: '2026-12-09', amount: -50, description: 'SHUFERSAL', id: 'rep1' }, { date: '2026-12-09', amount: -20, description: 'AROMA', id: 'rep2' }] }) }) });
  await p.evaluate(() => syncNow(true)); await p.waitForTimeout(1500);
  await p.evaluate(() => settings()); await p.waitForTimeout(700);
  ok('D: Settings shows what arrived from the card', await p.evaluate(() => /Last arrivals/.test(document.body.innerText) && /Card 2/.test(document.body.innerText) && /2 waiting for review/.test(document.body.innerText)));
  ok('no JS errors', !p.errs.length, p.errs.join('|'));
};
