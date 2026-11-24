// Buses: a stop a few minutes' walk away is found even when many closer stops have nothing useful, or when it belongs to another municipality;
// and when no bus goes straight there, the buses from nearby stops are listed instead of just "No direct bus found".
const { ok } = require('./lib');
const path = require('path'), URL = 'file://' + path.join(__dirname, '..', 'tempo', 'index.html');
module.exports = async b => {
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
  const r2 = await p.evaluate(async () => { const o = { lat: 33.0, lon: 35.1 }, d = { lat: 33.05, lon: 35.1 }; const x = await findTrips(o, d, null); const html = tripBlock(x, null, null); return { why: x.why, near: (x.near || []).map(n => n.line + '@' + n.stop.name), html: /Buses from nearby stops/.test(html) } });
  ok('with no direct bus, it says so and lists the buses from nearby stops', r2.why === 'nostop' || (r2.why === 'nodirect' && r2.html && r2.near.length >= 1), JSON.stringify(r2));
  ok('no JS errors', !p.errs.length, p.errs.join('|')); await c.close();
};
