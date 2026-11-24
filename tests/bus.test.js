// Buses: a stop a few minutes' walk away is found even when many closer stops have nothing useful, or when it belongs to another municipality;
// and when no bus goes straight there, the buses from nearby stops are listed instead of just "No direct bus found".
const { ok } = require('./lib');
const path = require('path'), URL = 'file://' + path.join(__dirname, '..', 'tempo', 'index.html');

// Ranking: the best way to ride one bus is chosen by door-to-door time (walking counts extra), using any boarding and alighting stop
async function ranking(b) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(() => {
    const t = new Date('2026-11-24T06:38').getTime(), R = Date; class D extends R { constructor(...a) { a.length ? super(...a) : super(t) } static now() { return t } } window.Date = D;
    localStorage.setItem('tempo.v1', JSON.stringify({ items: [], places: [], set: { lang: 'en', onboarded: true, city: 'x' } }));
    const home = { lat: 33.0, lon: 35.1 }, dest = { lat: 33.02, lon: 35.1 };
    const stops = [{ id: 1, name: 'Far', lat: home.lat - 0.0055, lon: home.lon }, { id: 2, name: 'Near', lat: home.lat - 0.0018, lon: home.lon }, { id: 3, name: 'Dest near', lat: dest.lat + 0.0006, lon: dest.lon }, { id: 4, name: 'Dest far', lat: dest.lat + 0.006, lon: dest.lon }].map(s => Object.assign({ code: 'c' }, s));
    const iso = m => new Date(t + m * 60000).toISOString();
    const rs = (ride, stop, m, seq, line) => ({ gtfs_ride_id: ride, gtfs_stop_id: stop, arrival_time: iso(m), stop_sequence: seq, gtfs_route__route_short_name: line, gtfs_route__route_long_name: 'A<->B', gtfs_ride_stop__shape_dist_traveled: 0 });
    window.fetch = async u => { u = String(u); const j = x => new Response(JSON.stringify(x));
      if (u.includes('nominatim')) return j({ address: { city: 'x' } });
      if (u.includes('/gtfs_stops/list')) return j(stops);
      if (u.includes('/siri_vehicle_locations')) return j([]);
      if (u.includes('/gtfs_ride_stops/list')) { const ids = decodeURIComponent((u.match(/gtfs_stop_ids=([^&]*)/) || [])[1] || '').split(',').map(Number), out = [];
        if (ids.includes(1)) out.push(rs('R1', 1, 20, 1, '3'), rs('R2', 1, 30, 1, '5'));
        if (ids.includes(2)) out.push(rs('R1', 2, 24, 2, '3'));
        if (ids.includes(4)) out.push(rs('R1', 4, 50, 9, '3'));
        if (ids.includes(3)) out.push(rs('R1', 3, 55, 10, '3'), rs('R2', 3, 62, 6, '5'));
        return j(out) }
      return j([]) };
  });
  await p.goto(URL); await p.waitForTimeout(700);
  const r = await p.evaluate(async () => { const x = await findTrips({ lat: 33.0, lon: 35.1 }, { lat: 33.02, lon: 35.1 }, new Date(new Date().getTime() + 90 * 60000)); const rec = x.opts.find(o => o.rec), l3 = x.opts.filter(o => o.line == '3'); return { n: x.opts.length, rec: rec && [rec.line, rec.depStop.name, rec.arrStop.name, rec.total, rec.walk], l3: l3.length, hasTotal: x.opts.every(o => o.total > 0), html: tripBlock(x, null, null).includes('⏱') } });
  ok('it recommends the bus 3 using the close stop on both ends (not the far ones)', r.rec && r.rec[0] === '3' && r.rec[1] === 'Near' && r.rec[2] === 'Dest near', JSON.stringify(r));
  ok('its door-to-door time is counted (about 36 minutes) with little walking', r.rec && Math.abs(r.rec[3] - 36) <= 2 && r.rec[4] <= 8, JSON.stringify(r.rec));
  ok('other buses are offered too (bus 5)', r.n >= 2);
  ok('every option carries its total time (shown in the details)', r.hasTotal);
  ok('ranking: no JS errors', !p.errs.length, p.errs.join('|')); await c.close();
}

// Many buses reach you in time: the list starts with the NEXT ones (soonest first), not the last ones before the deadline
async function soonest(b) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(() => {
    const t = new Date('2026-11-24T06:38').getTime(), R = Date; class D extends R { constructor(...a) { a.length ? super(...a) : super(t) } static now() { return t } } window.Date = D;
    localStorage.setItem('tempo.v1', JSON.stringify({ items: [], places: [], set: { lang: 'en', onboarded: true, city: 'x' } }));
    const stops = [{ id: 1, name: 'Home stop', lat: 32.9985, lon: 35.1 }, { id: 2, name: 'Dest stop', lat: 33.02, lon: 35.1 }].map(s => Object.assign({ code: 'c' }, s));
    const iso = m => new Date(t + m * 60000).toISOString(), rs = (ride, stop, m, seq) => ({ gtfs_ride_id: ride, gtfs_stop_id: stop, arrival_time: iso(m), stop_sequence: seq, gtfs_route__route_short_name: '3', gtfs_route__route_long_name: 'A<->B', gtfs_ride_stop__shape_dist_traveled: 0 });
    window.fetch = async u => { u = String(u); const j = x => new Response(JSON.stringify(x));
      if (u.includes('nominatim')) return j({ address: { city: 'x' } }); if (u.includes('/gtfs_stops/list')) return j(stops); if (u.includes('/siri_vehicle_locations')) return j([]);
      if (u.includes('/gtfs_ride_stops/list')) { const ids = decodeURIComponent((u.match(/gtfs_stop_ids=([^&]*)/) || [])[1] || '').split(',').map(Number), out = [];
        for (let i = 0; i < 14; i++) { if (ids.includes(1)) out.push(rs('R' + i, 1, 15 + i * 5, 1)); if (ids.includes(2)) out.push(rs('R' + i, 2, 40 + i * 5, 5)) } return j(out) }
      return j([]) };
  });
  await p.goto(URL); await p.waitForTimeout(700);
  const r = await p.evaluate(async () => { const x = await findTrips({ lat: 33.0, lon: 35.1 }, { lat: 33.02, lon: 35.1 }, new Date(new Date().getTime() + 120 * 60000)); const d = x.opts.map(o => Math.round((o.dep - new Date()) / 60000)); return { n: x.opts.length, first: d[0], sorted: d.every((v, i) => !i || v >= d[i - 1]), hasRec: x.opts.some(o => o.rec), lastShown: d[d.length - 1] } });
  ok('the list starts with the next bus you can catch (about 15 minutes from now), not the latest ones', r.first <= 20, JSON.stringify(r));
  ok('buses are listed in time order, with a recommended one among them', r.sorted && r.hasRec, JSON.stringify(r));
  ok('soonest: no JS errors', !p.errs.length, p.errs.join('|')); await c.close();
}

// Simple rows: line + walk + minutes (signal-coloured); details on demand; the top of the window shows the chosen bus
async function liveMin(b) {
  const c = await b.newContext({ viewport: { width: 390, height: 800 } }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('tempo.v1', JSON.stringify({ items: [], places: [], set: { lang: 'en', onboarded: true } })) });
  await p.goto(URL); await p.waitForTimeout(600);
  const r = await p.evaluate(() => { const n = Date.now(), mk = (ride, line, dm, sig, rec, wTo = 3, wFrom = 4) => ({ ride, line, dep: new Date(n + (dm + wTo) * 6e4), arr: new Date(n + (dm + 30) * 6e4), depStop: { name: 'Herzl', lat: 1, lon: 1 }, arrStop: { name: 'x' }, wTo, wFrom, total: 33, walk: wTo + wFrom, live: sig == 'live' || sig == 'weak', sig, leave: new Date(n + dm * 6e4), reach: new Date(n + (dm + 33) * 6e4), rec });
    window.__T = { opts: [mk('a', '3', 9, 'live', 1), mk('b', '5', 20, 'sched', 0, 8), mk('c', '21', 30, 'weak', 0, 3, 1), mk('d', '7', 40, 'lost')] };
    openSh('<div id="x">' + tripBlock(window.__T, null, null) + '</div>');
    const g = () => [...document.querySelectorAll('.brw .lvs [data-cd] b')].map(e => e.textContent), col = k => getComputedStyle(document.querySelector(k == 'lv' ? '.brw .lnums.lv b' : '.brw .lnums:not(.lv) b')).color;
    const row = document.querySelector('.brw .brs').innerText.replace(/\n+/g, ' | ');
    const out = { document_text: document.body.innerText, rows: document.querySelectorAll('.brw').length, row, mins: g(), top: document.querySelector('.tph').innerText.replace(/\n+/g, ' | '), colors: { lv: col('lv'), wk: col('wk'), ls: col('ls'), sc: col('sc') }, visibleTimes: [...document.querySelectorAll('.brw')].some(w => /→/.test(w.querySelector('.brs').innerText)), chain: !!document.querySelector('.brw .stp .bpill svg') && document.querySelectorAll('.brw .stp .wlk').length === 8 && document.querySelectorAll('.brw .tlb .lbn').length === 4, shortWalk: (document.querySelectorAll('.brw')[2].querySelectorAll('.wlk')[1].querySelector('b') || { textContent: '' }).textContent, longWalk: document.querySelectorAll('.brw')[0].querySelectorAll('.wlk')[1].querySelector('b').textContent };
    document.querySelectorAll('[data-cd]').forEach(e => e.dataset.cd = String(+e.dataset.cd - 120000)); cdTick(); out.after = g();
    return out });
  ok('each row is Moovit-like: total minutes + leave/arrive times on the side, the step chain, and "Leaves in … min from stop"', /🚶[\s|]*3/.test(r.row) && /Leaves in/.test(r.row) && /Herzl/.test(r.row) && /↓/.test(r.row) && r.chain, r.row);
  ok('a very short walk (1 min) shows only the icon, no number', r.shortWalk === '' && r.longWalk === '4', JSON.stringify([r.shortWalk, r.longWalk]));
  ok('minutes count down by themselves (two minutes pass)', r.after.length >= 2 && Number(r.after[0]) === Number(r.mins[0]) - 2, r.after.join());
  ok('only a live bus is highlighted (green); weak, lost and timetable buses are plain, with no extra labels', r.colors.lv !== r.colors.sc && r.colors.wk === r.colors.sc && r.colors.ls === r.colors.sc && !/Weak signal|No signal|Scheduled/.test(r.document_text), JSON.stringify(r.colors));
  ok('the top shows the chosen bus: minutes (live), walk before, the line, walk after', /LIVE/.test(r.top) && /9/.test(r.top) && /3/.test(r.top) && /4/.test(r.top), r.top);
  ok('the big minutes at the top are tied to the bus: bus icon + line number, and the word min', await p.evaluate(() => { const c = document.querySelector('.tph .tpcd'); return !!c && !!c.querySelector('small svg') && c.querySelector('small em').textContent.trim() === '3' && /min/.test(c.querySelector('.cu').textContent) && c.querySelector('.cdn b').textContent === document.querySelector('.tph .tpcd b').textContent }));
  ok('the top says when to leave the house and when you arrive: Leave 05:23 → Arrive 06:28', await p.evaluate(() => { const a = document.querySelector('.tph .arv'), x = window.__T.opts[0], f = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); return !!a && /leave/i.test(a.innerText) && /arrive/i.test(a.innerText) && a.innerText.includes(f(x.leave)) && a.innerText.includes(f(x.reach)) }));
  const tl = await p.evaluate(async () => { const tr = () => getComputedStyle(document.querySelector('.tlt')).transform, sh = () => { const r = document.querySelector('.tlb').getBoundingClientRect(), a = document.querySelector('.tls:first-child').getBoundingClientRect(); return a.left >= r.left - 1 && a.right <= r.right + 1 };
    document.documentElement.dataset.tl = '0'; await new Promise(r => setTimeout(r, 700)); const first = { times: sh(), t: tr() }; setTl(1, true); await new Promise(r => setTimeout(r, 700)); const second = { t: tr(), total: (() => { const r = document.querySelector('.tlb').getBoundingClientRect(), a = document.querySelector('.tls:last-child').getBoundingClientRect(); return a.left >= r.left - 1 && a.right <= r.right + 1 })() };
    const all = [...document.querySelectorAll('.tlt')].map(e => getComputedStyle(e).transform); return { first, second, all: new Set(all).size, n: all.length } });
  ok('the side card first shows leave ↓ arrive; then slides to the total minutes (animated)', tl.first.times && tl.second.total && tl.first.t !== tl.second.t, JSON.stringify(tl));
  ok('the slide applies to every bus below at once', tl.all === 1 && tl.n >= 4, JSON.stringify([tl.all, tl.n]));
  await p.evaluate(() => { const b = document.querySelectorAll('.tlb')[1].getBoundingClientRect(), mk = (t, x) => new PointerEvent(t, { clientX: x, clientY: b.top + 20, bubbles: true, pointerId: 1 }); const el = document.querySelectorAll('.tlb')[1]; document.documentElement.dataset.tl = '0'; el.dispatchEvent(mk('pointerdown', b.right - 5)); el.dispatchEvent(mk('pointerup', b.left + 5)) });
  ok('swiping the card by hand switches it, for all buses', await p.evaluate(() => document.documentElement.dataset.tl === '1'));
  ok('a swipe does not select the bus under the finger', await p.evaluate(() => { const rows = [...document.querySelectorAll('.brw.ch')]; return rows.length === 1 && rows[0] === document.querySelector('.brw') }));
  await p.evaluate(() => { const b = document.querySelectorAll('.tlb')[2].getBoundingClientRect(), mk = (t, x) => new PointerEvent(t, { clientX: x, clientY: b.top + 20, bubbles: true, pointerId: 1 }); const el = document.querySelectorAll('.tlb')[2]; el.dispatchEvent(mk('pointerdown', b.left + 5)); el.dispatchEvent(mk('pointerup', b.right - 5)) });
  ok('swiping back returns to leave ↓ arrive', await p.evaluate(() => document.documentElement.dataset.tl === '0'));
  ok('rows are compact: the side card does not make a bus line tall (under 90px)', await p.evaluate(() => [...document.querySelectorAll('.brw')].every(w => w.querySelector('.brs').getBoundingClientRect().height < 90)));
  ok('every row has leave ↓ arrive on its side card, without the words Leave/Arrive', await p.evaluate(() => { const f = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); return [...document.querySelectorAll('.brw')].every((w, i) => { const x = window.__T.opts[i], l = w.querySelector('.brs .tls'); return l && l.innerText.includes(f(x.leave)) && l.innerText.includes(f(x.reach)) && !/Leave|Arrive/.test(l.innerText) }) }));
  ok('every bus line ends with a map icon (no expand arrow, no extra info panel)', await p.evaluate(() => document.querySelectorAll('.brw .mgo svg').length === 4 && !document.querySelector('.brw .gx') && !document.querySelector('[data-more]')));
  await p.evaluate(() => { document.querySelector('[data-mg="a"]').click() }); await p.waitForTimeout(500);
  ok('the map icon opens the map for that bus (line 3)', await p.evaluate(() => !!document.getElementById('wm') && /3/.test(document.querySelector('#wm .mptop b').innerText)));
  await p.evaluate(() => { const m = document.getElementById('wm'); m && m.remove() });

  const sel = await p.evaluate(() => { const T = window.__T; closeSh(true); openSh('<div id="x">' + tripBlock(T, null, 'b') + '</div>'); return { top: document.querySelector('.tph').innerText.replace(/\n+/g, ' | '), ch: document.querySelector('.brw.ch .bl b').textContent, w: document.querySelector('.tpw').innerText.replace(/\n+/g, ' ') } });
  ok('choosing another bus changes the top: its own walk (8), minutes and leave time (no LIVE label)', /8/.test(sel.top) && /Leaves in/.test(sel.top) && !/LIVE/.test(sel.top) && /06:14|\d\d:\d\d/.test(sel.top) && sel.ch === '5', JSON.stringify(sel));
  ok('there is no "Walk to the stop" link', await p.evaluate(() => !document.querySelector('.wstop') && !/Walk to the stop/.test(document.body.innerText)));
  ok('a bus that has left shows "Now"', await p.evaluate(() => { document.querySelectorAll('[data-cd]').forEach(e => e.dataset.cd = String(Date.now() - 1000)); cdTick(); return [...document.querySelectorAll('[data-cd] b')].every(e => e.textContent === 'Now') }));
  ok('simple rows: no JS errors', !p.errs.length, p.errs.join('|')); await c.close();
}


// A busy line must not hide another one: the service caps its answers; a bus 3 that stops further away must still be offered
async function everyLine(b) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(() => {
    const t = new Date('2026-11-24T07:39').getTime(), R = Date; class D extends R { constructor(...a) { a.length ? super(...a) : super(t) } static now() { return t } } window.Date = D;
    localStorage.setItem('tempo.v1', JSON.stringify({ items: [], places: [], set: { lang: 'en', onboarded: true, city: 'x' } }));
    const home = { lat: 33.0, lon: 35.1 }, dest = { lat: 33.02, lon: 35.1 };
    const stops = [{ id: 1, name: 'Stop A (bus 5)', lat: home.lat - 0.0025, lon: home.lon }, { id: 2, name: 'Stop B (bus 3)', lat: home.lat + 0.0075, lon: home.lon }, { id: 3, name: 'Dest 5', lat: dest.lat + 0.0006, lon: dest.lon }, { id: 4, name: 'Dest 3', lat: dest.lat - 0.0095, lon: dest.lon }].map(s => Object.assign({ code: 'c' }, s));
    const iso = m => new Date(t + m * 60000).toISOString(), rs = (ride, stop, m, seq, line) => ({ gtfs_ride_id: ride, gtfs_stop_id: stop, arrival_time: iso(m), stop_sequence: seq, gtfs_route__route_short_name: line, gtfs_route__route_long_name: 'A<->B', gtfs_ride_stop__shape_dist_traveled: 0 });
    window.CAP = 100; window.__reqs = 0;
    window.fetch = async u => { u = String(u); const j = x => new Response(JSON.stringify(x));
      if (u.includes('nominatim')) return j({ address: { city: 'x' } }); if (u.includes('/gtfs_stops/list')) return j(stops); if (u.includes('/siri_vehicle_locations')) return j([]);
      if (u.includes('/gtfs_ride_stops/list')) { window.__reqs++; const ids = decodeURIComponent((u.match(/gtfs_stop_ids=([^&]*)/) || [])[1] || '').split(',').map(Number), from = new Date(decodeURIComponent((u.match(/arrival_time_from=([^&]*)/) || [])[1])).getTime(), to = new Date(decodeURIComponent((u.match(/arrival_time_to=([^&]*)/) || [])[1])).getTime();
        let out = [];
        for (let i = 0; i < 200; i++) { const m = 5 + i * 0.6; if (ids.includes(1)) out.push(rs('F' + i, 1, m, 1, '5')); if (ids.includes(3)) out.push(rs('F' + i, 3, m + 6, 9, '5')) }   // a very busy line 5
        for (let i = 0; i < 4; i++) { const m = 12 + i * 20; if (ids.includes(2)) out.push(rs('T' + i, 2, m, 1, '3')); if (ids.includes(4)) out.push(rs('T' + i, 4, m + 14, 9, '3')) }
        out = out.filter(r => { const a = new Date(r.arrival_time).getTime(); return a >= from && a <= to }).sort((x, y) => new Date(x.arrival_time) - new Date(y.arrival_time)).slice(0, window.CAP);   // the service's cap: only the earliest rows
        return j(out) }
      return j([]) };
  });
  await p.goto(URL); await p.waitForTimeout(700);
  const r = await p.evaluate(async () => { const x = await findTrips({ lat: 33.0, lon: 35.1 }, { lat: 33.02, lon: 35.1 }, null); const by = {}; x.opts.forEach(o => by[o.line] = (by[o.line] || 0) + 1); const t3 = x.opts.filter(o => o.line == '3'); return { by, n: x.opts.length, t3: t3.map(o => [o.depStop.name, o.arrStop.name]), reqs: window.__reqs } });
  ok('with a very busy bus 5 and a capped answer, bus 3 (from a stop further away) is still offered', (r.by['3'] || 0) >= 1 && (r.by['5'] || 0) >= 1, JSON.stringify(r));
  ok('every line shows once, not only the busiest', (r.by['5'] || 0) === 1 && (r.by['3'] || 0) === 1, JSON.stringify(r.by));
  ok('bus 3 is boarded at its own stop and left at its own stop', r.t3.length > 0 && r.t3.every(x => x[0] === 'Stop B (bus 3)' && x[1] === 'Dest 3'), JSON.stringify(r.t3));
  ok('every line: no JS errors', !p.errs.length, p.errs.join('|')); await c.close();
}

// Look: no star, the recommended bus is the selected one, a fitting (not black) bus chip, and long lines scroll with an edge fade
async function look(b) {
  const c = await b.newContext({ viewport: { width: 340, height: 800 } }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('tempo.v1', JSON.stringify({ items: [], places: [], set: { lang: 'en', onboarded: true } })) });
  await p.goto(URL); await p.waitForTimeout(600);
  const r = await p.evaluate(async () => { const n = Date.now(), mk = (ride, line, dm, sig, rec, wTo = 12, wFrom = 14) => ({ ride, line, dep: new Date(n + (dm + wTo) * 6e4), arr: new Date(n + (dm + 30) * 6e4), depStop: { name: 'A very long stop name that will not fit on a narrow phone screen at all', lat: 1, lon: 1 }, arrStop: { name: 'x' }, wTo, wFrom, total: 33, walk: wTo + wFrom, live: sig == 'live', sig, leave: new Date(n + dm * 6e4), reach: new Date(n + (dm + 33) * 6e4), rec });
    openSh('<div id="x">' + tripBlock({ opts: [mk('a', '3', 15, 'live', 1), mk('b', '5', 20, 'sched'), mk('c', '117', 30, 'sched', 0, 25, 20)] }, null, null) + '</div>'); await new Promise(r => setTimeout(r, 400));
    const bp = getComputedStyle(document.querySelector('.bpill')).backgroundColor, tx = document.body.innerText;
    const mq = [...document.querySelectorAll('.brw .lvs')].map(e => ({ cls: e.classList.contains('mq'), d: e.style.getPropertyValue('--d'), anim: getComputedStyle(e.firstElementChild).animationName, mask: getComputedStyle(e).webkitMaskImage || getComputedStyle(e).maskImage }));
    return { star: /★/.test(tx), sel: document.querySelector('.brw.ch .bl b').textContent, selCount: document.querySelectorAll('.brw.ch').length, bp, mq, topRec: document.querySelector('.tph .ln').innerText.trim() } });
  ok('no star icon anywhere', !r.star);
  ok('the recommended bus is the selected one by default (one row highlighted, shown at the top)', r.selCount === 1 && r.sel === '3' && r.topRec.includes('3'), JSON.stringify([r.sel, r.selCount, r.topRec]));
  ok('the bus chip is not black any more', r.bp !== 'rgb(17, 17, 19)' && r.bp !== 'rgb(0, 0, 0)' && r.bp !== 'rgb(242, 242, 245)', r.bp);
  ok('a line that is too long fades at the border and scrolls in a loop', r.mq.some(m => m.cls && /mqs|mqr/.test(m.anim) && /gradient/.test(m.mask) && parseInt(m.d) > 3), JSON.stringify(r.mq));
  ok('a line that fits stays still (no animation)', await p.evaluate(() => { const w = document.querySelector('.tph .tpt'); return !!w && !w.closest('.mq') }));
  ok('look: no JS errors', !p.errs.length, p.errs.join('|')); await c.close();
}

// The map: the walk to the stop is a dashed line, the bus's own way a solid line in another colour
async function mapLines(b) {
  const c = await b.newContext({ viewport: { width: 390, height: 800 } }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(() => {
    localStorage.setItem('tempo.v1', JSON.stringify({ items: [], places: [], set: { lang: 'en', onboarded: true } }));
    window.__lines = []; window.__markers = [];
    const chain = o => o;
    window.L = { map: () => ({ setView() { return this }, on() {}, fitBounds(b) { window.__fit = b }, invalidateSize() {}, remove() {}, panTo() {}, attributionControl: { setPrefix() {} } }), tileLayer: () => ({ addTo() {} }), marker: ll => ({ addTo() { window.__markers.push(ll); return this }, setLatLng() {}, getLatLng() { return ll } }), polyline: (pts, o) => { const l = { pts, o, addTo() { window.__lines.push(l); return l }, setLatLngs(p2) { l.pts = p2 } }; return l }, divIcon: o => o };
    window.loadLeaflet = async () => {};
    const j = x => new Response(JSON.stringify(x));
    const real = window.fetch;
    window.fetch = async u => { u = String(u);
      if (u.includes('gtfs_ride_stops/list') && u.includes('gtfs_ride_ids')) return j([1, 2, 3, 4].map(i => ({ gtfs_ride_id: 'R', stop_sequence: i, gtfs_stop__lat: 33.0 + i * 0.002, gtfs_stop__lon: 35.1 + i * 0.001 })));
      if (u.includes('routed-car')) return j({ routes: [{ geometry: { coordinates: [[35.101, 33.002], [35.1015, 33.004], [35.102, 33.006], [35.103, 33.008]] } }] });
      if (u.includes('routed-foot')) return j({ routes: [{ duration: 300, distance: 400, geometry: { coordinates: [[35.09, 32.99], [35.095, 32.995], [35.1, 33.0]] } }] });
      return j([]) };
  });
  await p.goto(URL); await p.waitForTimeout(500);
  await p.evaluate(() => { const n = Date.now(); const x = { ride: 'R', line: '3', dep: new Date(n + 9e5), arr: new Date(n + 18e5), depStop: { name: 'Herzl', lat: 33.002, lon: 35.101 }, arrStop: { name: 'End', lat: 33.008, lon: 35.104 }, depSeq: 1, arrSeq: 4, o: { lat: 32.99, lon: 35.09 }, d: { lat: 33.01, lon: 35.105 }, wTo: 3, wFrom: 4, total: 33, walk: 7, sig: 'sched', live: false, leave: new Date(n + 6e5), reach: new Date(n + 2e6), rec: 1 }; walkMap(33.002, 35.101, 'Herzl', '07:10', '3', x) });
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => ({ lines: window.__lines.map(l => ({ n: l.pts.length, dash: l.o.dashArray || '', color: l.o.color })), legend: !!document.querySelector('.mlg .ld') && !!document.querySelector('.mlg .ls') }));
  const bus = r.lines.filter(l => !l.dash), walk = r.lines.filter(l => l.dash);
  ok('the bus route is a solid line', bus.length === 1 && bus[0].n >= 2, JSON.stringify(r.lines));
  ok('the walk to the stop and the walk after the bus are dashed lines', walk.length >= 2, JSON.stringify(r.lines));
  ok('the bus line has a different colour from the walking lines', bus.length === 1 && walk.every(w => w.color !== bus[0].color), JSON.stringify(r.lines));
  ok('a small legend explains dashed = walk and solid = bus', r.legend);
  ok('the map shows the route stops and the destination', await p.evaluate(() => window.__markers.length >= 3));
  ok('map lines: no JS errors', !p.errs.length, p.errs.join('|')); await c.close();
}

// Long waits read as hours; and for a task at a set time only the buses around that time are listed
async function aroundTime(b) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(() => {
    const t = new Date('2026-11-24T09:24').getTime(), R = Date; class D extends R { constructor(...a) { a.length ? super(...a) : super(t) } static now() { return t } } window.Date = D;
    localStorage.setItem('tempo.v1', JSON.stringify({ items: [], places: [], set: { lang: 'en', onboarded: true, city: 'x' } }));
    const stops = [{ id: 1, name: 'A', lat: 32.9985, lon: 35.1 }, { id: 2, name: 'B', lat: 33.02, lon: 35.1 }].map(s => Object.assign({ code: 'c' }, s));
    const iso = m => new Date(t + m * 60000).toISOString(), rs = (ride, stop, m, seq) => ({ gtfs_ride_id: ride, gtfs_stop_id: stop, arrival_time: iso(m), stop_sequence: seq, gtfs_route__route_short_name: '3', gtfs_route__route_long_name: 'A<->B', gtfs_ride_stop__shape_dist_traveled: 0 });
    window.fetch = async u => { u = String(u); const j = x => new Response(JSON.stringify(x));
      if (u.includes('nominatim')) return j({ address: { city: 'x' } }); if (u.includes('/gtfs_stops/list')) return j(stops); if (u.includes('/siri_vehicle_locations')) return j([]);
      if (u.includes('/gtfs_ride_stops/list')) { const ids = decodeURIComponent((u.match(/gtfs_stop_ids=([^&]*)/) || [])[1] || '').split(',').map(Number), from = new Date(decodeURIComponent((u.match(/arrival_time_from=([^&]*)/) || [])[1])).getTime(), to = new Date(decodeURIComponent((u.match(/arrival_time_to=([^&]*)/) || [])[1])).getTime(), out = [];
        for (let i = 0; i < 40; i++) { const m = 5 + i * 15; if (ids.includes(1)) out.push(rs('R' + i, 1, m, 1)); if (ids.includes(2)) out.push(rs('R' + i, 2, m + 20, 9)) }
        return j(out.filter(r => { const a = new Date(r.arrival_time).getTime(); return a >= from && a <= to })) }
      return j([]) };
  });
  await p.goto(URL); await p.waitForTimeout(700);
  const r = await p.evaluate(async () => { const by = new Date(Date.now() + 400 * 60000); const x = await findTrips({ lat: 33.0, lon: 35.1 }, { lat: 33.02, lon: 35.1 }, by); const gaps = x.opts.map(o => Math.round((+by - +o.reach) / 60000)); return { n: x.opts.length, gaps, rec: x.opts.find(o => o.rec) && Math.round((+by - +x.opts.find(o => o.rec).reach) / 60000) } });
  ok('for a task 6h40 away, only buses arriving around that time are listed (within 90 min before it, a couple after)', r.n >= 1 && r.gaps.every(g => g <= 90 && g >= -30), JSON.stringify(r));
  ok('the recommended bus is one of them (it arrives close to the task time)', r.rec != null && r.rec >= 0 && r.rec <= 90, JSON.stringify(r));
  const h = await p.evaluate(() => { openSh('<div id="x">' + tripBlock({ opts: [{ ride: 'a', line: '3', dep: new Date(Date.now() + 403 * 6e4), arr: new Date(Date.now() + 430 * 6e4), depStop: { name: 'Herzl', lat: 1, lon: 1 }, arrStop: { name: 'x' }, wTo: 3, wFrom: 4, total: 33, walk: 7, sig: 'sched', live: false, leave: new Date(Date.now() + 400 * 6e4), reach: new Date(Date.now() + 437 * 6e4), rec: 1, nx: [new Date(Date.now() + 403 * 6e4), new Date(Date.now() + 423 * 6e4)] }] }, null, null) + '</div>'); return { top: document.querySelector('.tpcd .cdn b').textContent, unit: getComputedStyle(document.querySelector('.tpcd .cu')).display, rowNums: [...document.querySelectorAll('.lvs [data-cd] b')].map(e => e.textContent) } });
  ok('400 minutes reads as 6h 40m at the top, with no "min" next to it', /6h\s?40m?/.test(h.top) && h.unit === 'none', JSON.stringify(h));
  ok('the hours stay on one line at the top', await p.evaluate(() => { const b = document.querySelector('.tpcd .cdn b'); return b.getBoundingClientRect().height < 40 }));
  ok('long waits in the rows read as hours too, and the trailing "min" is dropped', h.rowNums.every(x => /h/.test(x)), JSON.stringify(h.rowNums));
  ok('around-time: no JS errors', !p.errs.length, p.errs.join('|')); await c.close();
}
module.exports = async b => {
  await aroundTime(b); await mapLines(b); await look(b); await everyLine(b); await ranking(b); await soonest(b); await liveMin(b);
  const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(() => {
    const t = new Date('2026-11-24T06:38').getTime(), R = Date; class D extends R { constructor(...a) { a.length ? super(...a) : super(t) } static now() { return t } } window.Date = D;
    localStorage.setItem('tempo.v1', JSON.stringify({ items: [], places: [], set: { lang: 'en', onboarded: true, city: 'נהריה' } }));
    const home = { lat: 33.0, lon: 35.1 }, dest = { lat: 33.02, lon: 35.1 };
    // 12 closer stops near home with nothing going to the destination; the useful stop is ~600 m away (13th nearest) and only the position search finds it
    const stops = [];
    for (let i = 0; i < 12; i++) stops.push({ id: 100 + i, code: 'd' + i, name: 'Decoy ' + i, lat: home.lat + 0.0006 + i * 0.0003, lon: home.lon });
    const useful = { id: 500, code: 'u', name: 'Real stop', lat: home.lat - 0.0055, lon: home.lon }, destStop = { id: 900, code: 'x', name: 'Dest stop', lat: dest.lat, lon: dest.lon };
    window.__log = [];
    const iso = m => new Date(t + m * 60000).toISOString();
    const rs = (ride, stop, m, seq, line) => ({ gtfs_ride_id: ride, gtfs_stop_id: stop, arrival_time: iso(m), stop_sequence: seq, gtfs_route__route_short_name: line, gtfs_route__route_long_name: 'A<->B', gtfs_ride_stop__shape_dist_traveled: 0 });
    window.fetch = async (u) => {
      u = String(u); window.__log.push(u.replace(/^https?:\/\/[^/]+/, '').slice(0, 90));
      const j = x => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });
      if (u.includes('nominatim')) return j({ address: { city: 'נהריה' } });
      if (u.includes('/gtfs_stops/list')) { if (u.includes('lat__greater_or_equal')) return j([...stops, useful, destStop]); return j(window.__cityOnly === false ? [] : [...stops, destStop]) }
      if (u.includes('/siri_vehicle_locations')) return j([]);
      if (u.includes('/gtfs_ride_stops/list')) {
        const ids = decodeURIComponent((u.match(/gtfs_stop_ids=([^&]*)/) || [])[1] || '').split(',').map(Number), out = [];
        if (ids.includes(500)) out.push(rs('R1', 500, 20, 1, '3'), rs('R1x', 500, 35, 1, '9'));
        if (ids.includes(900)) out.push(rs('R1', 900, 40, 9, '3'));
        if (ids.includes(100)) out.push(rs('R7', 100, 15, 1, '7'));
        return j(out);
      }
      return j([]);
    };
  });
  await p.goto(URL); await p.waitForTimeout(800);
  const r = await p.evaluate(async () => { const o = { lat: 33.0, lon: 35.1 }, d = { lat: 33.02, lon: 35.1 }; const x = await findTrips(o, d, new Date(new Date().getTime() + 80 * 60000)); return { n: x.opts.length, line: x.opts[0] && x.opts[0].line, stop: x.opts[0] && x.opts[0].depStop.name, w: x.opts[0] && x.opts[0].wTo, why: x.why } });
  ok('a bus from a stop ~8 minutes away is found even with 12 closer stops that have no useful bus', r.n === 1 && r.line === '3' && r.stop === 'Real stop', JSON.stringify(r));
  ok('the walk to that stop is counted (about 8 minutes)', r.w >= 6 && r.w <= 11, String(r.w));
  const log = await p.evaluate(() => window.__log);
  ok('stops were also searched by position, not only by municipality', log.some(l => /gtfs_stops\/list.*lat__greater_or_equal/.test(l)));
  ok('bus times are asked for in batches, not one request per stop', log.filter(l => /gtfs_ride_stops\/list/.test(l)).length <= 8, String(log.filter(l => /gtfs_ride_stops/.test(l)).length));
  // no direct bus -> nearby buses are listed
  const r2 = await p.evaluate(async () => { const o = { lat: 33.0, lon: 35.1 }, d = { lat: 33.05, lon: 35.1 }; const x = await findTrips(o, d, null); const html = tripBlock(x, null, null); return { why: x.why, near: (x.near || []).map(n => n.line + '@' + n.stop.name), html: !/No direct bus|Buses from nearby|change/.test(html) && /class="ln"/.test(html) } });
  ok('with no direct bus, it just lists the buses from nearby stops, with no extra text', r2.why === 'nostop' || (r2.why === 'nodirect' && r2.near.length >= 1 && r2.html), JSON.stringify(r2));
  ok('no JS errors', !p.errs.length, p.errs.join('|')); await c.close();
};
