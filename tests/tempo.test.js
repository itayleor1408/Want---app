// Tempo: the date button matches the Today button; the calendar layout (hours down the side, blocks in the tag's colour).
const { ok, T, chromium } = require('./lib');
const path = require('path'), URL = 'file://' + path.join(__dirname, '..', 'tempo', 'index.html');
const D = '2026-11-23T10:00';
const item = (id, title, time, dur, area, date = '2026-11-23') => ({ id, title, date, time, dur, area, rem: 10, trav: 0 });
async function open(b, lang, itemsOverride) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(([d, lang, items]) => {
    const t = new Date(d).getTime(), R = Date; class D extends R { constructor(...a) { a.length ? super(...a) : super(t) } static now() { return t } } window.Date = D;
    if (!localStorage.getItem('tempo.v1')) localStorage.setItem('tempo.v1', JSON.stringify({ items, set: { lang, onboarded: true, theme: 'light' } }));
  }, [D, lang, itemsOverride || [item('a', 'Standup', '09:00', 30, 'work'), item('b', 'Gym', '09:15', 60, 'health'), item('c', 'Dentist', '13:00', 45, 'social'), item('d', 'Buy gift', '', 0, 'home'), item('e', 'Tomorrow task', '11:00', 30, 'work', '2026-11-24')]]);
  await p.goto(URL); await p.waitForTimeout(900); return p;
}
async function newTask(b) {
  const p = await open(b, 'en'); await p.evaluate(() => edit()); await p.waitForTimeout(800);
  const m = () => p.evaluate(() => ({ sheet: Math.round(document.getElementById('sh').getBoundingClientRect().height), row: Math.round(document.getElementById('trw').getBoundingClientRect().height), op: getComputedStyle(document.getElementById('trw')).opacity }));
  const a = await m();
  ok('first window: the button row takes no space before anything is typed', a.row === 0 && a.op === '0', JSON.stringify(a));
  ok('first window is compact (under 340px tall)', a.sheet < 340, String(a.sheet));
  await p.fill('#fi', 'Gym session'); await p.waitForTimeout(250);
  ok('while still typing the buttons stay hidden', (await m()).row === 0);
  await p.waitForTimeout(1300);
  const c = await m();
  ok('after a short pause the window grows and the buttons appear', c.row >= 50 && c.sheet > a.sheet + 40 && c.op === '1', JSON.stringify(c));
  await p.fill('#fi', ''); await p.waitForTimeout(400);
  ok('clearing the name hides them again', (await m()).row === 0);
  await p.fill('#fi', 'Read'); await p.click('[data-task-look]'); await p.click('#look-save'); await p.waitForTimeout(1000);
  ok('setting task appearance keeps the add flow available', (await m()).row >= 50);
  await p.evaluate(() => { document.querySelector('#bn').click() }); await p.waitForTimeout(700);
  ok('later steps always show the buttons', await p.evaluate(() => document.getElementById('trw').getBoundingClientRect().height >= 50));
  ok('new task: no JS errors', !p.errs.length, p.errs.join('|')); await p.context().close();
}

async function trips(b, lang) {
  const places = [{ id: 'h', name: 'Home', home: true, lat: 33.006, lon: 35.098 }, { id: 'o', name: 'Office', lat: 33.0, lon: 35.1 }, { id: 'g', name: 'Gym place', lat: 33.1, lon: 35.2 }, { id: 'f', name: 'Far away', lat: 32.0, lon: 34.8 }];
  const mk = items => open(b, lang, items).then(async p => { await p.evaluate(pl => { S.places = pl; S.set.travel = 'car'; S.set.lay = 'list'; save() }, places); return p });
  const a = item('a', 'Standup', '14:00', 30, 'work'); a.pl = 'o';
  const g = item('g', 'Gym', '14:40', 60, 'health'); g.pl = 'g'; g.trav = 30; g.mode = 'bus';
  const p = await mk([a, g]); await p.evaluate(() => go(1)); await p.waitForTimeout(700);
  const L = await p.evaluate(() => { const m = legIssues('2026-11-23'); return { n: Object.keys(m).length, k: m.g && m.g.issues.map(x => x.k) } });
  ok(`${lang}: not enough time between two tasks at different places is flagged`, L.n === 1 && L.k.includes('tight'), JSON.stringify(L));
  ok(`${lang}: the red mark sits next to the layout button, the same size`, await p.evaluate(() => { const r = document.querySelector('.lay.lgw'), l = document.querySelector('.lbs .lay:not(.lgw)'); if (!r || !l) return false; const a = r.getBoundingClientRect(), b = l.getBoundingClientRect(); return Math.round(a.width) === Math.round(b.width) && Math.round(a.height) === Math.round(b.height) && Math.abs(a.top - b.top) < 1 && Math.min(Math.abs(a.right - b.left), Math.abs(b.right - a.left)) < 14 && getComputedStyle(r).color === 'rgb(236, 74, 62)' }));
  ok(`${lang}: the trip itself is outlined in red in the list`, await p.evaluate(() => !!document.querySelector('.cnw.bad')));
  await p.evaluate(() => setLay()); await p.waitForTimeout(600);
  const c = await p.evaluate(() => ({ legs: document.querySelectorAll('.cleg').length, bad: !!document.querySelector('.cleg.bad') && !!document.querySelector('.lay.lgw'), txt: document.querySelector('.cleg.bad') && document.querySelector('.cleg.bad').innerText, h: Math.round(document.querySelector('.cleg.bad').getBoundingClientRect().height) }));
  ok(`${lang}: the calendar layout shows the trips as blocks (a bad one outlined red) and keeps the red mark`, c.legs === 2 && c.bad && /30|30m|ד׳/.test(c.txt), JSON.stringify(c));
  await p.evaluate(() => document.querySelector('.lay.lgw').click()); await p.waitForTimeout(700);
  const sh = await p.evaluate(() => document.getElementById('sh').innerText);
  ok(`${lang}: tapping the red mark explains the problem and offers "Fix it for me"`, (lang == 'en' ? /doesn't add up/.test(sh) && /only/.test(sh) && /Fix it for me/.test(sh) : /לא מסתדר/.test(sh) && /תתקן בשבילי/.test(sh)), sh.replace(/\n/g, ' | ').slice(0, 200));
  await p.evaluate(() => document.getElementById('lgF').click()); await p.waitForTimeout(700);
  const f = await p.evaluate(() => { const m = legIssues('2026-11-23'), g = occ('2026-11-23').find(i => i.id == 'g'); return { left: Object.keys(m).length, time: g.time, trav: g.trav } });
  ok(`${lang}: Fix it for me moves the task so the trip fits (no issues left)`, f.left === 0 && tmv(f.time) >= 14 * 60 + 30 + f.trav, JSON.stringify(f));
  ok(`${lang}: …and Undo puts everything back`, await (async () => { await p.evaluate(() => document.getElementById('tu').click()); await p.waitForTimeout(300); return p.evaluate(() => { const g = S.items.find(i => i.id == 'g'); return g.time === '14:40' && g.trav === 30 }) })());
  ok(`${lang}: trips: no JS errors`, !p.errs.length, p.errs.join('|')); await p.context().close();
}
const tmv = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m };
async function tripsMore(b) {
  const places = [{ id: 'h', name: 'Home', home: true, lat: 33.006, lon: 35.098 }, { id: 'o', name: 'Office', lat: 33.0, lon: 35.1 }, { id: 'f', name: 'Far away', lat: 32.0, lon: 34.8 }];
  const a = item('a', 'Standup', '14:00', 30, 'work'); a.pl = 'o';
  const f = item('f', 'Far meeting', '15:00', 60, 'work'); f.pl = 'f'; f.trav = 2; f.mode = 'drive';
  const p = await open(b, 'en', [a, f]); await p.evaluate(pl => { S.places = pl; S.set.travel = 'car'; save() }, places);
  const r = await p.evaluate(() => { const m = legIssues('2026-11-23'); return m.f && m.f.issues.map(x => x.k) });
  ok('a trip set far too short for the distance is flagged', r && r.includes('short'), JSON.stringify(r));
  await p.evaluate(() => fixDay('2026-11-23', true)); 
  const after = await p.evaluate(() => { const f = occ('2026-11-23').find(i => i.id == 'f'); return { trav: f.trav, issues: Object.keys(legIssues('2026-11-23')).length } });
  ok('fixing it sets a realistic trip length', after.trav > 20, JSON.stringify(after));
  // only the conflicting occurrence of a repeating task moves
  const r2 = item('r', 'Weekly', '14:40', 60, 'health'); r2.pl = 'f'; r2.rep = 'days'; r2.days = [1]; r2.trav = 60;
  const q = await open(b, 'en', [Object.assign({}, a), r2]); await q.evaluate(pl => { S.places = pl; S.set.travel = 'car'; save() }, places);
  const out = await q.evaluate(() => { const fx = fixDay('2026-11-23', true); return { moved: fx.acts.filter(a => a.k == 'move').length, left: fx.left, time: S.items.find(i => i.id == 'r').time, actual: occ('2026-11-23').find(i => i.id == 'r').time } });
  ok('a repeating task moves only on the day being sorted', out.moved >= 1 && out.left === 0 && out.time === '14:40' && out.actual > out.time, JSON.stringify(out));
  // nothing wrong -> no ⓘ
  const g2 = item('g', 'Gym', '17:00', 60, 'health'); g2.pl = 'o'; const ok1 = await open(b, 'en', [a, g2]);
  ok('a sensible day shows no red mark', await ok1.evaluate(pl => { S.places = pl; S.set.travel = 'car'; go(1); return Object.keys(legIssues('2026-11-23')).length === 0 && !document.querySelector('.lay.lgw') }, places));
  ok('trips (more): no JS errors', !p.errs.length && !q.errs.length && !ok1.errs.length, [...p.errs, ...q.errs, ...ok1.errs].join('|'));
  await p.context().close(); await q.context().close(); await ok1.context().close();
}
async function finish(b) {
  const mk = items => open(b, 'en', items);
  const p = await mk([item('a', 'Report', '09:00', 30, 'work'), item('s', 'Gym', '09:00', 30, 'health'), item('n', 'Next', '09:30', 30, 'work')]);
  const r = await p.evaluate(() => { S.places = [{ id: 'h', name: 'Home', home: true }, { id: 'g', name: 'Gym place' }, { id: 'o', name: 'Office' }]; const A = S.items.find(i => i.id == 'a'), N = S.items.find(i => i.id == 'n'), G = S.items.find(i => i.id == 's'); const d = '2026-11-23';
    const base = needsFinAsk(A, d);
    A.pl = 'o'; N.pl = 'o'; const same = needsFinAsk(A, d);
    N.pl = 'g'; const diff = needsFinAsk(A, d);
    A.pl = null; const noPlace = needsFinAsk(A, d);
    A.pl = 'o'; N.pl = 'g'; A.done = { [d]: 1 }; const done = needsFinAsk(A, d); A.done = {};
    const noDur = needsFinAsk(Object.assign({}, A, { dur: 0 }), d);
    return { base, same, diff, noPlace, done, noDur } });
  ok('asks when there is no place', r.base && r.noPlace);
  ok('asks when the next task is at the same place', r.same);
  ok('does not ask when the next task is at a different place (moving shows it)', !r.diff);
  ok('does not ask for finished tasks or tasks without a length', !r.done && !r.noDur);
  await p.context().close();
  const p2 = await mk([item('a', 'Report', '09:00', 30, 'work')]); const pp = p; 
  // the prompt
  await p2.waitForTimeout(600); await p2.evaluate(() => { S.set.notif = false; S.fired = {}; document.getElementById('ts').classList.remove('o'); document.getElementById('tn').style.display = 'none'; due() }); await p2.waitForTimeout(400);
  const q = await p2.evaluate(() => ({ txt: document.getElementById('tt').innerText, yes: document.getElementById('tu').innerText, no: document.getElementById('tn').innerText, shown: document.getElementById('ts').classList.contains('o') }));
  ok('after the end time, Tempo asks "Did you finish?" with Yes and Not yet (even with notifications off)', q.shown && /Did you finish/.test(q.txt) && /Report/.test(q.txt) && q.yes === 'Yes' && q.no === 'Not yet', JSON.stringify(q));
  await p2.evaluate(() => document.getElementById('tn').click()); await p2.waitForTimeout(300);
  ok('Not yet leaves it undone and remembers to ask again', await p2.evaluate(() => { const a = S.items.find(i => i.id == 'a'); return !a.done || !a.done['2026-11-23'] }) && await p2.evaluate(() => Object.keys(S.fired).some(k => k.startsWith('finre'))));
  const asked1 = await p2.evaluate(() => Object.keys(S.fired).filter(k => k.startsWith('fin')).length);
  await p2.evaluate(() => { due() }); await p2.waitForTimeout(300);
  ok('it does not nag again straight away', await p2.evaluate(() => !document.getElementById('ts').classList.contains('o')));
  await p2.evaluate(() => { Object.keys(S.fired).forEach(k => { if (k.startsWith('finre') && !k.endsWith('x')) S.fired[k] -= 16 * 60000 }); due() }); await p2.waitForTimeout(400);
  ok('15 minutes later it asks once more', await p2.evaluate(() => document.getElementById('ts').classList.contains('o') && /Did you finish/.test(document.getElementById('tt').innerText)));
  await p2.evaluate(() => document.getElementById('tu').click()); await p2.waitForTimeout(400);
  ok('Yes marks the task done', await p2.evaluate(() => S.items.find(i => i.id == 'a').done['2026-11-23'] === 1));
  const al = await p2.evaluate(() => alertsAhead().filter(a => a.fin).map(a => a.fin.id));
  ok('the closed-app reminder list includes the finish checks too', Array.isArray(al));
  const p3 = await mk([item('a', 'Report', '09:00', 30, 'work'), item('s', 'Gym', '09:00', 30, 'health'), item('n', 'Lunch', '09:00', 30, 'home')]); await p3.evaluate(() => { S.set.notif = true });
  // several tasks ending together are asked one at a time, never overwriting each other
  await p3.evaluate(() => { S.fired = {}; S.items.forEach(i => { if (i.done) i.done = {} }); document.getElementById('ts').classList.remove('o'); document.getElementById('tn').style.display = 'none' });
  const seq = [];
  for (let k = 0; k < 3; k++) { await p3.evaluate(() => due()); await p3.waitForTimeout(200); seq.push(await p3.evaluate(() => document.getElementById('tt').innerText.split('\n')[0])); await p3.evaluate(() => document.getElementById('tu').click()); await p3.waitForTimeout(150) }
  ok('tasks ending together are asked one by one, each answered separately', new Set(seq).size === 3, seq.join(' > '));
  await p3.context().close();
  // in a browser tab without the Cache API (file page) use a tiny stand-in for the next check
  await p2.evaluate(() => { const m = {}; Object.defineProperty(window, 'caches', { configurable: true, value: { open: async () => ({ put: async (k, v) => { m[k] = await v.text() }, match: async k => m[k] != null ? new Response(m[k]) : undefined, delete: async k => { delete m[k] } }) } }) });
  // service worker action: Yes pressed on the notification is applied when the app opens
  await p2.evaluate(async () => { const A = S.items.find(i => i.id == 'a'); delete A.done['2026-11-23']; save(); const c = await caches.open('tempo-push'); await c.put('fin.json', new Response(JSON.stringify([{ id: 'a', ds: '2026-11-23', yes: true }]))); await finPending() }); await p2.waitForTimeout(400);
  ok('a "Yes" tapped on the phone notification is applied when the app opens', await p2.evaluate(() => S.items.find(i => i.id == 'a').done['2026-11-23'] === 1));
  ok('finish checks: no JS errors', !p2.errs.length, p2.errs.join('|')); await p2.context().close();
}
module.exports = async b => {
  await newTask(b); await finish(b); await trips(b, 'en'); await trips(b, 'he'); await tripsMore(b);
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
