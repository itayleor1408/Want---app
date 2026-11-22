// Wishlist: the tab is there, products can be added, links are read by the server, and products shared from Safari arrive.
const { ok, baseState, openPage } = require('./lib');
module.exports = async b => {
  const own = { key: 'test-key-123456', bank: null, card: null, useBank: false, last: 0, err: '' };
  const p = await openPage(b, { state: baseState({ sync: own, wish: [{ id: 'w1', name: 'Desk lamp', price: 15000, prof: 'pers', st: 'want' }] }) }); await p.waitForTimeout(2500);
  ok('the Wishlist tab is in the bottom bar', await p.evaluate(() => [...document.querySelectorAll('nav button, nav a')].some(x => /Wishlist/.test(x.innerText))));
  await p.evaluate(() => go('wish')); await p.waitForTimeout(700);
  ok('the Wishlist screen shows the saved product', await p.evaluate(() => /Desk lamp/.test(document.body.innerText)));
  await p.evaluate(() => wishAdd()); await p.waitForTimeout(600);
  ok('"Add product" opens', await p.evaluate(() => !!document.getElementById('sh')));
  await p.evaluate(() => { close() }); await p.waitForTimeout(500);
  await p.evaluate(() => settings()); await p.waitForTimeout(700);
  ok('Settings still has no Wishlist group or import-URL field', await p.evaluate(() => { const t = [...document.querySelectorAll('#sh .gl,#sh .gt')].map(e => e.innerText).join('|'); return !/wishlist/i.test(t) && !/import service/i.test(t) && !/add from safari/i.test(t) }));
  // the server reads a product link
  const r = await p.evaluate(async () => (await (await fetch('/api/product?u=' + encodeURIComponent('https://www.shop.com/lamp'))).json()));
  ok('product link reader returns title and price', /Desk Lamp/.test(r.title) && String(r.price) === '40', JSON.stringify(r));
  // a product shared from Safari waits for the app
  await p.evaluate(async () => { await fetch('/api/wish', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, AUTH()), body: JSON.stringify({ page: { title: 'Shared chair', price: '₪99', url: 'https://www.shop.com/chair' } }) }) });
  await p.evaluate(() => syncNow(true)); await p.waitForTimeout(1500);
  ok('the shared product reaches the app', await p.evaluate(() => (S.pendWish || []).length + ((document.getElementById('sh') || {}).innerText || '').split('Shared chair').length - 1 > 0 || /Shared chair/.test(document.body.innerText)));
  ok('no JS errors', !p.errs.length, p.errs.join('|'));
};
