import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveAgentSelection} from './travel-agent-selection.mjs';
const task={id:'task-1',kind:'hotel',query:{city:'宜昌',startDate:'2099-11-16',endDate:'2099-11-17'}};
const offer={id:'old-offer',supplierId:'same-hotel'};
const gone=()=>Object.assign(new Error('session gone'),{status:404,code:'SEARCH_NOT_FOUND'});
const limited=()=>Object.assign(new Error('limited'),{status:429,code:'MINUTE_QUOTA',retryAfter:3});
test('a read-only detail request reconnects automatically after a transient service interruption',async()=>{
 let calls=0;const waits=[];
 const result=await resolveAgentSelection({task,offer,search:{id:'search'},wait:async ms=>waits.push(ms),request:async()=>{if(++calls===1)throw new TypeError('Failed to fetch');return {data:{options:[{id:'room'}]}};}});
 assert.equal(result.data.options[0].id,'room');assert.deepEqual(waits,[2000]);
});
test('a restored selection automatically searches again, waits through search and detail quotas, and returns current options',async()=>{
 const calls=[],waits=[],updates=[];let searches=0,details=0;
 const result=await resolveAgentSelection({task,offer,search:{id:'old-search'},signal:new AbortController().signal,wait:async ms=>waits.push(ms),onSearch:s=>updates.push(s),request:async body=>{
  calls.push(body);if(body.action==='detail'&&body.searchId==='old-search')throw gone();
  if(body.action==='search'){if(++searches===1)throw limited();return {data:{id:'new-search',offers:[{id:'new-offer',supplierId:'same-hotel'}]}};}
  if(++details===1)throw limited();return {data:{options:[{id:'actual-room',price:250}]}};
 }});
 assert.equal(result.offer.id,'new-offer');assert.equal(result.data.options[0].id,'actual-room');assert.deepEqual(waits,[3000,3000]);assert.equal(updates.length,1);
 assert.ok(calls.every(c=>['search','detail'].includes(c.action)));assert.equal(calls.find(c=>c.action==='search').city,'宜昌');
});
test('no matching supplier identity cannot silently choose another hotel',async()=>{
 let updated=false;
 await assert.rejects(resolveAgentSelection({task,offer,search:{id:'old-search'},wait:async()=>{},onSearch:()=>updated=true,request:async body=>{if(body.action==='detail')throw gone();return {data:{id:'new-search',offers:[{id:'other',supplierId:'other-hotel'}]}};}}),/重新选择/);
 assert.ok(updated);
});
test('daily quotas and aborted requests are never retried',async()=>{
 let calls=0;await assert.rejects(resolveAgentSelection({task,offer,search:{id:'search'},wait:async()=>assert.fail('must not wait'),request:async()=>{calls++;throw Object.assign(new Error('daily'),{status:429,code:'DAILY_QUOTA'});}}),/daily/);assert.equal(calls,1);
 const abort=new AbortController();abort.abort();await assert.rejects(resolveAgentSelection({task,offer,search:{id:'search'},signal:abort.signal,wait:async()=>assert.fail('must not wait'),request:async()=>{throw limited();}}),/limited/);
});
