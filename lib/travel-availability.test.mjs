import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deferredRailwayTask} from './travel-availability.mjs';
import {expandAgentTask} from './travel-agent-tools.mjs';
const now=Date.parse('2026-11-10T16:30:00Z'); // Beijing Nov 11.
test('railway presale boundary is inclusive and uses Beijing date',()=>{
  assert.equal(deferredRailwayTask({kind:'train',query:{date:'2026-11-25'}},now),null);
  const result=deferredRailwayTask({kind:'train',query:{date:'2026-11-26'}},now);assert.equal(result.availableFrom,'2026-11-12');assert.deepEqual(result.offers,[]);assert.equal(result.source,'deferred');
  assert.equal(deferredRailwayTask({kind:'hotel',query:{date:'2099-12-01'}},now),null);
});
test('asking for more future train offers does not make a supplier request',async()=>{
  let requests=0;const result=await expandAgentTask({task:{kind:'train',query:{date:'2099-12-01'}},request:async()=>{requests++;throw new Error('must not query before presale');}});
  assert.equal(result.state,'deferred');assert.equal(requests,0);
});
