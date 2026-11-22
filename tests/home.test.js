// Home layout: the first jar lines up with the cards (both languages); the Recent heading sits inside its card.
const { ok, baseState, openPage } = require('./lib');
module.exports = async b => {
  const now = Date.now();
  const mk = lang => baseState({ lang, prof: 'pers', cash0: 300000, sync: { key: '', bank: null, card: null, useBank: false, last: 0, err: '', skip: 1 },
    tx: [{ id: 'a', type: 'inc', amt: 900000, ts: now - 9e8, title: 'Salary', cat: 'salary', pay: 'bank', prof: 'pers' }, { id: 'b', type: 'exp', amt: 4800, ts: now - 864e5, title: 'Pizza', cat: 'food', pay: 'card', prof: 'pers' }, { id: 'c', type: 'dep', amt: 250000, ts: now - 2 * 864e5, jar: 'j1', prof: 'pers' }],
    jars: [{ id: 'j1', name: 'Savings', goal: 0, prof: 'pers', pin: 1 }, { id: 'j2', name: 'Trip', goal: 3000000, prof: 'pers' }, { id: 'j3', name: 'Phone', goal: 250000, prof: 'pers' }, { id: 'j4', name: 'Car', goal: 5000000, prof: 'pers' }] });
  for (const lang of ['en', 'he']) {
    const p = await openPage(b, { state: mk(lang) }); await p.waitForTimeout(2200);
    const m = await p.evaluate(() => { const car = document.querySelector('.car'), j = car.querySelector('.jc').getBoundingClientRect(), c = document.querySelector('.card').getBoundingClientRect(), rc = document.querySelector('.card.rc'), sec = rc && rc.querySelector('.sec'); return { jl: j.left, jr: j.right, cl: c.left, cr: c.right, inside: !!sec && rc.contains(sec), secBg: sec ? getComputedStyle(sec).backgroundColor : '', secTop: sec && sec.getBoundingClientRect().top, rcTop: rc && rc.getBoundingClientRect().top, vw: innerWidth } });
    const edge = lang === 'en' ? Math.abs(m.jl - m.cl) : Math.abs(m.jr - m.cr);
    ok(`${lang}: the first jar starts on the same line as the cards (${edge.toFixed(1)}px off)`, edge < 1.5, JSON.stringify(m));
    ok(`${lang}: the Recent heading is inside the Recent card`, m.inside && m.secTop >= m.rcTop);
    ok(`${lang}: no separate background behind the heading`, /rgba\(0, 0, 0, 0\)|transparent/.test(m.secBg));
    ok(`${lang}: no JS errors`, !p.errs.length, p.errs.join('|'));
    await p.context().close();
  }
};
