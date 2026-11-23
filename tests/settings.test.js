// Settings: only what is used, titles with ⓘ explanations, collapsible sections, and a language/appearance highlight that fits.
const { ok, baseState, openPage } = require('./lib');
module.exports = async b => {
  const own = { key: 'test-key-123456', bank: { bal: 100000, at: Date.now() - 36e5 * 2, name: 'Discount' }, card: { name: 'Max', at: Date.now() - 36e5 * 3 }, useBank: true, last: 0, err: '' };
  const p = await openPage(b, { state: baseState({ sync: own, tx: [{ id: 'a', type: 'inc', amt: 100000, ts: Date.now() - 864e5, title: 'pay', cat: 'salary', pay: 'bank', prof: 'pers' }] }) });
  await p.waitForTimeout(2500); await p.evaluate(() => settings()); await p.waitForTimeout(900);
  const txt = (await p.evaluate(() => [...document.querySelectorAll('#sh .gt, #sh .gl, #sh .shd')].map(e => e.innerText).join('\n'))).replace(/^.*$/gm, l => l[0] + l.slice(1).toLowerCase());
  for (const gone of ['Wishlist', 'Import service URL', 'Apple Pay', 'Add from Safari', 'Quick add', 'Back Tap', 'Recurring', 'Review payments', 'Restore from cloud', 'Undo last restore']) ok(`removed from Settings: ${gone}`, !txt.toLowerCase().includes(gone.toLowerCase()));
  for (const there of ['Account', 'General', 'Jars', 'Upcoming payments', 'Connections', 'Data', 'Reserve upcoming payments', 'Sync bank & card', 'Back up now', 'Copy backup', 'Restore from backup', 'Reset all data']) ok(`kept: ${there}`, txt.toLowerCase().includes(there.toLowerCase()));
  ok('bank and card are one line, with the last update', await p.evaluate(() => { const r = [...document.querySelectorAll('#sh .gr')].filter(x => /Sync bank & card/.test(x.innerText)); return r.length === 1 && /ago|just now/.test(r[0].innerText) }));
  // titles only; explanation opens from the ⓘ with an animation
  ok('rows show titles only (explanation hidden)', await p.evaluate(() => { const x = [...document.querySelectorAll('#sh .gx')][0]; return x && getComputedStyle(x).opacity === '0' }));
  await p.evaluate(() => document.querySelector('#sh .gw .ii').click()); await p.waitForTimeout(600);
  ok('ⓘ opens the explanation', await p.evaluate(() => { const w = document.querySelector('#sh .gw .ii').closest('.gw'); const x = w.querySelector('.gx'); return x.classList.contains('o') && getComputedStyle(x).opacity === '1' && x.getBoundingClientRect().height > 10 }));
  await p.evaluate(() => document.querySelector('#sh .gw .ii').click()); await p.waitForTimeout(600);
  ok('ⓘ closes it again', await p.evaluate(() => !document.querySelector('#sh .gw .ii').closest('.gw').querySelector('.gx').classList.contains('o')));
  // collapsible sections, remembered
  const h0 = await p.evaluate(() => [...document.querySelectorAll('#sh .grp')].find(g => /data/i.test(g.querySelector('.gl')?.innerText || '')).querySelector('.gc').getBoundingClientRect().height);
  await p.evaluate(() => [...document.querySelectorAll('#sh .gh')].find(x => /data/i.test(x.innerText)).click()); await p.waitForTimeout(700);
  const h1 = await p.evaluate(() => [...document.querySelectorAll('#sh .grp')].find(g => /data/i.test(g.querySelector('.gl')?.innerText || '')).querySelector('.gcw').getBoundingClientRect().height);
  ok('a section collapses', h0 > 100 && h1 < 4, h0 + ' -> ' + h1);
  ok('and is remembered', await p.evaluate(() => S.col && S.col.dat === 1));
  await p.evaluate(() => { settings() }); await p.waitForTimeout(700);
  ok('still collapsed after reopening Settings', await p.evaluate(() => [...document.querySelectorAll('#sh .grp')].find(g => /data/i.test(g.querySelector('.gl')?.innerText || '')).classList.contains('c')));
  await p.evaluate(() => [...document.querySelectorAll('#sh .gh')].find(x => /data/i.test(x.innerText)).click()); await p.waitForTimeout(500);
  // the highlight fits the selected word exactly, in both languages and both controls
  const fit = () => p.evaluate(() => ['s_lang', 's_th'].map(id => { const s = document.querySelector(`.seg[data-sid="${id}"]`), i = s.querySelector('i'), bt = s.querySelectorAll('button')[+s.dataset.i], a = i.getBoundingClientRect(), c = bt.getBoundingClientRect(); return { id, dw: Math.abs(a.width - c.width), dx: Math.abs((a.left + a.width / 2) - (c.left + c.width / 2)) } }));
  for (const r of await fit()) ok(`English: ${r.id} highlight matches the selected word`, r.dw < 1.5 && r.dx < 1.5, JSON.stringify(r));
  await p.evaluate(() => setOpt('lang', 'he')); await p.waitForTimeout(900);
  for (const r of await fit()) ok(`Hebrew: ${r.id} highlight matches the selected word`, r.dw < 1.5 && r.dx < 1.5, JSON.stringify(r));
  // no flash: right after switching, the highlight is already under the chosen word (sampled immediately, before any glide could finish)
  const early = await p.evaluate(() => new Promise(res => { setOpt('lang', 'en'); requestAnimationFrame(() => { const s = document.querySelector('.seg[data-sid="s_lang"]'), a = s.querySelector('i').getBoundingClientRect(), c = s.querySelectorAll('button')[+s.dataset.i].getBoundingClientRect(); res(Math.abs((a.left + a.width / 2) - (c.left + c.width / 2))) }) }));
  ok('switching language: highlight is on the chosen word from the first frame (no blink)', early < 2, String(early));
  await p.evaluate(() => setOpt('theme', 'dark')); await p.waitForTimeout(800);
  for (const r of await fit()) ok(`after theme change: ${r.id} still fits`, r.dw < 1.5 && r.dx < 1.5, JSON.stringify(r));
  ok('theme changed', await p.evaluate(() => S.theme === 'dark'));
  // the balance setting is shown even when a bank is connected (it sets each profile's balance)
  ok('with a bank connected the balance setting is still there', await p.evaluate(() => /(Starting|Current) balance/.test(document.getElementById('sh').innerText)));
  // an owner with no bank or card connected yet sees no bank row at all
  await fetch('http://localhost:8787/__kvclear?prefix=bank'); await fetch('http://localhost:8787/__kvclear?prefix=card'); // other tests push bank and card data for the owner; start clean
  const nb = await openPage(b, { state: baseState({ sync: { key: 'test-key-123456', bank: null, card: null, useBank: false, last: 0, err: '' } }) }); await nb.waitForTimeout(3000);
  await nb.evaluate(() => settings()); await nb.waitForTimeout(800);
  ok('no bank connected: no "Sync bank & card" row and no Connections group', await nb.evaluate(() => { const t = document.getElementById('sh').innerText; return !/sync bank & card/i.test(t) && !/connections/i.test(t) }));
  // sign-in + data rows for a phone without a key
  const q = await openPage(b, { state: baseState() }); await q.waitForTimeout(1500); await q.evaluate(() => settings()); await q.waitForTimeout(800);
  const t2 = await q.evaluate(() => document.getElementById('sh').innerText);
  ok('phone without an account offers sign-in and no bank rows', /sign in/i.test(t2) && !/sync bank & card/i.test(t2) && !/connections/i.test(t2));
  ok('no JS errors', !p.errs.length && !q.errs.length && !nb.errs.length, [...p.errs, ...q.errs, ...nb.errs].join('|'));
};
