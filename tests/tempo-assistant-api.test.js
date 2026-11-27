const { ok } = require('./lib');
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const source = fs.readFileSync(path.join(__dirname, '../tempo_api.js'), 'utf8');
  const run = new Function('resolve', source + '\nreturn tempoAssistant;')(
    async request => request.headers.get('authorization') === 'Bearer private-test' ? { pfx: 'test' } : null
  );
  let calls = 0;
  const AI = { async run(model, input) {
    calls++;
    if (!model.startsWith('@cf/') || !input.messages[0].content.includes('latest correction')) throw Error('bad model request');
    return { choices: [{ message: { content: '{"question":"Which gym visit?"}' } }] };
  } };
  const request = (token, text=JSON.stringify({ today: '2026-11-27', turns: [{ role: 'user', text: 'move gym' }], tasks: [] })) =>
    new Request('https://example.test/api/tempo/assistant', { method: 'POST', headers: { authorization: 'Bearer '+token }, body: text });
  ok('cloud inference is disabled without the free-plan flag', (await run(request('private-test'), { AI })).status===503&&calls===0);
  const env = { AI, TEMPO_AI_FREE: '1' };
  ok('cloud inference rejects an invalid private key without using model quota', (await run(request('wrong'), env)).status===401&&calls===0);
  ok('cloud inference bounds the size of user context before inference', (await run(request('private-test','x'.repeat(12001)),env)).status===413&&calls===0);
  const result=await run(request('private-test'),env);
  ok('cloud inference returns a structured clarification when authenticated', result.ok&&calls===1&&(await result.json()).plan.question==='Which gym visit?');
};
