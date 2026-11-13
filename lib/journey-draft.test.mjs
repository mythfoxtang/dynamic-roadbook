import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateJourneyDraft,proposeJourney,draftItinerary} from './journey-draft.mjs';
const fixture=()=>({title:'云南五天',summary:'大理慢游',days:[{date:'2099-12-01',city:'大理市',activity:'抵达后休息',transport:'当地接驳，耗时需核实',stay:'大理古城周边'}],questions:[],assumptions:['未提供出发地，仅安排当地行程'],warnings:['营业与预约待核实']});
const config={provider:'DeepSeek',model:'deepseek-flash',baseUrl:'https://api.deepseek.com',apiKey:'fixture-only'};
test('fixed itinerary mode explicitly preserves supplied route and dates during discussion',async()=>{
  const d=await proposeJourney({input:'已有完整路线',mode:'fixed'},config,{fetchImpl:async(url,options)=>{
    const messages=JSON.parse(options.body).messages;assert.match(messages[0].content,/不主动重设计路线/);assert.equal(JSON.parse(messages[1].content).mode,'fixed');
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(fixture())}}]})};
  }});assert.equal(d.ready,true);
});
test('destination-only requests ask questions and cannot be confirmed',()=>{
  const draft=validateJourneyDraft({questions:['什么时候出发？']});assert.equal(draft.ready,false);assert.throws(()=>draftItinerary(draft),/先回答/);
});
test('invalid and discontinuous dates fail, unanswered questions block confirmation',()=>{
  for(const date of ['2020-01-01','2099-02-30','invalid']){const d=fixture();d.days[0].date=date;assert.throws(()=>validateJourneyDraft(d),/日期/);}
  const d=fixture();d.days.push({...d.days[0],date:'2099-12-03'});assert.throws(()=>validateJourneyDraft(d),/日期/);
  const q=fixture();q.questions=['需要几天？'];assert.throws(()=>draftItinerary(q),/先回答/);
});
test('draft ignores injected ready flag and serializes reviewed route only',()=>{
  const d=fixture();d.ready=false;assert.equal(validateJourneyDraft(d).ready,true);assert.match(draftItinerary(d),/2099-12-01 大理市/);
  assert.throws(()=>validateJourneyDraft({ready:true}),/未产生/);
});
test('planning and revision call only model, pass prior constraints, never suppliers',async()=>{
  let calls=0;
  const d=await proposeJourney({input:'云南12月初5天',previousDraft:fixture(),adjustment:'少换酒店'},config,{fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'https://api.deepseek.com/chat/completions');const p=JSON.parse(JSON.parse(options.body).messages[1].content);assert.equal(p.adjustment,'少换酒店');assert.equal(p.previousDraft.title,'云南五天');
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(fixture())}}]})};
  }});assert.equal(calls,1);assert.equal(d.ready,true);
});
