// Activity: filter by any category (expense or income, custom tags too); and the bigger icon set.
const { ok, T, baseState, openPage } = require('./lib');
const D = '2026-11-20T10:00';
const e = (id, amt, day, title, cat) => ({ id, type: 'exp', amt, ts: T(`2026-11-${day}T12:00`), title, cat, pay: 'card', prof: 'pers' });
module.exports = async b => {
  const st = baseState({ tags: { exp: [{ k: 'c_nails', name: 'Nails', icon: 'nails' }], inc: [] },
    tx: [e('a', 5000, '10', 'Aroma', 'food'), e('b', 3000, '11', 'Pizza', 'food'), e('c', 6500, '12', 'Netflix', 'subs'), e('d', 12000, '13', 'Salon', 'c_nails'),
         { id: 'i1', type: 'inc', amt: 900000, ts: T('2026-11-02T09:00'), title: 'Monthly pay', cat: 'salary', pay: 'bank', prof: 'pers' }, { id: 'i2', type: 'inc', amt: 20000, ts: T('2026-11-03T09:00'), title: 'Birthday money', cat: 'gift', pay: 'cash', prof: 'pers' }] });
  const p = await openPage(b, { state: st, date: D }); await p.waitForTimeout(1500);
  await p.evaluate(() => go('act')); await p.waitForTimeout(800);
  const list = () => p.evaluate(() => document.getElementById('al').innerText);
  ok('a Category chip sits with the other filters', await p.evaluate(() => /Category/.test(document.getElementById('afchips').innerText)));
  await p.evaluate(() => catPick()); await p.waitForTimeout(600);
  const sheet = await p.evaluate(() => document.getElementById('sh').innerText);
  ok('the picker lists expense and income categories that have entries', /Food/.test(sheet) && /Subscriptions/.test(sheet) && /Nails/.test(sheet) && /Salary/.test(sheet) && /Gift/.test(sheet));
  ok('each category shows how many entries and the total', /2 · ₪80/.test(sheet.replace(/\n/g, ' ')), sheet.replace(/\n/g, ' ').slice(0, 200));
  await p.evaluate(() => setAC('food')); await p.waitForTimeout(500);
  let l = await list(); ok('Food: only food entries are shown', /Aroma/.test(l) && /Pizza/.test(l) && !/Netflix/.test(l) && !/Monthly pay/.test(l));
  await p.evaluate(() => setAC('c_nails')); await p.waitForTimeout(500);
  l = await list(); ok('a custom tag filters too', /Salon/.test(l) && !/Aroma/.test(l));
  await p.evaluate(() => setAC('i:salary')); await p.waitForTimeout(500);
  l = await list(); ok('Income categories filter too', /Monthly pay/.test(l) && !/Birthday money/.test(l) && !/Aroma/.test(l));
  ok('the chip shows the chosen category', await p.evaluate(() => /Salary/.test(document.getElementById('afchips').innerText)));
  await p.evaluate(() => setAC('')); await p.waitForTimeout(500);
  l = await list(); ok('clearing it shows everything again', /Aroma/.test(l) && /Monthly pay/.test(l) && /Salon/.test(l));
  // icons
  const ic = await p.evaluate(() => ({ n: ICONS.length, missing: ICONS.filter(k => !ICO[k]), dup: ICONS.length - new Set(ICONS).size, nails: ICO.nails !== ICO.other && /<path/.test(ic('nails')) }));
  ok('over 100 icons to choose from, each defined, none repeated', ic.n >= 100 && !ic.missing.length && ic.dup === 0, JSON.stringify(ic));
  ok('there is a nails icon', ic.nails);
  await p.evaluate(() => { go('home'); entry('exp'); }); await p.waitForTimeout(600);
  await p.evaluate(() => { tagForm('', 'n') }); await p.waitForTimeout(600);
  ok('the new-tag screen offers the new icons', await p.evaluate(() => document.querySelectorAll('.igr button').length >= 100 && !!document.querySelector('.igr button[data-n="nails"]')));
  ok('no JS errors', !p.errs.length, p.errs.join('|'));
};
