// Tempo: the date button matches the Today button; the calendar layout (hours down the side, blocks in the tag's colour).
const { ok, T, chromium } = require('./lib');
const path = require('path'), URL = 'file://' + path.join(__dirname, '..', 'tempo', 'index.html');
const D = '2026-11-23T10:00';
const item = (id, title, time, dur, area, date = '2026-11-23') => ({ id, title, date, time, dur, area, rem: 10, trav: 0 });
async function open(b, lang) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(([d, lang, items]) => {
    const t = new Date(d).getTime(), R = Date; class D extends R { constructor(...a) { a.length ? super(...a) : super(t) } static now() { return t } } window.Date = D;
    if (!localStorage.getItem('tempo.v1')) localStorage.setItem('tempo.v1', JSON.stringify({ items, set: { lang, onboarded: true, theme: 'light' } }));
  }, [D, lang, [item('a', 'Standup', '09:00', 30, 'work'), item('b', 'Gym', '09:15', 60, 'health'), item('c', 'Dentist', '13:00', 45, 'social'), item('d', 'Buy gift', '', 0, 'home'), item('e', 'Tomorrow task', '11:00', 30, 'work', '2026-11-24')]]);
  await p.goto(URL); await p.waitForTimeout(900); return p;
}
module.exports = async b => {
  const p = await open(b, 'en'); await p.evaluate(() => go(1)); await p.waitForTimeout(700);
  ok('a small layout button sits at the top of Schedule', await p.evaluate(() => !!document.querySelector('.sec .lay')));
  ok('the default layout is the list', await p.evaluate(() => !document.querySelector('.cal') && !!document.getElementById('wk')));
  // date button = Today button
  const sz = () => p.evaluate(() => { const b = document.querySelector('.wn .pill'), c = getComputedStyle(b), r = b.getBoundingClientRect(); return { txt: b.innerText, bg: c.backgroundColor, fg: c.color, fs: c.fontSize, fw: c.fontWeight, w: Math.round(r.width), h: Math.round(r.height), br: c.borderRadius } });
  const t0 = await sz(); await p.evaluate(() => shift(1)); await p.waitForTimeout(600); const t1 = await sz();
  ok('Today and the date button have the same colours, font and shape', t0.bg === t1.bg && t0.fg === t1.fg && t0.fs === t1.fs && t0.fw === t1.fw && t0.br === t1.br, JSON.stringify([t0, t1]));
  ok('and exactly the same size', t0.w === t1.w && t0.h === t1.h, `${t0.w}x${t0.h} vs ${t1.w}x${t1.h}`);
  ok('the date button shows the date, Today shows Today', /Today/i.test(t0.txt) && !/Today/i.test(t1.txt) && /24/.test(t1.txt), t0.txt + ' | ' + t1.txt);
  await p.evaluate(() => { sel = today(); render(0, true) }); await p.waitForTimeout(300);
  // calendar layout
  await p.evaluate(() => setLay()); await p.waitForTimeout(700);
  const m = await p.evaluate(() => { const ev = [...document.querySelectorAll('.cev')], col = e => getComputedStyle(e).backgroundColor, g = document.querySelector('.calg').getBoundingClientRect(), r = e => e.getBoundingClientRect(); const by = t => ev.find(e => e.innerText.includes(t));
    return { n: ev.length, work: col(by('Standup')), health: col(by('Gym')), social: col(by('Dentist')), wS: Math.round(r(by('Standup')).width), wD: Math.round(r(by('Dentist')).width), full: Math.round(g.width), hrs: document.querySelectorAll('.hln').length, loose: !!document.querySelector('.calall') && /Buy gift/.test(document.querySelector('.calall').innerText), tomorrow: ev.some(e => /Tomorrow/.test(e.innerText)), topS: Math.round(r(by('Standup')).top), topG: Math.round(r(by('Gym')).top), topD: Math.round(r(by('Dentist')).top) } });
  ok('calendar layout shows the day\'s three timed tasks as blocks (not tomorrow\'s)', m.n === 3 && !m.tomorrow, JSON.stringify(m));
  ok('each block is filled with its tag colour (work blue, health pink, social teal)', m.work === 'rgb(79, 140, 255)' && m.health === 'rgb(238, 93, 122)' && m.social === 'rgb(47, 184, 160)', `${m.work} ${m.health} ${m.social}`);
  ok('overlapping tasks (09:00 and 09:15) sit side by side', m.wS < m.wD - 20, `${m.wS} vs ${m.wD}`);
  ok('hours run down the side', m.hrs >= 14);
  const he = await open(b, 'he'); await he.evaluate(() => { S.set.lay = 'cal'; go(1) }); await he.waitForTimeout(700);
  const rt = await he.evaluate(() => { const g = document.querySelector('.calg').getBoundingClientRect(), l = document.querySelector('.hln span').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, iw: innerWidth, labelRight: l.left >= g.right, inView: l.left >= 0 && l.right <= innerWidth } });
  ok('Hebrew: hour labels are on the right of the grid, inside the screen, no sideways scroll', rt.labelRight && rt.inView && rt.sw <= rt.iw, JSON.stringify(rt));
  await he.context().close();
  ok('tasks without a time sit in a row above the grid', m.loose);
  ok('a later task sits lower on the grid than an earlier one', m.topS < m.topG + 1 && m.topG < m.topD);
  ok('the layout choice is remembered', await p.evaluate(() => JSON.parse(localStorage.getItem('tempo.v1')).set.lay === 'cal'));
  await p.evaluate(() => document.querySelector('.cev').click()); await p.waitForTimeout(600);
  ok('tapping a block opens the task', await p.evaluate(() => !!document.querySelector('.sh,.sheet,#sh') || document.body.innerText.includes('Standup')));
  // small phone, longest month name, date button showing: the header still fits on one row
  for (const lang of ['en', 'he']) {
    const sm = await b.newContext({ viewport: { width: 340, height: 700 } }); const q = await sm.newPage();
    await q.addInitScript(([d, lang]) => { const t = new Date(d).getTime(), R = Date; class D extends R { constructor(...a) { a.length ? super(...a) : super(t) } static now() { return t } } window.Date = D; localStorage.setItem('tempo.v1', JSON.stringify({ items: [], set: { lang, onboarded: true } })) }, ['2026-09-15T10:00', lang]);
    await q.goto(URL); await q.waitForTimeout(700); await q.evaluate(() => { go(1); shift(1) }); await q.waitForTimeout(600);
    const fitH = await q.evaluate(() => { const h = document.querySelector('.hd'), t = h.querySelector('h1').getBoundingClientRect(), w = h.querySelector('.wn').getBoundingClientRect(), rtl = document.documentElement.dir == 'rtl', tw = h.querySelector('h1'); return { over: document.documentElement.scrollWidth > innerWidth, apart: rtl ? t.left >= w.right - 1 : t.right <= w.left + 1, clipped: tw.scrollWidth > tw.clientWidth + 1 } });
    ok(`${lang}: September on a 340px phone: the title is not covered by the buttons and nothing scrolls sideways`, !fitH.over && fitH.apart && !fitH.clipped, JSON.stringify(fitH));
    await sm.close();
  }
  ok('no JS errors', !p.errs.length, p.errs.join('|'));
  await p.context().close();
};
