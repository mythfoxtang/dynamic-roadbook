import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeJourney,validateAgentPlan,validateRecommendations,recommendJourney} from './travel-agent.mjs';
const config={provider:'DeepSeek',model:'deepseek-flash',baseUrl:'https://api.deepseek.com',apiKey:'fake-test-only'};
const fixture=()=>({title:'杭州周末',days:[{date:'2099-11-16',city:'杭州',activity:'抵达杭州'},{date:'2099-11-17',city:'上海',activity:'回家'}],tasks:[{kind:'flight',title:'去杭州',reason:'出行',query:{from:'北京',to:'杭州',date:'2099-11-16',adults:1}},{kind:'hotel',title:'杭州住宿',query:{city:'杭州',startDate:'2099-11-16',endDate:'2099-11-17',adults:1,rooms:1}}],assumptions:['1成人仅供查价'],warnings:[]});
test('future railway task does not block confirmation or unrelated hotel tasks',()=>{
  const raw=fixture();raw.tasks[0].kind='train';raw.tasks[0].query.mode='3';
  const plan=validateAgentPlan(raw);assert.equal(plan.tasks[0].kind,'train');assert.equal(plan.tasks[1].kind,'hotel');assert.ok(plan.warnings.some(w=>w.includes('预售期')));
});
test('the model supplies the itinerary; runtime contains no expected example output',async()=>{
  let sent;
  const result=await analyzeJourney('从北京去杭州住一晚',config,{fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.deepseek.com/chat/completions');sent=JSON.parse(options.body);assert.equal(sent.model,config.model);
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(fixture())},finish_reason:'stop'}]})};
  }});
  assert.equal(result.tasks[0].query.to,'杭州');assert.equal(result.analysis.model,config.model);assert.ok(sent.messages[1].content.includes('从北京去杭州'));
});
test('other models and missing DeepSeek never fall back to hand-coded plans',async()=>{
  await assert.rejects(analyzeJourney('行程',null),/需要 DeepSeek/);
  await assert.rejects(analyzeJourney('行程',{provider:'DashScope',model:'qwen-plus'}),/需要 DeepSeek/);
});
test('bad JSON, clipped responses and model errors remain explicit',async()=>{
  await assert.rejects(analyzeJourney('行程',config,{fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'not json'}}]})})}),/有效 JSON/);
  await assert.rejects(analyzeJourney('行程',config,{fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length'}]})})}),/未完成/);
  await assert.rejects(analyzeJourney('行程',config,{fetchImpl:async()=>({ok:false,status:402})}),/余额不足/);
});
test('calendar validation rejects missing dates, overlapping nights, unsupported tools and out-of-trip tasks',()=>{
  let p=fixture();p.days[1].date='2099-11-18';assert.throws(()=>validateAgentPlan(p),/连续/);
  p=fixture();p.tasks.push({...p.tasks[1]});assert.throws(()=>validateAgentPlan(p),/住宿重复/);
  p=fixture();p.tasks[0].kind='shell';assert.throws(()=>validateAgentPlan(p),/任务类型/);
  p=fixture();p.tasks[0].query.date='2099-11-18';assert.throws(()=>validateAgentPlan(p),/超出/);
  p=fixture();p.tasks.splice(1);assert.match(validateAgentPlan(p).warnings[0],/未安排住宿/);
});
test('unknown price remains unlimited and IDs are generated independently of model text',()=>{
  const p=validateAgentPlan(fixture());assert.equal(p.tasks[1].query.maxPrice,null);assert.equal(p.tasks[0].id,'task-1');
});
test('recommendations may only reference supplied task and offer IDs',()=>{
  const tasks=[{id:'task-1',offers:[{id:'real-1'}]}];
  assert.throws(()=>validateRecommendations({recommendations:[{taskId:'task-1',offerIds:['invented']}]},tasks),/不存在/);
  assert.throws(()=>validateRecommendations({recommendations:[{taskId:'unknown',offerIds:[]}]},tasks),/未知任务/);
  assert.throws(()=>validateRecommendations({recommendations:[{taskId:'task-1',offerIds:['real-1','real-1']}]},tasks),/不存在/);
  assert.deepEqual(validateRecommendations({recommendations:[{taskId:'task-1',offerIds:['real-1'],reason:'实际候选'}]},tasks)[0].offerIds,['real-1']);
});
test('second model pass sees actual supplier facts and gaps, never invents offers',async()=>{
  const plan={...validateAgentPlan(fixture()),input:'杭州一晚'};
  const result=await recommendJourney(plan,{'task-1':{id:'supplier-search-id',source:'live',offers:[{id:'actual',name:'实际航班',price:null}]},'task-2':{offers:[],notice:'接口没有库存'}},config,{fetchImpl:async(url,options)=>{
    const payload=JSON.parse(JSON.parse(options.body).messages[1].content);assert.equal(payload.tasks[0].id,'task-1');assert.equal(payload.tasks[0].offers[0].price,null);assert.equal(payload.tasks[1].notice,'接口没有库存');
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({recommendations:[{taskId:'task-1',offerIds:['actual'],reason:'价格仍待核实'},{taskId:'task-2',offerIds:[],reason:'暂无数据'}]})}}]})};
  }});assert.equal(result.recommendations.length,2);
});
