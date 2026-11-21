// Browser: create private cloud, automatic backup, restore from cloud, undo copy, stale-sync warning, delete.
const { ok, baseState, openPage } = require('./lib');
module.exports = async b => {
  const st = baseState({ tx: [{ id: 'a', type: 'inc', amt: 100000, ts: Date.now() - 864e5, title: 'pay', cat: 'salary', pay: 'bank', prof: 'pers' }, { id: 'b', type: 'exp', amt: 2500, ts: Date.now() - 36e5, title: 'coffee', cat: 'food', pay: 'card', prof: 'pers' }], jars: [{ id: 'j1', name: 'Trip', goal: 100000, prof: 'pers' }] });
  const p = await openPage(b, { state: st });
  await p.waitForTimeout(1500);
  ok('a fresh phone has no hardcoded sync key', await p.evaluate(() => S.sync.key === ''));
  await p.evaluate(() => joinCloud()); await p.waitForTimeout(1800);
  const key = await p.evaluate(() => S.sync.key);
  ok('private key created', key.length >= 30);
  ok('first backup ran automatically', await p.evaluate(() => S.bk.last > 0 && !S.bk.err));
  const full = await p.evaluate(async () => JSON.stringify(await (await fetch('/api/backup?n=0', { headers: AUTH() })).json()));
  ok('backup holds the data but not the key', full.includes('coffee') && !full.includes(key));
  await p.evaluate(() => { S.tx = []; S.jars = []; sv() });
  await p.evaluate(() => cloudSheet()); await p.waitForTimeout(800);
  ok('restore sheet lists the backup', await p.evaluate(() => /Latest backup/.test(document.body.innerText)));
  await Promise.all([p.waitForNavigation(), p.evaluate(() => cloudRestore(0))]); await p.waitForTimeout(1200);
  ok('restore brings back activity + jars and keeps the login', await p.evaluate(k => S.tx.length === 2 && S.jars.length === 1 && S.sync.key === k, key));
  ok('a pre-restore copy is kept for undo', await p.evaluate(() => !!preRestore()));
  await p.evaluate(() => { S.sync.bank = { bal: 1000, at: Date.now() - 3 * 864e5, name: 'Bank' }; S.sync.useBank = true; sv(); render() }); await p.waitForTimeout(300);
  ok('stale bank sync shows a warning', await p.evaluate(() => /Bank sync is behind/.test(document.body.innerText)));
  await p.evaluate(() => { S.sync.bank.at = Date.now(); render() }); await p.waitForTimeout(300);
  ok('warning disappears when fresh', await p.evaluate(() => !/Bank sync is behind/.test(document.body.innerText)));
  await p.evaluate(() => cloudForget()); await p.waitForTimeout(800);
  ok('delete cloud data clears the key', await p.evaluate(() => S.sync.key === ''));
  ok('no JS errors', p.errs.length === 0, p.errs.join('|'));
};
