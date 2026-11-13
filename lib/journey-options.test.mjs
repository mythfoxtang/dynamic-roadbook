import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proposeJourney} from './journey-draft.mjs';
const config={provider:'DeepSeek',model:'deepseek-flash',baseUrl:'https://api.deepseek.com',apiKey:'fixture-only'};
const option=n=>({title:n,summary:n,days:[{date:'2099-12-01',city:'大理',activity:n}],seasonality:[{place:'苍山',bestTime:'春秋',fit:'冬季需核实积雪',alternative:'古城'}]});
test('initial planning offers two selectable routes with seasonal guidance; revision keeps selected route',async()=>{
 let calls=0;
 const fetchImpl=async(u,o)=>{calls++;const messages=JSON.parse(o.body).messages;assert.match(messages[0].content,/seasonality/);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(calls===1?{options:[option('慢游'),option('风光')]}:option('风光'))}}]})};};
 const result=await proposeJourney({input:'云南12月一日'},config,{fetchImpl});
 assert.equal(result.options.length,2);assert.equal(result.ready,false);assert.equal(result.selectionRequired,true);
 const revised=await proposeJourney({input:'云南12月一日',previousDraft:result.options[1],adjustment:'少换酒店'},config,{fetchImpl});
 assert.equal(revised.title,'风光');assert.equal(revised.ready,true);assert.equal(revised.seasonality[0].place,'苍山');
});
