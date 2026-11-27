const { ok } = require('./lib');
const { pathToFileURL } = require('url');
const path = require('path');

module.exports = async browser => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const R = Date, now = +new R('2026-11-27T09:00');
    window.Date = class extends R {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return now; }
    };
    const items = [
      { id: 'gym', title: 'Gym', time: '18:00', dur: 60 },
      { id: 'dinner', title: 'Dinner', time: '19:00', dur: 60 },
      { id: 'morning-call', title: 'Call', time: '10:00', dur: 30 },
      { id: 'afternoon-call', title: 'Call', time: '15:00', dur: 30 },
    ].map(item => ({ ...item, date: '2026-11-27', rep: 'daily', done: {} }));
    if (!localStorage.getItem('tempo.v1')) localStorage.setItem('tempo.v1', JSON.stringify({ items, set: { lang: 'en', notif: false, onboarded: true, cloudKey: 'test-key' } }));
    window.SpeechRecognition = class {
      start() { window.recording = this; }
      stop() { setTimeout(() => this.onend?.(), 0); }
      abort() { this.onend?.(); }
    };
    window.say = text => {
      const event = { results: [Object.assign([{ transcript: text }], { isFinal: true })] };
      window.recording.onresult(event);
    };
    window.fetch = async (url, init) => {
      if (String(url).endsWith('/api/tempo/assistant')) {
        window.cloudRequest = JSON.parse(init.body);
        return new Response(JSON.stringify({ plan: { actions: [
          { kind: 'edit', date: '2026-11-27', id: 'gym', title: 'Training', emoji: '🏋️', color: '#22aa77' },
          { kind: 'step', date: '2026-11-27', id: 'gym', text: 'Pack a towel' },
        ] } }));
      }
      return new Response('{}');
    };
  });
  try {
    await page.goto(pathToFileURL(path.join(__dirname, '../tempo/index.html')).href);
    await page.getByRole('button', { name: 'Ask Tempo' }).click();
    ok('the microphone opens a recording sheet', await page.locator('.listening .ask-wave').isVisible());
    await page.evaluate(() => say('Move gym to 6 PM, actually 7 PM'));
    await page.getByRole('button', { name: 'Pause recording' }).click();
    await page.waitForFunction(() => !document.querySelector('#ask-text').readOnly);
    ok('pausing makes the transcript editable', (await page.locator('#ask-text').inputValue()).includes('actually 7 PM'));
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('button', { name: 'Undo', exact: true }).last().waitFor();
    ok('Tempo applies the correction, moves dependent tasks, and leaves tomorrow unchanged', await page.evaluate(() =>
      occ(today()).find(x=>x.id==='gym').time==='19:00'&&occ(today()).find(x=>x.id==='dinner').time==='20:00'&&
      occ(addD(today(),1)).find(x=>x.id==='gym').time==='18:00'));
    async function send(text) {
      await page.locator('#ask-text').fill(text);
      await page.getByRole('button', { name: 'Send' }).click();
      await page.waitForFunction(() => !document.querySelector('#ask-text').readOnly);
    }
    await send("No, that's wrong");
    ok('a conversational correction undoes the entire last action', await page.evaluate(()=>
      occ(today()).find(x=>x.id==='gym').time==='18:00'&&occ(today()).find(x=>x.id==='dinner').time==='19:00'));
    await send('Add note "Check again tomorrow" to Call');
    await page.locator('[data-ask-choice]').filter({ hasText:'15:00' }).click();
    ok('ambiguous task names stay in the sheet and a choice saves the note for the correct day',await page.evaluate(() => {
      const item=S.items.find(x=>x.id==='afternoon-call');
      return item.review?.[today()]?.note==='Check again tomorrow'&&!item.review[addD(today(),1)]&&!!$('#ask-text');
    }));
    await page.locator('.ask-model summary').click();
    await page.locator('#ask-cloud').check();
    await send('Give the gym a training theme, and make packing a towel a step');
    ok('the optional language model sends a limited task context and can return multiple validated changes', await page.evaluate(() => {
      const item=occ(today()).find(x=>x.id==='gym');
      return item.title==='Training'&&item.emoji==='🏋️'&&item.color==='#22aa77'&&item.review[today()].steps[0].t==='Pack a towel'&&
       window.cloudRequest.tasks.every(x=>!x.photo&&!x.note&&!x.pl);
    }));
    await send('undo the last change');
    ok('spoken-style undo bypasses the model and restores the previous title, icon, and steps',await page.evaluate(()=>
      occ(today()).find(x=>x.id==='gym').title==='Gym'&&!occ(today()).find(x=>x.id==='gym').review?.[today()]?.steps));
    await page.evaluate(() => { S.set.assistantCloud=false;closeSh(true);assistantSheet();say('Add dentist tomorrow from 6 to 7 PM'); });
    await page.getByRole('button', { name: 'Send' }).click();
    await page.waitForFunction(()=>occ(addD(today(),1)).some(x=>x.title==='dentist'));
    ok('Send while recording finishes transcription and adds the full time range',await page.evaluate(()=>{
      const item=occ(addD(today(),1)).find(x=>x.title==='dentist');return item.time==='18:00'&&item.dur===60;
    }));
    ok('the local interpreter accepts everyday Hebrew and Hebrew punctuation',await page.evaluate(()=>{
      const plan=localAssistant('תוסיף אימון מחר ב־19:00');return plan?.actions[0].title==='אימון'&&
       plan.actions[0].time==='19:00'&&plan.actions[0].date===addD(today(),1);
    }));
    await page.reload();
    ok('the last action can still be undone after reloading the same session',await page.evaluate(()=>{
      const output=undoAssistant();return output.includes('Undid')&&!occ(addD(today(),1)).some(x=>x.title==='dentist');
    }));
    ok('a bus request selects an actual timetable ride and can be undone',await page.evaluate(async()=>{
      const home={id:'home',home:true,lat:33,lon:35},gym={id:'place',lat:33.01,lon:35};
      S.places=[home,gym];S.items.find(x=>x.id==='gym').pl=gym.id;
      const leave=taskAt(today(),17*60+30),reach=taskAt(today(),17*60+57);
      findTrips=async()=>({opts:[{ride:'5-actual',line:'5',leave,dep:taskAt(today(),17*60+35),reach,total:27,o:home,d:gym}],more:[]});
      const response=await applyAssistant(localAssistant('Switch the bus for gym to line 5'));
      const chosen=busPlan(occ(today()).find(x=>x.id==='gym'),today());
      if(!response.undo||chosen?.ride!=='5-actual')return false;
      undoAssistant();return !busPlan(occ(today()).find(x=>x.id==='gym'),today());
    }));
    ok('the assistant flow has no page errors', errors.length===0, errors.join('|'));
  } finally {
    await page.close();
  }
};
