// Data-integrity fuzz: many random (seeded) wallets. The money model must stay finite, split cleanly across profiles,
// and every screen must render without NaN / undefined / [object Object].
const { ok, baseState, openPage } = require('./lib');
const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
function wallet(seed) {
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)], now = new Date('2026-11-20T10:00').getTime();
  const jars = [{ id: 'jp', name: 'P', goal: 100000, prof: 'pers' }, { id: 'jw', name: 'W', goal: 0, prof: 'work' }, { id: 'jb', name: 'B', goal: 50000, prof: 'both' }, { id: 'jn', name: 'N', prof: 'pers' }];
  const tx = [];
  for (let i = 0; i < 300; i++) {
    const prof = pick(['pers', 'work']), type = pick(['inc', 'exp', 'exp', 'exp', 'dep', 'wd', 'buy']), ts = now - Math.floor(r() * 120) * 864e5, amt = 100 + Math.floor(r() * 90000);
    const o = { id: 't' + i, type, amt, ts, prof, title: pick(['Aroma', 'NETFLIX.COM  NL', 'salary', 'Shufersal', '', 'x']), cat: pick(['food', 'subs', 'none', 'salary', 'refund']), pay: pick(['card', 'bank', 'none']) };
    if (type == 'dep' || type == 'wd' || type == 'buy') { const j = pick(jars.filter(j => j.prof == prof || j.prof == 'both')); o.jar = j.id }
    tx.push(o);
  }
  return baseState({ cash0: Math.floor(r() * 500000), tx: tx.sort((a, b) => b.ts - a.ts), jars, profFix: { pers: 0, work: 0 }, upcOn: true, wish: [{ id: 'w1', name: 'Lamp', price: 4000, prof: 'pers', st: 'want' }] });
}
module.exports = async b => {
  const seeds = 12, bad = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const p = await openPage(b, { state: wallet(seed), date: '2026-11-20T10:00' }); await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const out = { errs: [], txt: [] }, view = pr => { S.prof = pr; return C() }, res = {};
      for (const pr of ['all', 'pers', 'work']) res[pr] = view(pr);
      const fin = o => Object.values(o).every(v => typeof v == 'object' ? Object.values(v).every(Number.isFinite) : Number.isFinite(v));
      out.finite = ['all', 'pers', 'work'].every(pr => fin(res[pr]));
      const cash0 = S.cash0;
      out.cashSplit = res.pers.cash + res.work.cash - cash0 === res.all.cash;
      out.savedSplit = res.pers.saved + res.work.saved === res.all.saved;
      out.free = ['all', 'pers', 'work'].every(pr => res[pr].un === res[pr].cash - res[pr].saved);
      for (const pr of ['all', 'pers', 'work']) for (const rt of ['home', 'jars', 'act']) { S.prof = pr; try { go(rt); render() } catch (e) { out.errs.push(pr + '/' + rt + ': ' + e.message) } const t = document.body.innerText; if (/NaN|undefined|\[object/.test(t)) out.txt.push(pr + '/' + rt + ': ' + (t.match(/.{0,25}(NaN|undefined|\[object).{0,25}/) || [''])[0].replace(/\n/g, ' ')) }
      return out;
    });
    if (!r.finite) bad.push('seed ' + seed + ': non-finite number in C()');
    if (!r.cashSplit) bad.push('seed ' + seed + ': cash does not split across profiles');
    if (!r.savedSplit) bad.push('seed ' + seed + ': saved does not split across profiles');
    if (!r.free) bad.push('seed ' + seed + ': free ≠ cash − saved');
    r.errs.forEach(e => bad.push('seed ' + seed + ': ' + e)); r.txt.forEach(e => bad.push('seed ' + seed + ': ' + e)); p.errs.forEach(e => bad.push('seed ' + seed + ' page error: ' + e));
    await p.context().close();
  }
  ok(`${seeds} random wallets × 3 profiles × 3 screens: totals finite, split cleanly, nothing renders NaN/undefined`, !bad.length, bad.slice(0, 5).join(' ; '));
};
