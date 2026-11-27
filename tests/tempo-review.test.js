const { ok } = require('./lib');
const path = require('path');
const URL = 'https://tempo.test/';

module.exports = async browser => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await page.route(URL, route => route.fulfill({ path: path.join(__dirname, '../tempo/index.html') }));
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
        [...ride('early', '3', '15:45', '16:08'), ...ride('on-time', '3', '16:05', '16:26'), ...(window.hideLate?[]:ride('late', '5', '16:12', '16:37')), ...ride('late-14', '14', '16:17', '16:48'), ...ride('late-15', '15', '16:18', '16:49')] : [];
      return new Response(JSON.stringify(rows));
    };
  });
  try {
    await page.goto(URL);
    await page.evaluate(() => goSheet('gym', today()));
    await page.locator('.tph').waitFor();
    ok('early departures are above the recommendations and nearby lines remain available', await page.evaluate(() => {
      const plan = busPlan(occ(today()).find(x => x.id === 'gym'), today());
      return plan.ride === 'on-time' && document.querySelector('[data-ride="late"]') &&
        !!document.querySelector('.trip-history-earlier [data-ride="early"]');
    }));
    ok('14 minutes late stays eligible and exactly 15 minutes late is listed only under Other buses', await page.evaluate(() =>
      !!document.querySelector('.trip-history-current [data-ride="late-14"]') &&
      !!document.querySelector('#obus [data-ride="late-15"]') &&
      !document.querySelector('.trip-history-current [data-ride="late-15"]')));
    const departures=page.locator('.trip-history');
    await departures.hover();
    const topBefore=await departures.evaluate(el=>el.scrollTop);
    await page.mouse.wheel(0,-300);
    await page.waitForFunction(top=>$('.trip-history').scrollTop<top,topBefore);
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
    await page.waitForFunction(()=>busPlan(S.items.find(x=>x.id==='gym'),today())?.ride==='late');
    ok('the plan and the bus sheet show the same selected departure and flag late arrival', await page.evaluate(() =>
      [...document.querySelectorAll('.cn')].some(x => x.textContent.includes(document.querySelector('.arv b').textContent)) &&
      document.querySelector('#gbus [role="status"]').textContent.includes('late')));
    await page.reload();
    ok('the saved trip applies only to the selected date and survives reload', await page.evaluate(() => {
      const task = S.items.find(x => x.id === 'gym');
      return busPlan(task, today()).ride === 'late' && busPlan(task, addD(today(), 1)) === null;
    }));

    await page.evaluate(() => {
      window.clock=+new Date(today()+'T15:45:00');render(0);
    });
    ok('Today shows an imminent saved bus departure as its primary action', await page.locator('.hero-trip').count()===1);
    await page.locator('.hero-trip').click();
    await page.locator('#trip-retime').click();
    await page.locator('#occ-time').fill('16:45');
    await page.locator('#occ-save').click();
    ok('rescheduling from a late bus updates one occurrence without changing the repeat or departure', await page.evaluate(()=>{
      const it=S.items.find(x=>x.id==='gym'),date=today();
      return it.time==='16:35'&&occ(date).find(x=>x.id==='gym').time==='16:45'&&
        occ(addD(date,1)).find(x=>x.id==='gym').time==='16:35'&&it.busPlans[date].ride==='late';
    }));
    await page.evaluate(async()=>{
      closeSh(true);window.hideLate=true;tripResultCache.clear();await refreshPlannedBus();
      goSheet('gym',today());
    });
    await page.locator('.trip-resolution [data-ride="on-time"]').waitFor();
    ok('a missing saved departure offers a replacement and does not silently select it', await page.evaluate(()=>{
      const it=occ(today()).find(x=>x.id==='gym'),plan=busPlan(it,today());
      return plan.ride==='late'&&plan.unavailable&&$('.trip-resolution').textContent.includes('Switch to line 3');
    }));
    await page.locator('.trip-resolution [data-ride="on-time"]').click();
    await page.waitForFunction(()=>busPlan(occ(today()).find(x=>x.id==='gym'),today())?.ride==='on-time');
    await page.evaluate(() => weekReview());
    await page.locator('#review-note').fill('Check the gym hours');
    await page.locator('[data-review-task="gym"]').click();
    await page.locator('#sn').fill('Bring a towel');
    await page.locator('#sn').press('Enter');
    await page.locator('#nt').fill('Use the side entrance');
    await page.locator('#review-back').click();
    await page.locator('#review-check').click();
    await page.locator('.review-summary summary').click();
    ok('the week overview lists all seven days with review and note status', await page.evaluate(()=>{
      const status=$('.review-summary');
      return status.querySelectorAll('[data-review-date]').length===7&&status.textContent.includes('Reviewed')&&status.textContent.includes('Notes 2');
    }));
    ok('weekly review saves the day and occurrence details without editing the routine', await page.evaluate(() => {
      const date = reviewWeekStart(), gym = S.items.find(x => x.id === 'gym');
      return S.weekReview[date].checked && S.weekReview[date].note === 'Check the gym hours' &&
        gym.review[date].note === 'Use the side entrance' && gym.review[date].steps[0].t === 'Bring a towel' &&
        gym.rep === 'daily' && !gym.steps && !gym.note;
    }));

    ok('accurate arrival followed by departure completes a task, while consecutive same-place tasks ask at the end', await page.evaluate(() => {
      closeSh(true);
      const read = (lat, accuracy = 15) => leftCheck({ lat, lon: 35.1, accuracy, at: Date.now() });
      window.clock=+new Date(today()+'T08:13:00');
      const day = today(), byId = id => S.items.find(x => x.id === id);
      read(33.01, 500);
      read(33.03);
      if (isDone(byId('school'), day)) return false;
      read(33.01);
      read(33.03);
      if (!isDone(byId('school'), day)||!byId('school').autoDone[day]) return false;
      window.clock = +new Date(day + 'T17:44:00');
      read(33.03);
      read(33.01);
      window.clock += 60000;
      finCheck();
      return !isDone(byId('gym'), day) && $('#tt').textContent.includes('Did you finish?');
    }));
    await page.evaluate(()=>detail('school',today()));
    await page.locator('.finish-reason summary').click();
    await page.locator('#auto-reopen').click();
    ok('an auto-completion explanation stays available and the task can be reopened', await page.evaluate(()=>{
      const item=S.items.find(x=>x.id==='school');return !isDone(item,today())&&!item.autoDone[today()];
    }));
    ok('Tempo review, transit and completion raise no page errors', !errors.length, errors.join('|'));
  } finally {
    await page.close();
  }
};
