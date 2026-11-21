// First screen + email codes + owner-only bank features. (Email sending is mocked: serve.mjs records mails at /__mail.)
const { ok, baseState, openPage } = require('./lib');
const mails = async () => (await fetch('http://localhost:8787/__mail')).json();
const lastCode = async () => { const m = (await mails()).pop(); return m && (m.subject.match(/(\d{6})/) || [])[1] };
module.exports = async b => {
  // 1. sister opens the app for the first time
  let p = await openPage(b, {}); await p.waitForTimeout(1500);
  ok('first screen is sign-in (before onboarding)', await p.evaluate(() => /Sign in to start/.test(document.body.innerText) && !!document.getElementById('em') && !/Get started/.test(document.body.innerText)));
  await p.fill('#em', 'sister@example.com'); await p.click('text=Send me a code'); await p.waitForTimeout(900);
  ok('asks for the 6-digit code', await p.evaluate(() => /6-digit code/.test(document.body.innerText) && !!document.getElementById('ec')));
  await p.fill('#ec', '000000'); await p.waitForTimeout(900);
  ok('wrong code is refused, stays on the screen', await p.evaluate(() => /Wrong code/.test(document.body.innerText) && !!document.getElementById('ec')));
  const code = await lastCode(); ok('the code arrived by email to her address', /^\d{6}$/.test(code));
  await p.fill('#ec', code); await p.waitForTimeout(2200);
  ok('signed in with her email, onboarding follows', await p.evaluate(() => S.sync.email === 'sister@example.com' && S.sync.key.length >= 30 && /Get started|Open Brim|How much money/.test(document.body.innerText)));
  await p.evaluate(() => { S.ob = 1; sv(); render(); settings() }); await p.waitForTimeout(900);
  ok('sister is not the owner: no bank rows', await p.evaluate(() => S.sync.owner === false && !/Sync bank now/.test(document.body.innerText)));
  ok('settings shows signed in with email', await p.evaluate(() => /Signed in with email/.test(document.body.innerText)));
  ok('bank sync is refused for her on the server', await p.evaluate(async () => (await fetch('/api/bank', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, AUTH()), body: '{"balance":1}' })).status === 403));
  // 2. the owner: has the original key, gets asked once to connect an email
  const st = baseState({ sync: { key: 'test-key-123456', bank: null, card: null, useBank: false, last: 0, err: '' }, tx: [{ id: 'a', type: 'inc', amt: 100000, ts: Date.now() - 864e5, title: 'pay', cat: 'salary', pay: 'bank', prof: 'pers' }] });
  const o = await openPage(b, { state: st }); await o.waitForTimeout(3200);
  ok('owner is recognised by the server', await o.evaluate(() => S.sync.owner === true));
  ok('owner is asked to connect an account', await o.evaluate(() => /Connect your account/.test(document.body.innerText) && !!document.getElementById('em')));
  await o.fill('#em', 'Me@Example.com'); await o.click('text=Send me a code'); await o.waitForTimeout(900);
  await o.fill('#ec', await lastCode()); await o.waitForTimeout(2500);
  ok('owner email is remembered (linked to the original data)', await o.evaluate(() => S.sync.email === 'me@example.com' && S.sync.key === 'test-key-123456'));
  ok('owner still sees bank features', await o.evaluate(() => { settings(); return true }) && (await o.waitForTimeout(600), await o.evaluate(() => /Sync bank now/.test(document.body.innerText))));
  // 3. owner signs in on a NEW phone with the same email -> gets the owner account (bank features)
  await fetch('http://localhost:8787/__kvclear?prefix=ecd:'); // lift the one-code-a-minute wait (test only)
  const n = await openPage(b, {}); await n.waitForTimeout(1500);
  await n.fill('#em', 'me@example.com'); await n.click('text=Send me a code'); await n.waitForTimeout(900);
  await n.fill('#ec', await lastCode()); await n.waitForTimeout(2800);
  ok('new phone with the owner email gets the owner account', await n.evaluate(() => S.sync.owner === true));
  ok('no JS errors', !p.errs.length && !o.errs.length && !n.errs.length, [...p.errs, ...o.errs, ...n.errs].join('|'));
};
