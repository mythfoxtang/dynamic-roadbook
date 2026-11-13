// Read-only real-model check. Never prints credentials or creates supplier orders.
import fs from 'node:fs';
import {proposeJourney,draftItinerary} from '../lib/journey-draft.mjs';
import {analyzeJourney} from '../lib/travel-agent.mjs';
import {readTravelPrivate} from '../lib/travel-vault.mjs';
const config=readTravelPrivate('ai-sessions',[]).map(([,s])=>s).filter(s=>s.provider==='DeepSeek').at(-1);
if(!config)throw new Error('No saved DeepSeek credential available');
const input='2026年12月上旬想去云南玩5天，从上海出发，2个成人，轻松一些，喜欢自然风光，预算两人合计6000元。先规划，不查价。';
const draft=await proposeJourney({input},config);
fs.writeFileSync('.automation/journey-live-draft.json',JSON.stringify(draft,null,2));
console.log(JSON.stringify({stage:'draft',model:config.model,title:draft.title,days:draft.days.length,ready:draft.ready,questions:draft.questions}));
if(draft.ready){
 const revised=await proposeJourney({input,previousDraft:draft,adjustment:'减少换酒店，只保留一个住宿城市，不去高海拔地区。'},config);
 fs.writeFileSync('.automation/journey-live-revised.json',JSON.stringify(revised,null,2));
 console.log(JSON.stringify({stage:'revised',title:revised.title,days:revised.days.length,ready:revised.ready,questions:revised.questions}));
 if(revised.ready){const plan=await analyzeJourney(draftItinerary(revised),config);fs.writeFileSync('.automation/journey-live-confirmed.json',JSON.stringify(plan,null,2));console.log(JSON.stringify({stage:'confirmed',days:plan.days.length,tasks:plan.tasks.map(t=>({kind:t.kind,title:t.title,query:t.query})),supplierQueries:0,orders:0}));}
}
