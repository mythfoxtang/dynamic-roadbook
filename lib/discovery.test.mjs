import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDiscovery,normalizeDiscoveryPoi,searchAmap,poiMatchesCity} from './discovery-core.mjs';
import {searchScenicCatalog,auditScenicDays} from './scenic-catalog.mjs';
test('scope is required and paging/coordinates cannot escape bounds',()=>{
 for(const q of [{city:''},{city:'北京',page:9},{city:'北京',center:[NaN,30]},{city:'北京',kind:'hotel'}])assert.throws(()=>validateDiscovery(q));
 assert.equal(validateDiscovery({city:'奉节县',kind:'food'}).radius,5000);
});
test('official geographic evidence remains separate from unverified seeds',()=>{
 const d=searchScenicCatalog({query:'三峡之巅'});assert.equal(d.items[0].city,'奉节县');assert.ok(d.items[0].profile.source.includes('cqfj.gov.cn'));
 assert.equal(searchScenicCatalog({query:'三峡之巅',region:'巫山县'}).total,0);
 const a=auditScenicDays([{date:'2026-12-01',city:'宜昌市',stops:['三峡之巅']}]);assert.equal(a[0].profiles[0].cityConflict,true);
 assert.match(searchScenicCatalog().coverage.scope,/尚未覆盖/);
});
test('catalog pages continue without replacing candidate semantics',()=>{const a=searchScenicCatalog(),b=searchScenicCatalog({page:2});assert.equal(a.items.length,20);assert.equal(a.hasMore,true);assert.ok(!a.items.some(p=>b.items.some(q=>q.id===p.id)));});
test('absent business data stays unknown and invalid coordinates are rejected',()=>{const p=normalizeDiscoveryPoi({id:'1',name:'餐厅',location:'116,39'},'food');assert.equal(p.rating,null);assert.equal(p.cost,null);assert.equal(p.opentime,null);assert.equal(p.durationMinutes,null);assert.equal(normalizeDiscoveryPoi({location:''},'food'),null);});
test('Amap query constrains city and filters unrelated categories, preserves pagination',async()=>{
 let url;const raw=Array.from({length:25},(_,i)=>({id:String(i),name:'餐厅'+i,cityname:'北京市',typecode:i===0?'110000':'050100',location:'116,39',business:{rating:'4.5'}}));
 const data=await searchAmap({city:'北京市',kind:'food',page:2},{key:'test-key',fetchImpl:async u=>{url=new URL(u);return {ok:true,json:async()=>({status:'1',count:'150',pois:raw})};}});
 assert.equal(url.searchParams.get('city_limit'),'true');assert.equal(url.searchParams.get('region'),'北京市');assert.equal(url.searchParams.get('page_num'),'2');assert.equal(data.items.length,24);assert.equal(data.hasMore,true);
});
test('invalid or neighboring administrative scope does not become nationwide results',()=>{assert.equal(poiMatchesCity({cityname:'重庆市',adname:'巫山县'},'奉节县'),false);assert.equal(poiMatchesCity({cityname:'重庆市',adname:'奉节县'},'奉节县'),true);assert.equal(poiMatchesCity({name:'三峡之巅',adname:'奉节县'},'三峡之巅'),false);});
test('upstream failures never become fabricated empty results or leak credentials',async()=>{
 await assert.rejects(searchAmap({city:'北京'},{key:''}),e=>e.code==='AMAP_NOT_CONFIGURED');
 await assert.rejects(searchAmap({city:'北京'},{key:'secret',fetchImpl:async()=>({ok:true,json:async()=>({status:'0',infocode:'10003',info:'secret'})})}),e=>e.code==='AMAP_REJECTED'&&!e.message.includes('secret'));
 await assert.rejects(searchAmap({city:'北京'},{key:'secret',fetchImpl:async()=>{throw new Error('secret');}}),e=>e.code==='AMAP_NETWORK'&&!e.message.includes('secret'));
});
