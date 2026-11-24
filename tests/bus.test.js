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
  ok('every option shows its total time', r.hasTotal && r.html);
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

// Live minutes: a countdown that ticks by itself, LIVE marking, and no "Walk to the stop" link
async function liveMin(b) {
  const c = await b.newContext({ viewport: { width: 390, height: 800 } }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('tempo.v1', JSON.stringify({ items: [], places: [], set: { lang: 'en', onboarded: true } })) });
  await p.goto(URL); await p.waitForTimeout(600);
  const r = await p.evaluate(() => { const n = Date.now(), mk = (ride, line, dm, live, rec) => ({ ride, line, dep: new Date(n + (dm + 3) * 6e4), arr: new Date(n + (dm + 30) * 6e4), depStop: { name: 'Herzl', lat: 1, lon: 1 }, arrStop: { name: 'x' }, wTo: 3, wFrom: 3, total: 33, walk: 6, live, leave: new Date(n + dm * 6e4), reach: new Date(n + (dm + 33) * 6e4), rec });
    openSh('<div id="x">' + tripBlock({ opts: [mk('a', '3', 9, true, 1), mk('b', '5', 20, false)] }, null, null) + '</div>');
    const g = () => [...document.querySelectorAll('[data-cd] b')].map(e => e.textContent);
    const before = g(), live = document.querySelectorAll('.cd.lv').length, lbl = [...document.querySelectorAll('.cd small')].map(e => e.textContent.trim());
    document.querySelectorAll('[data-cd]').forEach(e => e.dataset.cd = String(+e.dataset.cd - 120000)); cdTick();
    return { before, after: g(), live, lbl, walkLink: !!document.querySelector('.wstop') || /Walk to the stop/.test(document.body.innerText) } });
  ok('each bus shows minutes until you must leave', r.before.join() === '9 min,20 min', r.before.join());
  ok('the minutes count down by themselves (two minutes pass: 7 and 18)', r.after.join() === '7 min,18 min', r.after.join());
  ok('a bus tracked live is marked LIVE (green), the scheduled one says "Leave in"', r.live === 1 && r.lbl.some(x => /LIVE/.test(x)) && r.lbl.some(x => /Leave in/.test(x)), r.lbl.join('|'));
  ok('there is no "Walk to the stop" link any more', !r.walkLink);
  ok('a bus that has left shows "Now"', await p.evaluate(() => { document.querySelectorAll('[data-cd]').forEach(e => e.dataset.cd = String(Date.now() - 1000)); cdTick(); return [...document.querySelectorAll('[data-cd] b')].every(e => e.textContent === 'Now') }));
  ok('live minutes: no JS errors', !p.errs.length, p.errs.join('|')); await c.close();
}
module.exports = async b => {
  await ranking(b); await soonest(b); await liveMin(b);
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
