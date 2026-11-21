// Runs every tests/*.test.js against the local mock server (serve.mjs). Usage: npm test
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const { chromium, take } = require('./lib');
(async () => {
  const srv = spawn('node', ['serve.mjs'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await fetch('http://localhost:8787/version'); break } catch (e) { await new Promise(r => setTimeout(r, 250)) } }
  const b = await chromium.launch(); let fail = 0, total = 0;
  const only = process.argv[2];
  for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!only || f.includes(only))).sort()) {
    console.log('\n' + f);
    try { await require('./' + f)(b) } catch (e) { fail++; total++; console.log('  FAIL  crashed: ' + e.message) }
    for (const r of take()) { total++; if (!r.pass) fail++; console.log('  ' + (r.pass ? 'pass  ' : 'FAIL  ') + r.name + (r.pass || !r.extra ? '' : '  → ' + r.extra)) }
  }
  await b.close(); srv.kill();
  console.log(`\n${total - fail}/${total} passed`); process.exit(fail ? 1 : 0);
})();
