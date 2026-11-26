const { ok } = require('./lib');
const { pathToFileURL } = require('url');
const path = require('path');

module.exports = async browser => {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', error => errors.push(error.message));
  await p.addInitScript(() => {
    const R = Date, now = +new R('2026-11-23T08:00');
    window.Date = class extends R {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return now; }
    };
    const common = { date: '2026-11-23', rep: 'daily', dur: 60 };
    const items = [
      { ...common, id: 'first', title: 'Studio', time: '10:00', area: 'work' },
      { ...common, id: 'second', title: 'Read', time: '11:00', priority: -1 },
    ];
    if (!localStorage.getItem('tempo.v1')) {
      localStorage.setItem('tempo.v1', JSON.stringify({ items, set: { onboarded: true, lang: 'en', notif: false } }));
    }
  });
  try {
    await p.goto(pathToFileURL(path.join(__dirname, '../tempo/index.html')).href);
    await p.getByRole('button', { name: 'Quick update' }).click();
    await p.locator('[data-quick-action="add"]').click();
    await p.locator('#quick-name').fill('Appointment');
    await p.locator('#quick-start').fill('10:00');
    await p.locator('#quick-end').fill('10:30');
    await p.locator('#quick-look').click();
    await p.locator('#look-priority').selectOption('1');
    await p.locator('#look-color').fill('#ee5d7a');
    await p.locator('#look-photo').setInputFiles(path.join(__dirname, '../tempo/icon-192.png'));
    await p.locator('#look-remove-photo').waitFor();
    await p.locator('#look-save').click();
    await p.locator('#quick-save').click();
    ok('a priority task fits first and the automatic moves stay on that date', await p.evaluate(() => {
      const day=today(), studio=occ(day).find(it=>it.id==='first'), read=occ(day).find(it=>it.id==='second');
      return studio.time==='10:30'&&read.time==='11:30'&&occ(addD(day,1)).find(it=>it.id==='first').time==='10:00'&&
        occ(day).find(it=>it.title==='Appointment').color==='#ee5d7a'&&
        occ(day).find(it=>it.title==='Appointment').photo.startsWith('data:image/jpeg;base64,');
    }));
    await p.getByRole('button', { name: 'Quick update' }).click();
    await p.locator('[data-quick-action="remove"]').click();
    await p.locator('[data-quick-task]').filter({ hasText: 'Appointment' }).click();
    ok('a quick removal restores space and brings automatically moved tasks back when possible', await p.evaluate(() =>
      occ(today()).length===2&&occ(today()).map(it=>it.time).join()=== '10:00,11:00'));

    await p.evaluate(() => detail('first',today()));
    await p.locator('#detail-retime').click();
    await p.locator('#occ-time').fill('09:30');
    ok('changing a one-day start does not change its end', await p.locator('#occ-end').inputValue()==='11:00');
    await p.locator('#occ-end').fill('10:30');
    ok('changing the one-day end leaves the start intact', await p.locator('#occ-time').inputValue()==='09:30');
    await p.locator('#occ-save').click();
    ok('the saved span is used by the occurrence while the series stays unchanged', await p.evaluate(() => {
      const item=S.items.find(x=>x.id==='first'), date=today();
      return occurrence(item,date).time==='09:30'&&taskEnd(occurrence(item,date))==='10:30'&&
        occurrence(item,addD(date,1)).time==='10:00'&&item.dur===60;
    }));
    await p.evaluate(() => quickUpdate(today(),'edit'));
    await p.locator('[data-quick-task="first"]').click();
    await p.locator('#quick-name').fill('Studio today');
    await p.locator('#quick-save').click();
    ok('a quick name change applies only to that date', await p.evaluate(()=>
      occ(today()).some(i=>i.title==='Studio today')&&occ(addD(today(),1)).some(i=>i.title==='Studio')));
    await p.evaluate(() => quickUpdate(today(),'note'));
    await p.locator('[data-quick-task="first"]').click();
    await p.locator('#sn').fill('Pack cables');
    await p.locator('#sn').press('Enter');
    await p.locator('#nt').fill('Use side door');
    await p.locator('#review-back').click();
    ok('quick steps and notes belong to today', await p.evaluate(() => {
      const task=S.items.find(x=>x.id==='first'), day=task.review[today()];
      return day.note==='Use side door'&&day.steps[0].t==='Pack cables'&&!task.note&&!task.steps;
    }));
    await p.evaluate(() => settings());
    ok('settings still has Categories, and the category sheet lists them', await p.locator('#cts').count()===1 && await p.evaluate(() => { closeSh(true); focusSheet(); return document.querySelectorAll('#fsb .cr').length === S.cats.length && S.cats.length > 0 }));
    ok('a category chosen in the task editor is kept on the task and tints it', await p.evaluate(() => { closeSh(true); edit(null, today()); const id = S.cats[0].id; document.querySelector('#cat [data-c="' + id + '"]').click(); document.querySelector('#fi').value = 'Category check'; document.querySelector('#fi').dispatchEvent(new Event('input')); const area = F.area; return area === id && taskColor({ area: id }) === S.cats[0].color }));
    ok('a task takes its look (colour and icon) from its category, over its own', await p.evaluate(() => { const c = S.cats[0], it = { area: c.id, color: '#123456', emoji: '🙂' }; return taskColor(it) === c.color && taskLook(it).emoji === (c.emoji || '') }));
    ok('quick update and sorting run without page errors', errors.length===0, errors.join('|'));
  } finally {
    await p.close();
  }
};
