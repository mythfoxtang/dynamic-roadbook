import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeJourney} from './travel-agent.mjs';
const config={provider:'DeepSeek',model:'deepseek-flash',baseUrl:'https://api.deepseek.com',apiKey:'fixture-only'};
const hotel={kind:'hotel',title:'昆明住宿',query:{city:'昆明',startDate:'2099-12-01',endDate:'2099-12-02'},checks:[]};
const plan={title:'昆明两天',days:[{date:'2099-12-01',city:'昆明',activity:'当地游览'},{date:'2099-12-02',city:'昆明',activity:'自由活动'}],tasks:[hotel],assumptions:[],warnings:['出发地未提供，仅查当地住宿']};
test('invalid city is repaired once before any supplier request',async()=>{
 let calls=0;
 const result=await analyzeJourney('昆明两天，未提供出发地',config,{fetchImpl:async(u,o)=>{calls++;assert.match(u,/chat\/completions$/);const messages=JSON.parse(o.body).messages;assert.match(messages[0].content,/不要猜出发城市/);if(calls===2)assert.match(JSON.parse(messages[1].content).validationError,/出发城市/);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(calls===1?{...plan,tasks:[hotel,{kind:'flight',title:'返程',query:{from:'',to:'上海',date:'2099-12-02'},checks:[]}]}:plan)}}]})};}});
 assert.equal(calls,2);assert.equal(result.tasks.length,1);assert.equal(result.tasks[0].kind,'hotel');
});
test('repeated invalid conversion returns actionable error and stops after two calls',async()=>{
 let calls=0;await assert.rejects(analyzeJourney('昆明两天',config,{fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({...plan,tasks:[]})}}]})};}}),/草案已保留/);assert.equal(calls,2);
});
