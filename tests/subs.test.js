// Subscriptions: monthly total, price-change alert (once), small FX wobble ignored.
const { ok, T, baseState, openPage } = require('./lib');
const R = (id, amt, ts, title) => ({ id, type: 'exp', amt, ts: T(ts), title, cat: 'subs', pay: 'card', prof: 'pers', src: 'card' });
module.exports = async b => {
  const st = baseState({ upcOn: true, cash0: 0, tx: [
    R('n1', 5500, '2026-10-28T09:00', 'NETFLIX.COM            AMSTERDAM     NL'), R('n2', 6500, '2026-11-28T09:00', 'NETFLIX.COM            AMSTERDAM     NL'),
    R('a1', 18500, '2026-10-27T09:00', 'ADOBE                  ADOBE.COM     IE'), R('a2', 18620, '2026-11-27T09:00', 'ADOBE                  ADOBE.COM     IE'),
    R('s1', 2500, '2026-10-15T09:00', 'SPOTIFY                STOCKHOLM     SE'), R('s2', 2500, '2026-11-15T09:00', 'SPOTIFY                STOCKHOLM     SE')] });
  const p = await openPage(b, { state: st, date: '2026-12-10T10:00' }); await p.waitForTimeout(3600);
  const nt = await p.evaluate(() => document.getElementById('nt') && document.getElementById('nt').innerText);
  ok('alerts the 18% price rise', /NETFLIX\.COM: .*55.*65/.test(nt || ''), nt);
  ok('ignores a 0.6% wobble', !/ADOBE/.test(nt || ''));
  await p.evaluate(() => upcoming()); await p.waitForTimeout(500);
  const tx = await p.evaluate(() => document.getElementById('sh').innerText);
  ok('monthly total is the sum (₪276.20)', /276\.20/.test(tx));
  ok('yearly total shown', /3,314\.40/.test(tx));
  ok('row shows old → new price', /↑\s₪55\s→\s₪65/.test(tx));
  await p.reload(); await p.waitForTimeout(3600);
  ok('same change is not announced twice', await p.evaluate(() => !document.getElementById('nt') || !document.getElementById('nt').classList.contains('o')));
  ok('no JS errors', !p.errs.length, p.errs.join('|'));
};
