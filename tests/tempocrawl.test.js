// Crawl: every Tempo screen and sheet in English and Hebrew, light and dark: JS errors, sideways scroll, bad text, off-screen controls.
const { ok, chromium } = require('./lib');
const path = require('path'), URL = 'file://' + path.join(__dirname, '..', 'tempo', 'index.html');
const item = (id, title, time, dur, area, extra = {}) => Object.assign({ id, title, date: '2026-11-23', time, dur, area, rem: 10, trav: 0 }, extra);
const places = [{ id: 'h', name: 'Home', home: true, lat: 33.006, lon: 35.098 }, { id: 'o', name: 'Office with a very long name for testing', lat: 33.0, lon: 35.1 }, { id: 'g', name: 'Gym', lat: 33.1, lon: 35.2 }];
const items = () => [item('a', 'Standup with a really long title that has to be cut somewhere or it will break the row', '14:00', 30, 'work', { pl: 'o', steps: [{ t: 'one', d: 1 }, { t: 'two' }], note: 'A note' }), item('g', 'Gym', '14:40', 60, 'health', { pl: 'g', trav: 30, mode: 'bus', busLine: '5' }), item('l', 'Buy gift', '', 0, 'home'), item('r', 'Weekly review', '17:00', 45, 'study', { rep: 'days', days: [1] }), item('s', 'Someday thing', '', 0, null, { date: null }), item('t', 'Tomorrow', '10:00', 30, 'social', { date: '2026-11-24' })];
const steps = [
  ['today', p => p.evaluate(() => go(0))], ['schedule', p => p.evaluate(() => go(1))], ['schedule-calendar', p => p.evaluate(() => { S.set.lay = 'cal'; go(1) })], ['schedule-next-day', p => p.evaluate(() => { S.set.lay = 'list'; go(1); shift(1) })], ['schedule-someday', p => p.evaluate(() => { go(1); showSome = true; render(0) })],
  ['settings', p => p.evaluate(() => settings())], ['settings-open-all', p => p.evaluate(() => { settings(); document.querySelectorAll('#sh .sgh,#sh .gh,#sh .gl.gh').forEach(b => b.click()) })], ['places', p => p.evaluate(() => placesSheet())],
  ['new-what', p => p.evaluate(() => { edit(); })], ['new-typed', p => p.evaluate(() => { edit(); const f = document.getElementById('fi'); f.value = 'Gym session'; f.dispatchEvent(new Event('input', { bubbles: true })) })],
  ['new-day', p => p.evaluate(() => { edit(); const f = document.getElementById('fi'); f.value = 'Gym'; f.dispatchEvent(new Event('input', { bubbles: true })); F.rdy = true; document.getElementById('bn').click() })],
  ['new-time', p => p.evaluate(() => { edit(); const f = document.getElementById('fi'); f.value = 'Gym'; f.dispatchEvent(new Event('input', { bubbles: true })); F.rdy = true; document.getElementById('bn').click(); document.getElementById('bn').click() })],
  ['edit-task', p => p.evaluate(() => edit('a', '2026-11-23'))], ['edit-repeating', p => p.evaluate(() => edit('r', '2026-11-23'))], ['detail', p => p.evaluate(() => detail('a', '2026-11-23'))], ['detail-done', p => p.evaluate(() => { S.items[0].done = { '2026-11-23': 1 }; detail('a', '2026-11-23') })],
  ['go-sheet', p => p.evaluate(() => goSheet('a', '2026-11-23'))], ['trip-issue', p => p.evaluate(() => legIssue('2026-11-23'))], ['category-popup', p => p.evaluate(() => catPopup(null, () => {}))],
  ['finish-prompt', p => p.evaluate(() => { finAsk({ fin: { id: 'a', ds: '2026-11-23' } }) })],
];
module.exports = async b => {
  const problems = [];
  for (const [lang, theme] of [['en', 'light'], ['he', 'dark'], ['he', 'light'], ['en', 'dark']]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(([d, lang, theme, items, places]) => { const t = new Date(d).getTime(), R = Date; class D extends R { constructor(...a) { a.length ? super(...a) : super(t) } static now() { return t } } window.Date = D; localStorage.setItem('tempo.v1', JSON.stringify({ items, places, set: { lang, theme, onboarded: true, travel: 'car', notif: false } })) }, ['2026-11-23T12:30', lang, theme, items(), places]);
    await p.goto(URL); await p.waitForTimeout(900);
    for (const [name, fn] of steps) {
      try { await p.evaluate(() => { try { closeSh(true); closePop(true) } catch (e) {} document.querySelectorAll('.ov,.sh').forEach(e => e.remove()); document.getElementById('ts').classList.remove('o'); S.set.lay = 'list'; go(0) }); await p.waitForTimeout(100); await fn(p); await p.waitForTimeout(500) }
      catch (e) { problems.push(`${lang}/${theme}/${name}: threw ${String(e.message).split('\n')[0]}`); continue }
      const r = await p.evaluate(() => { const out = [], vw = innerWidth, de = document.documentElement;
        if (de.scrollWidth > vw + 1) out.push(`page scrolls sideways (${de.scrollWidth} > ${vw})`);
        const bad = document.body.innerText.match(/.{0,20}(NaN|undefined|\[object|Infinity|null).{0,20}/); if (bad) out.push('bad text: ' + bad[0].replace(/\n/g, ' '));
        const root = document.getElementById('sh') || document.getElementById('app');
        for (const e of root.querySelectorAll('button,input,.pill,.btn,.f,.ib')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; const cs = getComputedStyle(e); if (cs.visibility == 'hidden' || cs.display == 'none' || cs.opacity == '0') continue; if (e.closest('[hidden],.gx:not(.o),.hs,.hrow,.strip,.seg,.calall,.wz .sg:not(.cur),.trw:not(.o),.vl')) continue;
          if (r.right > vw + 2 || r.left < -2) out.push(`off-screen: ${(e.getAttribute('aria-label') || e.innerText || e.id || e.className).toString().slice(0, 30).replace(/\n/g, ' ')} [${Math.round(r.left)}..${Math.round(r.right)}]`) }
        const sh = document.getElementById('sh'); if (sh) { const r = sh.getBoundingClientRect(); if (r.top < -1 || r.bottom > innerHeight + 1) out.push(`sheet taller than screen (${Math.round(r.top)}..${Math.round(r.bottom)} of ${innerHeight})`) }
        return out });
      const sheetSteps = !/^(today|schedule|finish-prompt|category-popup)/.test(name);
      if (sheetSteps && !(await p.evaluate(() => !!document.getElementById('sh')))) problems.push(`${lang}/${theme}/${name}: the screen did not open`);
      r.forEach(m => problems.push(`${lang}/${theme}/${name}: ${m}`));
    }
    if (errs.length) problems.push(`${lang}/${theme}: JS errors: ${[...new Set(errs)].join(' | ')}`);
    await c.close();
  }
  const uniq = [...new Set(problems)];
  ok(`Tempo crawl: ${steps.length} screens × 4 looks without JS errors, sideways scroll, bad text, off-screen controls`, !uniq.length, uniq.slice(0, 10).join('  ;  '));
  if (uniq.length) require('fs').writeFileSync('/tmp/tempocrawl-problems.txt', uniq.join('\n'));
};
