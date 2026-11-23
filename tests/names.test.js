// Card/bank names that arrive written backwards ("IRPAC AZZIP"): fixed when clear, flippable, and remembered.
const { ok, baseState, openPage } = require('./lib');
const OWN = 'test-key-123456';
const send = (p, merchant, amount) => p.evaluate(async ([m, a]) => { await fetch('/api/ingest', { method: 'POST', headers: { authorization: 'Bearer test-key-123456', 'content-type': 'application/json' }, body: JSON.stringify({ merchant: m, amount: a, source: 'card' }) }) }, [merchant, amount]);
module.exports = async b => {
  await fetch('http://localhost:8787/__kvclear?prefix=inbox'); await fetch('http://localhost:8787/__kvclear?prefix=seen');
  const st = baseState({ sync: { key: OWN, bank: null, card: null, useBank: false, last: 0, err: '', claimAt: Date.now() }, tx: [{ id: 'n0', type: 'exp', amt: 5500, ts: Date.now() - 864e5 * 5, title: 'Netflix', cat: 'subs', pay: 'card', prof: 'pers' }, { id: 'n1', type: 'exp', amt: 4000, ts: Date.now() - 864e5 * 9, title: 'Pizza Capri', cat: 'food', pay: 'card', prof: 'pers' }] });
  const p = await openPage(b, { state: st }); await p.waitForTimeout(2500);
  const u = await p.evaluate(() => ({
    flip: fixName('IRPAC AZZIP'),
    keep: ['PIZZA CAPRI', 'NETFLIX.COM            AMSTERDAM     NL', 'ADOBE                  ADOBE.COM     IE', 'SPOTIFY                STOCKHOLM     SE', 'AMAZON', 'ZARA', 'GOOGLE', 'WOLT', 'RAMI LEVY', 'AROMA ESPRESSO BAR', 'CAFE NOIR', 'MCDONALDS', 'SHUFERSAL', 'PAYPAL', 'IKEA', 'BOOKING.COM', 'פיצה קפרי'].filter(x => fixName(x) !== x),
    known: fixName('XILFTEN') }));
  ok('"IRPAC AZZIP" is put right when "Pizza Capri" is already one of your names', u.flip.toLowerCase() === 'pizza capri', u.flip);
  ok('normal names are left alone (' + (u.keep.length ? 'changed: ' + u.keep.join(', ') : 'none changed') + ')', u.keep.length === 0);
  ok('a backwards name that matches one you already have is put right', u.known === 'XILFTEN'.split('').reverse().join(''));
  // through the real sync + review sheet
  await send(p, 'IRPAC AZZIP', 41.1); await p.evaluate(() => syncNow(true)); await p.waitForTimeout(1800);
  const r = await p.evaluate(() => ({ t: S.pending[0] && S.pending[0].title, raw: S.pending[0] && S.pending[0].raw, sheet: !!document.getElementById('rvt'), flip: !!document.getElementById('rvf'), val: document.getElementById('rvt') && document.getElementById('rvt').value }));
  ok('a synced backwards name shows corrected in the review sheet', r.t.toLowerCase() === 'pizza capri' && r.raw === 'IRPAC AZZIP', JSON.stringify(r));
  ok('the sheet offers a flip button for Latin names', r.flip);
  await p.evaluate(() => rvFlip()); await p.waitForTimeout(300);
  ok('flip turns it back (and Penny remembers the choice)', await p.evaluate(() => document.getElementById('rvt').value === 'IRPAC AZZIP' && S.fixmap['irpac azzip'] === 'keep'));
  await p.evaluate(() => { S.pending = []; close() }); await p.waitForTimeout(300);
  await send(p, 'IRPAC AZZIP', 42.2); await p.evaluate(() => syncNow(true)); await p.waitForTimeout(1500);
  ok('and Penny remembers: the same raw name stays as you chose', await p.evaluate(() => S.pending[0] && S.pending[0].title === 'IRPAC AZZIP'));
  // a name the guess does not catch: flip once, remembered after
  await p.evaluate(() => { S.pending = []; close() }); await p.waitForTimeout(300);
  await send(p, 'ELBMAS', 12.3); await p.evaluate(() => syncNow(true)); await p.waitForTimeout(1500);
  ok('an unrecognised name arrives as is', await p.evaluate(() => S.pending[0] && S.pending[0].title === 'ELBMAS'));
  await p.evaluate(() => rvFlip()); await p.evaluate(() => { S.pending = []; close() }); await p.waitForTimeout(300);
  await send(p, 'ELBMAS', 13.4); await p.evaluate(() => syncNow(true)); await p.waitForTimeout(1500);
  ok('after one flip the next one arrives already right (SAMBLE)', await p.evaluate(() => S.pending[0] && S.pending[0].title === 'SAMBLE'));
  ok('no JS errors', !p.errs.length, p.errs.join('|'));
};
