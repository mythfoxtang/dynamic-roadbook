import {test} from 'node:test';
import assert from 'node:assert/strict';
import {journeyWeather,clothingFor} from './journey-weather.mjs';
test('forecast and historical reference use separate sources and retain missing-data gaps',async()=>{
 const now=Date.parse('2026-11-11T04:00:00Z'),calls=[];
 const fetchImpl=async url=>{calls.push(url);return {ok:true,json:async()=>url.includes('geocoding-')?{results:[{name:'昆明',country_code:'CN',feature_code:'PPLA',latitude:25,longitude:102}]}:url.includes('archive-')?{daily:{temperature_2m_min:Array(31).fill(5),temperature_2m_max:Array(31).fill(18)}}:{daily:{time:['2026-11-12','2026-11-13'],temperature_2m_min:[8,null],temperature_2m_max:[20,null],precipitation_probability_max:[70,null]}}};};
 const r=await journeyWeather([{city:'昆明市',date:'2026-11-12'},{city:'昆明市',date:'2026-11-13'},{city:'昆明市',date:'2026-12-01'}],{fetchImpl,now});
 assert.equal(r.rows[0].type,'forecast');assert.equal(r.rows[0].min,8);assert.match(r.rows[0].advice.join(''),/雨具/);
 assert.equal(r.rows[1].type,'unavailable');assert.equal(r.rows[2].type,'historical');assert.equal(r.rows[2].min,5);assert.match(r.rows[2].notice,/不是本次行程预报/);assert.equal(calls.length,3);
 assert.match(clothingFor({min:-3,max:12}).join(''),/防滑/);
});
test('invalid dates are rejected before external lookup',async()=>{await assert.rejects(journeyWeather([{city:'昆明',date:'2026-02-30'}]),/无效/);});
