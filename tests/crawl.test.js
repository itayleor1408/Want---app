// Crawl: open every Penny screen and sheet in English and Hebrew, light and dark, with realistic data,
// and flag JS errors, sideways overflow, NaN/undefined text, controls pushed off-screen and tiny tap targets.
const { ok, T, baseState, openPage } = require('./lib');
const D = '2026-11-20T10:00';
const tx = (id, type, amt, day, title, cat, prof = 'pers', extra = {}) => Object.assign({ id, type, amt, ts: T(`2026-11-${day}T12:00`), title, cat, pay: 'card', prof }, extra);
const state = (lang, theme) => baseState({ lang, theme, prof: 'all', cash0: 800000, cash0Date: T('2026-11-01T00:00'), balSet: 1, upcOn: true,
  sync: { key: 'test-key-123456', bank: { bal: 1500000, at: Date.now() - 36e5, name: 'Discount' }, card: { name: 'Max', at: Date.now() - 36e5 }, useBank: true, last: Date.now(), err: '', claimAt: Date.now(), verified: true, owner: true }, dataFor: 'owner',
  tags: { exp: [{ k: 'c_nails', name: 'Nails', icon: 'nails' }], inc: [] },
  tx: [tx('i1', 'inc', 1200000, '02', 'Salary', 'salary'), tx('i2', 'inc', 500000, '03', 'Freelance', 'free', 'work'), tx('e1', 'exp', 4500, '10', 'Aroma', 'food'), tx('e2', 'exp', 6500, '12', 'NETFLIX.COM            AMSTERDAM     NL', 'subs'), tx('e3', 'exp', 12000, '13', 'Salon with a really long name that should not break the layout at all', 'c_nails'), tx('e4', 'exp', 8800, '14', 'Shufersal', 'food', 'work'),
    tx('d1', 'dep', 250000, '05', '', '', 'pers', { jar: 'j1' }), tx('d2', 'dep', 100000, '06', '', '', 'work', { jar: 'j3' }), tx('d3', 'dep', 40000, '07', '', '', 'pers', { jar: 'j3' }),
    tx('n1', 'exp', 6500, '12', 'NETFLIX.COM            AMSTERDAM     NL', 'subs', 'pers', { ts: T('2026-10-12T12:00') }), tx('n0', 'exp', 5500, '12', 'NETFLIX.COM            AMSTERDAM     NL', 'subs', 'pers', { ts: T('2026-09-12T12:00') })],
  jars: [{ id: 'j1', name: 'Savings', goal: 0, prof: 'pers', pin: true }, { id: 'j2', name: 'A trip to somewhere very far away with a long name', goal: 3000000, prof: 'pers', pct: 10, freq: 'm', plan: 0, next: T('2026-12-01T09:00') }, { id: 'j3', name: 'Shared', goal: 500000, prof: 'both', freq: 'm', plan: 20000, planBy: { pers: 10000, work: 10000 }, next: T('2026-11-01T09:00') }],
  wish: [{ id: 'w1', name: 'Lamp', price: 15000, prof: 'pers', st: 'want', store: 'IKEA' }, { id: 'w2', name: 'A desk with a very long product name that goes on and on', price: 4990000, prof: 'work', st: 'want', jar: 'j2' }],
  recur: [{ id: 'r1', type: 'exp', amt: 9900, title: 'Gym', freq: 'monthly', day: 5, cat: 'health', prof: 'pers' }],
  pending: [{ id: 'p1', ext: 'x1', raw: 'IRPAC AZZIP', type: 'exp', amt: 4100, ts: T('2026-11-18T12:00'), title: 'IRPAC AZZIP', cat: 'none', pay: 'card', prof: 'pers', src: 'card' }] });
const steps = [
  ['home', p => p.evaluate(() => { go('home') })], ['jars', p => p.evaluate(() => go('jars'))], ['wish', p => p.evaluate(() => go('wish'))], ['activity', p => p.evaluate(() => go('act'))],
  ['activity-week', p => p.evaluate(() => { go('act'); AV.m = 'w'; render() })], ['activity-filter', p => p.evaluate(() => { go('act'); AV.m = 'm'; AV.f = 'inc'; render(); AV.f = 'all' })], ['category-picker', p => p.evaluate(() => { go('act'); catPick() })],
  ['settings', p => p.evaluate(() => settings())], ['settings-info', p => p.evaluate(() => { settings(); document.querySelectorAll('#sh .gw .ii').forEach(b => b.click()) })], ['balance', p => p.evaluate(() => balSheet())], ['balance-confirm', p => p.evaluate(() => { balSheet(); document.getElementById('bal').value = '5000'; saveBal() })],
  ['key', p => p.evaluate(() => keySheet())], ['restore', p => p.evaluate(() => restoreSheet())], ['reset', p => p.evaluate(() => resetConfirm())], ['upcoming', p => p.evaluate(() => upcoming())], ['claim', p => p.evaluate(() => claimSheet())],
  ['jar', p => p.evaluate(() => jarSheet('j2'))], ['jar-shared', p => p.evaluate(() => jarSheet('j3'))], ['jar-edit', p => p.evaluate(() => editJar('j2'))], ['jar-edit-shared', p => p.evaluate(() => editJar('j3'))], ['jar-new', p => p.evaluate(() => newJar())], ['jar-new-step2', p => p.evaluate(() => { newJar({ name: 'X', target: 100000 }) })],
  ['jar-add-money', p => p.evaluate(() => amtSheet('j2', 'dep'))], ['jar-transfer', p => p.evaluate(() => xfer('j1'))],
  ['expense', p => p.evaluate(() => entry('exp'))], ['income', p => p.evaluate(() => entry('inc'))], ['entry-category', p => p.evaluate(() => { entry('exp'); ePanelT('cat') })], ['entry-payment', p => p.evaluate(() => { entry('exp'); ePanelT('pay') })], ['entry-repeat', p => p.evaluate(() => { entry('exp'); ePanelT('rep') })], ['edit-entry', p => p.evaluate(() => entry('exp', 'e3'))],
  ['tag-form', p => p.evaluate(() => { entry('exp'); tagForm('', 'n') })], ['review', p => p.evaluate(() => reviewOpen())], ['wish-add', p => p.evaluate(() => wishAdd())], ['wish-sheet', p => p.evaluate(() => wishSheet('w2'))], ['wish-form', p => p.evaluate(() => wishForm('', null))],
];
module.exports = async b => {
  const problems = [], seen = new Set();
  for (const [lang, theme] of [['en', 'light'], ['he', 'dark'], ['he', 'light'], ['en', 'dark']]) {
    const p = await openPage(b, { state: state(lang, theme), date: D }); await p.waitForTimeout(2600);
    for (const [name, fn] of steps) {
      try { await p.evaluate(() => { try { close() } catch (e) {} document.getElementById('sh') && (document.getElementById('sh').id = ''); document.querySelectorAll('.ov,.sh').forEach(e => e.remove()); document.body.classList.remove('lk'); go('home') }); await p.waitForTimeout(120); await fn(p); await p.waitForTimeout(450) }
      catch (e) { problems.push(`${lang}/${theme}/${name}: threw ${String(e.message).split('\n')[0]}`); continue }
      const r = await p.evaluate(() => {
        const out = [], vw = innerWidth, de = document.documentElement;
        if (de.scrollWidth > vw + 1) out.push(`page scrolls sideways (${de.scrollWidth} > ${vw})`);
        const txt = document.body.innerText; const bad = txt.match(/.{0,20}(NaN|undefined|\[object|Infinity).{0,20}/); if (bad) out.push('bad text: ' + bad[0].replace(/\n/g, ' '));
        const root = document.getElementById('sh') || document.body;
        for (const e of root.querySelectorAll('button,input,.pill,.btn,.f,.gr,.ib')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; const cs = getComputedStyle(e); if (cs.visibility == 'hidden' || cs.display == 'none') continue; if (e.closest('[hidden],.gx:not(.o),.car,.hs,.fq,.igr,.cgr,.strip,.seg,.epl') ) continue;
          if (r.right > vw + 2 || r.left < -2) out.push(`off-screen: ${(e.getAttribute('aria-label') || e.innerText || e.id || e.className).toString().slice(0, 30).replace(/\n/g, ' ')} [${Math.round(r.left)}..${Math.round(r.right)}]`) }
        const sh = document.getElementById('sh'); if (sh) { const r = sh.getBoundingClientRect(); if (r.top < -1 || r.bottom > innerHeight + 1) out.push(`sheet taller than screen (${Math.round(r.top)}..${Math.round(r.bottom)} of ${innerHeight})`) }
        return out });
      for (const m of r) { const key = `${name}: ${m.replace(/\d+/g, '#')}`; problems.push(`${lang}/${theme}/${name}: ${m}`); }
    }
    if (p.errs.length) problems.push(`${lang}/${theme}: JS errors: ${[...new Set(p.errs)].join(' | ')}`);
    await p.context().close();
  }
  const uniq = [...new Set(problems)];
  ok(`crawl: ${steps.length} screens × 4 looks without JS errors, sideways scroll, bad text, off-screen controls`, !uniq.length, uniq.slice(0, 12).join('  ;  '));
  if (uniq.length) require('fs').writeFileSync('/tmp/crawl-problems.txt', uniq.join('\n'));
};
