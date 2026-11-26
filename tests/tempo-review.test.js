const { ok } = require('./lib');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.join(__dirname, '../tempo/index.html')).href;

module.exports = async browser => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.clock = +new Date('2026-11-26T08:13:00');
    const RealDate = Date;
    window.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [window.clock])); }
      static now() { return window.clock; }
    };
    const places = [
      { id: 'school', name: 'Rona Ramon', lat: 33.01, lon: 35.1 },
      { id: 'gym', name: 'Gym', lat: 33.03, lon: 35.1 },
    ];
    const items = [
      { id: 'school', title: 'National service', time: '08:00', dur: 480, pl: 'school' },
      { id: 'gym', title: 'Gym', time: '16:35', dur: 60, pl: 'gym', mode: 'bus', trav: 31 },
      { id: 'stretch', title: 'Stretch', time: '17:35', dur: 15, pl: 'gym' },
    ].map(item => ({ ...item, date: '2026-11-22', rep: 'daily' }));
    if (!localStorage.getItem('tempo.v1')) {
      localStorage.setItem('tempo.v1', JSON.stringify({ items, places, set: { lang: 'en', notif: false, onboarded: true } }));
    }
    const stops = places.map(({ name, lat, lon }, i) => ({ id: i + 1, name, lat, lon }));
    const ride = (id, line, leave, arrive) => [
      { gtfs_stop_id: 1, gtfs_ride_id: id, stop_sequence: 1, gtfs_route__route_short_name: line, arrival_time: '2026-11-26T' + leave + ':00' },
      { gtfs_stop_id: 2, gtfs_ride_id: id, stop_sequence: 2, arrival_time: '2026-11-26T' + arrive + ':00' },
    ];
    window.fetch = async input => {
      const url = String(input);
      const rows = url.includes('/gtfs_stops/list') ? stops : url.includes('/gtfs_ride_stops/list') ?
        [...ride('early', '3', '15:45', '16:08'), ...ride('on-time', '3', '16:05', '16:26'), ...ride('late', '5', '16:12', '16:37')] : [];
      return new Response(JSON.stringify(rows));
    };
  });
  try {
    await page.goto(URL);
    await page.evaluate(() => goSheet('gym', today()));
    await page.locator('.tph').waitFor();
    ok('early departures are kept under more and nearby lines remain available', await page.evaluate(() => {
      const plan = busPlan(occ(today()).find(x => x.id === 'gym'), today());
      return plan.ride === 'on-time' && document.querySelector('[data-ride="late"]') &&
        !!document.querySelector('#obus [data-ride="early"]');
    }));
    await page.locator('[data-moreb]').click();
    await page.locator('[data-ride="early"]').click();
    ok('an early departure can be selected explicitly without moving the task', await page.evaluate(() => {
      const task = S.items.find(x => x.id === 'gym');
      return task.time === '16:35' && busPlan(task, today()).early &&
        document.querySelector('#gbus [role="status"]').textContent.includes('previous task ends');
    }));
    await page.locator('[data-ride="on-time"]').click();
    ok('an on-time choice is remembered per route, and live statuses distinguish estimates from lost signal', await page.evaluate(() =>
      S.busHabits[JSON.stringify(['school','gym'])] === '3' &&
      tripLiveStatus({sig:'live',delayMinutes:4}).includes('Estimated delay') &&
      tripLiveStatus({sig:'lost'}).includes('scheduled time')));
    await page.locator('[data-ride="late"]').click();
    ok('the plan and the bus sheet show the same selected departure and flag late arrival', await page.evaluate(() =>
      [...document.querySelectorAll('.cn')].some(x => x.textContent.includes(document.querySelector('.arv b').textContent)) &&
      document.querySelector('#gbus [role="status"]').textContent.includes('after the task starts')));
    await page.reload();
    ok('the saved trip applies only to the selected date and survives reload', await page.evaluate(() => {
      const task = S.items.find(x => x.id === 'gym');
      return busPlan(task, today()).ride === 'late' && busPlan(task, addD(today(), 1)) === null;
    }));

    await page.evaluate(() => weekReview());
    await page.locator('#review-note').fill('Check the gym hours');
    await page.locator('[data-review-task="gym"]').click();
    await page.locator('#sn').fill('Bring a towel');
    await page.locator('#sn').press('Enter');
    await page.locator('#nt').fill('Use the side entrance');
    await page.locator('#review-back').click();
    await page.locator('#review-check').click();
    ok('weekly review saves the day and occurrence details without editing the routine', await page.evaluate(() => {
      const date = reviewWeekStart(), gym = S.items.find(x => x.id === 'gym');
      return S.weekReview[date].checked && S.weekReview[date].note === 'Check the gym hours' &&
        gym.review[date].note === 'Use the side entrance' && gym.review[date].steps[0].t === 'Bring a towel' &&
        gym.rep === 'daily' && !gym.steps && !gym.note;
    }));

    ok('accurate arrival followed by departure completes a task, while consecutive same-place tasks ask at the end', await page.evaluate(() => {
      closeSh(true);
      const read = (lat, accuracy = 15) => leftCheck({ lat, lon: 35.1, accuracy, at: Date.now() });
      const day = today(), byId = id => S.items.find(x => x.id === id);
      read(33.01, 500);
      read(33.03);
      if (isDone(byId('school'), day)) return false;
      read(33.01);
      read(33.03);
      if (!isDone(byId('school'), day)) return false;
      window.clock = +new Date(day + 'T17:34:00');
      read(33.03);
      read(33.01);
      window.clock += 60000;
      finCheck();
      return !isDone(byId('gym'), day) && $('#tt').textContent.includes('Did you finish?');
    }));
    ok('Tempo review, transit and completion raise no page errors', !errors.length, errors.join('|'));
  } finally {
    await page.close();
  }
};
