const { ok } = require('./lib');
const path = require('path');

module.exports = async browser => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const url = 'https://tempo.test/';
  await page.route(url, route => route.fulfill({ path: path.join(__dirname, '../tempo/index.html') }));
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
    await page.goto(url);
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
    await page.evaluate(()=>settings());
    await page.getByRole('button',{name:'Ask Tempo',exact:true}).last().click();
    await page.locator('#ask-cloud').click();
    await page.evaluate(()=>assistantSheet());
    await page.getByRole('button',{name:'Pause recording'}).click();
    await page.waitForFunction(()=>!document.querySelector('#ask-text').readOnly);
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
    await page.locator('#ask-undo').waitFor();
    await page.reload();
    const reloadedUndo = await page.evaluate(() => ({
      before: occ(addD(today(),1)).some(x=>x.title==='dentist'),
      output: undoAssistant(),
      after: occ(addD(today(),1)).some(x=>x.title==='dentist'),
    }));
    ok('the last action can still be undone after reloading the same session',
      reloadedUndo.before && reloadedUndo.output.includes('Undid') && !reloadedUndo.after, JSON.stringify(reloadedUndo));
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
    ok('the exact dog-walk request creates a ten-minute task four minutes from now',await page.evaluate(async()=>{
      const result=await applyAssistant(localAssistant("Please add for today trip with my dog, like a walk with my dog. It's going to be around ten minutes and I'm going in four minutes."));
      const walk=occ(today()).find(x=>x.title==='Walk with my dog');
      return result.undo&&walk?.time==='09:04'&&walk?.dur===10;
    }));
    ok('the same request works when speech recognition omits punctuation',await page.evaluate(()=>{
      const walk=localAssistant("please add for today trip with my dog like a walk with my dog it's going to be around ten minutes and i'm going in four minutes")?.actions[0];
      return walk?.title==='Walk with my dog'&&walk?.time==='09:04'&&walk?.duration===10;
    }));
    ok('relative times also accept figures and a Hebrew request',await page.evaluate(()=>{
      const en=localAssistant('Add a walk for 15 minutes starting in 5 minutes')?.actions[0];
      const he=localAssistant('תוסיף טיול בעוד ארבע דקות למשך עשר דקות')?.actions[0];
      const byTime=localAssistant('Add a walk at 5 PM for twenty minutes')?.actions[0];
      return en?.time==='09:05'&&en?.duration===15&&he?.time==='09:04'&&he?.duration===10&&byTime?.time==='17:00'&&byTime?.duration===20;
    }));
    ok('one local request adds multiple tasks and attaches a note to a task created in the same batch',await page.evaluate(async()=>{
      const plan=localAssistant('Add a walk in four minutes for ten minutes, then lunch at 12:30, then add dentist tomorrow at 6 PM and add note "bring forms" to dentist tomorrow');
      if(plan?.actions.length!==4)return false;
      const before=JSON.stringify(S.items),result=await applyAssistant(plan);
      const dentist=occ(addD(today(),1)).find(x=>x.title==='dentist');
      if(!result.undo||dentist?.review?.[addD(today(),1)]?.note!=='bring forms'||!occ(today()).some(x=>x.title==='lunch'))return false;
      undoAssistant();return JSON.stringify(S.items)===before;
    }));
    ok('spoken reminder phrases support relative time, morning, evening and explicit AM/PM in both languages',await page.evaluate(()=>{
      const cases=[
       ['Can you remind me in ten minutes?','09:10'],
       ['Can you in around one hour?','10:00'],
       ['Can you remind me tomorrow morning to call Mom?','09:00'],
       ['Can you remind me tomorrow evening about my forms?','19:00'],
       ['Can you remind me tomorrow in around 1 p.m. to call Mom?','13:00'],
       ['Can you remind me tomorrow at 1 a.m. to check the oven?','01:00'],
       ['תזכיר לי בעוד עשר דקות להוציא את הכלב','09:10'],
       ['אפשר בעוד כשעה','10:00'],
       ['תזכירי לי מחר בבוקר להתקשר לאמא','09:00'],
       ['תזכיר לי מחר ב־1 בלילה לבדוק משהו','01:00'],
       ['Remind me tomorrow at 1 AM, actually 1 PM','13:00'],
      ];
      return cases.every(([text,time])=>{const a=localAssistant(text)?.actions[0];return a?.kind==='remind'&&a.time===time&&a.repeat==='none'});
    }));
    await page.evaluate(()=>assistantSheet());
    await page.getByRole('button', { name: 'Pause recording' }).click();
    await page.waitForFunction(()=>!document.querySelector('#ask-text').readOnly);
    await send('Can you remind me tomorrow about the forms?');
    await page.locator('#ask-log').getByText(/What time should I remind you/).waitFor();
    await send('Around 1 p.m.');
    ok('a reminder clarification stays in the sheet and saves a one-time alert without moving tasks',await page.evaluate(()=>{
      const date=addD(today(),1),reminder=occ(date).find(x=>x.title==='the forms');
      return reminder?.rem===0&&reminder.time==='13:00'&&reminder.reminderOnly&&
       !occ(addD(date,1)).some(x=>x.id===reminder.id)&&alertsAhead().some(a=>a.tag===reminder.id+date&&a.at===+taskAt(date,13*60))&&!busy(date).some(x=>x[2].id===reminder.id)&&
       !!$('#ask-text')&&!!$('#ask-alerts');
    }));
    ok('explicit recurrence creates only the requested recurrence',await page.evaluate(async()=>{
      const result=await applyAssistant(localAssistant('Remind me every morning to water the plants'));
      const reminder=S.items.find(x=>x.title==='water the plants');
      return result.undo&&reminder?.time==='09:00'&&reminder.rep==='daily'&&hit(reminder,addD(today(),1));
    }));
    ok('the Hebrew dog-walk report logs a completed past activity and leaves existing tasks untouched',await page.evaluate(async()=>{
      const before=JSON.stringify(S.items),date=today();
      const result=await applyAssistant(localAssistant('היה לי טיול עם הכלב שלי של עשר דק לפני ארבעים דק'));
      const walk=occ(date).find(x=>x.title==='טיול עם הכלב שלי');
      if(!result.undo||walk?.time!=='08:20'||walk?.dur!==10||!isDone(walk,date)||walk.rem!==-1)return false;
      if(JSON.stringify(S.items.filter(x=>x.id!==walk.id))!==before)return false;
      undoAssistant();return JSON.stringify(S.items)===before;
    }));
    ok('an English past activity uses its stated duration and an ongoing one is not marked completed',await page.evaluate(()=>{
      const past=localAssistant('I went for a walk with my dog for ten minutes forty minutes ago')?.actions[0];
      const incomplete=localAssistant('היה לי טיול עם הכלב של עשר דקות לפני ארבע דקות');
      return past?.kind==='log'&&past.time==='08:20'&&past.duration===10&&incomplete===null;
    }));
    ok('the assistant flow has no page errors', errors.length===0, errors.join('|'));
  } finally {
    await page.close();
  }
};
