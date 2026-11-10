import {test} from 'node:test';
import assert from 'node:assert/strict';
import {converseJourney,validateDialogueActions,validateAgentFilters,sanitizeConversation} from './travel-agent-dialogue.mjs';
import {validateAgentPlan} from './travel-agent.mjs';
import {quarantineLocationResults} from './travel-locations.mjs';
import {expandAgentTask} from './travel-agent-tools.mjs';
import {travelSourceCatalog} from './travel-source-catalog.mjs';
const date=offset=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
const fixture=()=>validateAgentPlan({title:'灵活行程',days:[{date:date(1),city:'宜昌',activity:'抵达'},{date:date(2),city:'上海',activity:'返回'}],tasks:[{kind:'flight',title:'上海到宜昌',query:{from:'上海',to:'宜昌',date:date(1),adults:1}},{kind:'hotel',title:'宜昌住宿',query:{city:'宜昌',startDate:date(1),endDate:date(2),adults:1,rooms:1}}],assumptions:[],warnings:[]});
test('chat operations preserve task identity, support rail alternatives, and refuse unlisted operations',()=>{
 const p=fixture(),result=validateDialogueActions([{type:'add',task:{kind:'train',title:'高铁备选',alternativeTo:'task-1',query:{from:'上海',to:'宜昌',date:date(1),adults:1,mode:'3'}}}],p);
 assert.equal(result.plan.tasks[2].id,'task-3');assert.equal(result.plan.tasks[2].kind,'train');assert.equal(result.plan.tasks[0].query.from,'上海');assert.equal(p.tasks.length,2);
 assert.throws(()=>validateDialogueActions([{type:'book',taskId:'task-1'}],p),/不支持/);
 assert.throws(()=>validateDialogueActions([{type:'more',taskId:'unknown'}],p),/不存在/);
 assert.throws(()=>validateDialogueActions([{type:'more',taskId:'task-1',pages:20}],p),/1至2页/);
});
test('transport alternatives cannot silently change route/date and a hotel alternative may share its original night',()=>{
 const p=fixture();assert.throws(()=>validateDialogueActions([{type:'add',task:{kind:'train',title:'错误备选',alternativeTo:'task-1',query:{from:'北京',to:'宜昌',date:date(1),adults:1}}}],p),/起终城市/);
 const r=validateDialogueActions([{type:'add',task:{...p.tasks[1],title:'住宿备选',alternativeTo:'task-2'}}],p);assert.equal(r.plan.tasks.length,3);
});
test('verified geography quarantines wrong-city inventory without rewriting the itinerary',()=>{
 const p=fixture();p.tasks[1].title='三峡之巅附近住宿';p.tasks[1].query.poi='三峡之巅';
 const audited=validateAgentPlan(p);assert.equal(audited.tasks[1].locationConflict.expectedCity,'奉节县');assert.equal(audited.tasks[1].query.city,'宜昌');
 const result=quarantineLocationResults(audited,{'task-2':{source:'live',offers:[{id:'wrong-place'}]}});assert.equal(result['task-2'].offers.length,0);assert.equal(result['task-2'].state,'blocked');
 const corrected=validateDialogueActions([{type:'search',taskId:'task-2',query:{city:'奉节县'}}],audited);assert.equal(corrected.plan.tasks[1].locationConflict,undefined);
 assert.ok(!corrected.plan.warnings.some(w=>w.includes('当前城市“宜昌”')));
});
test('filter values and persisted conversation are bounded; actual offer IDs remain data',()=>{
 assert.deepEqual(validateAgentFilters({parking:true,maxPrice:250,unknown:'ignored'}),{parking:true,maxPrice:250});assert.throws(()=>validateAgentFilters({parking:'yes'}));assert.throws(()=>validateAgentFilters({maxPrice:-1}));assert.throws(()=>validateAgentFilters(null));
 assert.deepEqual(sanitizeConversation([{role:'system',content:'bad'},{role:'user',content:'继续找'}]).map(m=>m.role),['user']);
});
test('pagination restores an expired search and waits through quotas without creating orders',async()=>{
 const calls=[],waits=[];let next=0;
 const result=await expandAgentTask({task:fixture().tasks[1],result:{id:'old',loadedPages:1,totalPages:3},pages:2,wait:async ms=>waits.push(ms),request:async body=>{
  calls.push(body);if(body.action==='search')return {data:{id:'new',loadedPages:1,totalPages:3,offers:[]}};
  if(body.searchId==='old')throw Object.assign(new Error('gone'),{status:404,code:'SEARCH_NOT_FOUND'});
  if(next++===0)throw Object.assign(new Error('quota'),{status:429,code:'MINUTE_QUOTA',retryAfter:2});
  return {data:{id:'new',loadedPages:3,totalPages:3,offers:[{id:'actual'}]}};
 }});assert.equal(result.loadedPages,3);assert.deepEqual(waits,[2000]);assert.ok(calls.every(c=>['search','next'].includes(c.action)));
});
test('DeepSeek receives actual selection, partial coverage and conversation and supplies the next actions',async()=>{
 const plan={...fixture(),input:'确定行程'},config={provider:'DeepSeek',model:'deepseek-flash',baseUrl:'https://api.deepseek.com',apiKey:'test-only'};
 const r=await converseJourney({plan,message:'多给我酒店',messages:[{role:'user',content:'上一轮偏好'}],choices:{'task-1':{offer:{name:'已选航班'}}},results:{'task-2':{loadedPages:1,totalPages:3,source:'live',offers:[{id:'real',name:'真实来源候选',price:null}]}}},config,{fetchImpl:async(url,options)=>{
  const payload=JSON.parse(JSON.parse(options.body).messages[1].content);assert.equal(payload.tasks[0].selected.name,'已选航班');assert.equal(payload.tasks[1].inventory.totalPages,3);assert.equal(payload.tasks[1].inventory.offers[0].price,null);assert.equal(payload.history[0].content,'上一轮偏好');
  return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({reply:'我来继续读取下一页，保留你的选择。',actions:[{type:'more',taskId:'task-2',pages:1}]})}}]})};
 }});assert.equal(r.actions[0].type,'more');assert.equal(r.model,'deepseek-flash');
});
test('source catalog distinguishes configured rail, missing rental authorization and missing tickets',()=>{
 const catalog=travelSourceCatalog({TUNIU_API_KEY:'configured-key'});assert.equal(catalog.find(s=>s.kind==='train').state,'configured');assert.equal(catalog.find(s=>s.kind==='car').state,'needs_auth');assert.equal(catalog.find(s=>s.kind==='attraction').state,'not_connected');assert.ok(!JSON.stringify(catalog).includes('configured-key'));
});
