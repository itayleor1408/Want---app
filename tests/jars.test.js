// Jar plans (amount / % of income / none), the jar editor, and history entries that must not change the balance.
const { ok, T, baseState, openPage } = require('./lib');
const D = '2026-11-20T10:00';
const inc = (id, amt, ts, prof) => ({ id, type: 'inc', amt, ts: T(ts), title: 'Salary', cat: 'salary', pay: 'bank', prof });
module.exports = async b => {
  const st = baseState({
    cash0: 100000000, cash0Date: T('2026-11-20T00:00'),   // a big balance: percent plans must NOT be taken from it
    tx: [inc('i1', 900000, '2026-11-02T09:00', 'pers'), inc('i2', 500000, '2026-11-03T09:00', 'work'), inc('i3', 400000, '2026-10-05T09:00', 'pers')],
    jars: [{ id: 'jp', name: 'Pers', goal: 5000000, prof: 'pers', pct: 10, freq: 'm', plan: 0, next: T('2026-11-01T09:00'), pin: true },
           { id: 'jb', name: 'Both', goal: 5000000, prof: 'both', pct: 10, freq: 'm', plan: 0, next: T('2026-11-01T09:00') },
           { id: 'jw', name: 'Work', goal: 5000000, prof: 'work', pct: 20, freq: 'm', plan: 0, next: T('2026-11-01T09:00') },
           { id: 'jf', name: 'Fixed', goal: 1000000, prof: 'pers', freq: 'm', plan: 20000, next: T('2026-11-01T09:00') }] });
  const p = await openPage(b, { state: st, date: D }); await p.waitForTimeout(1800);
  const r = await p.evaluate(() => ({ pers: jPlan(S.jars[0]), both: jPlan(S.jars[1]), work: jPlan(S.jars[2]), fixed: jPlan(S.jars[3]) }));
  ok('percent of the profile\'s income this month (10% of 9,000 = 900)', r.pers === 90000, JSON.stringify(r));
  ok('a shared jar uses the income of both profiles (10% of 14,000 = 1,400)', r.both === 140000);
  ok('a work jar uses only work income (20% of 5,000 = 1,000)', r.work === 100000);
  ok('a fixed amount still works', r.fixed === 20000);
  ok('percent is never taken from the balance', r.pers < 1000000);
  await p.evaluate(() => { S.tx = S.tx.filter(x => x.id === 'i3'); sv() });
  ok('no income yet this month: falls back to last month (10% of 4,000)', await p.evaluate(() => jPlan(S.jars[0]) === 40000));
  await p.evaluate(() => { S.tx = [{ id: 'i1', type: 'inc', amt: 900000, ts: new Date('2026-11-02T09:00').getTime(), title: 'Salary', cat: 'salary', pay: 'bank', prof: 'pers' }, { id: 'i2', type: 'inc', amt: 500000, ts: new Date('2026-11-03T09:00').getTime(), title: 'Salary', cat: 'salary', pay: 'bank', prof: 'work' }]; sv() });
  // depositing a percent plan
  await p.evaluate(() => confirmPlan('jb')); await p.waitForTimeout(500);
  const dep = await p.evaluate(() => S.tx.filter(x => x.jar === 'jb' && x.type === 'dep').map(x => x.prof + ':' + x.amt).sort());
  ok('shared percent jar deposits each profile\'s own share (pers 900 + work 500)', dep.join() === 'pers:90000,work:50000', dep.join());
  // the editor
  await p.evaluate(() => editJar('jp')); await p.waitForTimeout(600);
  const tx = await p.evaluate(() => document.getElementById('sh').innerText);
  ok('editor: no "Pin to top" and no "Next deposit"', !/pin to top/i.test(tx) && !/next deposit/i.test(tx));
  ok('editor: Monthly saving has Amount / % of income / No plan', /Amount/.test(tx) && /% of income/.test(tx) && /No plan/.test(tx));
  await p.evaluate(() => { ejm('pct'); document.getElementById('epc').value = '12.5'; saveJarEdit('jp') }); await p.waitForTimeout(500);
  ok('editor saves a percent (12.5) and keeps the existing pin', await p.evaluate(() => { const j = S.jars[0]; return j.pct === 12.5 && j.pin === true && j.plan === 0 && j.freq === 'm' }));
  await p.evaluate(() => { close() }); await p.waitForTimeout(500);
  await p.evaluate(() => editJar('jp')); await p.waitForTimeout(500);
  await p.evaluate(() => { ejm('none'); saveJarEdit('jp') }); await p.waitForTimeout(500);
  ok('"No plan" clears the monthly saving', await p.evaluate(() => { const j = S.jars[0]; return !j.pct && !j.plan && !j.next }));
  // creating a jar from a wish does not force a monthly amount
  await p.evaluate(() => { S.wish.push({ id: 'w1', name: 'Lamp', price: 15000, prof: 'pers', st: 'want' }); sv(); startSave('w1') }); await p.waitForTimeout(700);
  ok('wish jar: "No plan" is selected by default', await p.evaluate(() => /No monthly amount/.test(document.getElementById('sh').innerText) && !document.getElementById('pnone').hidden));
  await p.evaluate(() => mkJar()); await p.waitForTimeout(500);
  ok('wish jar created without any monthly plan', await p.evaluate(() => { const j = S.jars.find(x => x.name === 'Lamp'); return j && j.plan === 0 && !j.pct && !j.next && S.wish[0].jar === j.id }));
  // the % sign shows after typing and goes away when typing again
  await p.evaluate(() => { newJar({ name: 'Pct', target: 100000 }); gmode('pct') }); await p.waitForTimeout(500);
  await p.focus('#pc'); await p.keyboard.type('12.5'); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(200);
  ok('after typing, the number shows with a % sign', await p.evaluate(() => document.getElementById('pc').value === '12.5%'));
  ok('the percent still counts (12.5)', await p.evaluate(() => G.pct === 12.5));
  await p.focus('#pc'); await p.waitForTimeout(200);
  ok('typing again removes the % sign', await p.evaluate(() => document.getElementById('pc').value === '12.5'));
  await p.evaluate(() => { document.activeElement.blur(); close() }); await p.waitForTimeout(400);
  // creating with a percent
  await p.evaluate(() => { newJar({ name: 'Trip', target: 2000000 }); G.mode = 'pct'; G.pct = 15; mkJar() }); await p.waitForTimeout(400);
  ok('new jar with 15% of income', await p.evaluate(() => { const j = S.jars.find(x => x.name === 'Trip'); return j.pct === 15 && j.freq === 'm' && j.plan === 0 && j.next > 0 }));
  ok('jar details show the percent', await p.evaluate(() => { jarSheet(S.jars.find(x => x.name === 'Trip').id); return true }) && (await p.waitForTimeout(500), await p.evaluate(() => /15%/.test(document.getElementById('sh').innerText))));
  ok('no JS errors (jars)', !p.errs.length, p.errs.join('|'));
  // history entries must not take money off the balance again
  const h = baseState({ cash0: 100000, cash0Date: T('2026-11-20T00:00'), tx: [
      { id: 'e1', type: 'exp', amt: 10000, ts: T('2026-11-10T12:00'), title: 'Before I started', cat: 'food', pay: 'card', prof: 'pers' },
      { id: 'e2', type: 'exp', amt: 5000, ts: T('2026-11-20T11:00'), title: 'Today', cat: 'food', pay: 'card', prof: 'pers' }] });
  const q = await openPage(b, { state: h, date: D }); await q.waitForTimeout(1500);
  const c = await q.evaluate(() => { const x = C(); return { cash: x.cash, spent: x.spent } });
  ok('an expense from before the opening-balance day does not lower the balance', c.cash === 95000, JSON.stringify(c));
  ok('but it still counts in what you spent this month', c.spent === 15000);
  // income from before the starting day adds to nothing either
  const pi = await openPage(b, { state: baseState({ cash0: 100000, cash0Date: T('2026-11-20T00:00'), tx: [{ id: 'p1', type: 'inc', amt: 50000, ts: T('2026-11-05T09:00'), title: 'Bonus', cat: 'gift', pay: 'bank', prof: 'pers' }, { id: 'p2', type: 'inc', amt: 20000, ts: T('2026-11-20T11:00'), title: 'Today bonus', cat: 'gift', pay: 'bank', prof: 'pers' }] }), date: D }); await pi.waitForTimeout(1500);
  const pc = await pi.evaluate(() => { const x = C(); return { cash: x.cash, extra: x.bud - x.bud + 0, bud: x.bud } });
  ok('income from before the starting day does not raise the balance (only today\'s does)', pc.cash === 120000, JSON.stringify(pc));
  // an older phone (no opening-balance day) can mark an entry as already in the balance
  const o = await openPage(b, { state: baseState({ cash0: 100000, tx: [{ id: 'e1', type: 'exp', amt: 10000, ts: T('2026-11-10T12:00'), title: 'Old', cat: 'food', pay: 'card', prof: 'pers' }] }), date: D }); await o.waitForTimeout(1500);
  ok('without the day set, past expenses still lower the balance (as before)', await o.evaluate(() => C().cash === 90000));
  await o.evaluate(() => entry('exp', 'e1')); await o.waitForTimeout(600);
  ok('editing a past entry offers "Already in my balance"', await o.evaluate(() => /Already in my balance/.test(document.getElementById('sh').innerText)));
  await o.evaluate(() => { N.pre = true; saveEntry() }); await o.waitForTimeout(600);
  ok('marking it removes it from the balance only', await o.evaluate(() => { const x = C(); return x.cash === 100000 && x.spent === 10000 }));
  ok('no JS errors (history)', !q.errs.length && !o.errs.length, [...q.errs, ...o.errs].join('|'));
};
