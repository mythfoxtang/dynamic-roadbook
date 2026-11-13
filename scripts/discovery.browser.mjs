// Fixture itinerary; live local API/catalog and live Amap browser search. No AI or booking calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const base=process.argv[2]||'http://localhost:3018';
const browser=await chromium.launch({channel:'msedge',headless:true});
const draft={title:'景区推荐验证',summary:'仅验证发现功能',input:'奉节恩施',ready:true,questions:[],assumptions:[],warnings:[],days:[{date:'2026-12-01',city:'奉节县',activity:'三峡之巅游览',transport:'自驾',stay:'奉节',stops:['三峡之巅']},{date:'2026-12-02',city:'恩施市',activity:'恩施大峡谷游览',transport:'自驾',stay:'恩施',stops:['恩施大峡谷']}]};
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(d=>{localStorage.setItem('roadbook-agent-mode','idea');localStorage.setItem('roadbook-journey-draft-v1',JSON.stringify({input:d.input,draft:d}));},draft);
 await page.route('**/api/travel-agent/',r=>r.fulfill({json:{state:null,sources:[]}}));
 await page.goto(base+'/agent/',{timeout:90000});await page.waitForLoadState('networkidle',{timeout:20000}).catch(()=>{});
 page.on('requestfailed',r=>console.log('network',r.url().replace(/([?&](?:key|jscode)=)[^&]+/gi,'$1REDACTED'),r.failure()?.errorText));
 const panel=page.locator('details').filter({has:page.locator('summary', {hasText:'景区清单与吃喝游玩推荐'})}).first();
 await panel.locator('summary').click();await panel.getByRole('button',{name:'查景区名录与路线',exact:true}).click();
 await panel.getByRole('region',{name:'景区名录结果'}).waitFor();assert.match(await panel.innerText(),/三峡之巅/);
 await panel.getByRole('button',{name:'保留景区候选'}).first().click();assert.match(await panel.getByRole('region',{name:'当天保留候选'}).innerText(),/三峡之巅/);
 await panel.getByRole('button',{name:'检查行程景区资料'}).click();await panel.getByRole('region',{name:'景区覆盖检查'}).waitFor();assert.match(await panel.innerText(),/恩施大峡谷/);
 await panel.getByLabel('推荐日期').selectOption('1');assert.equal(await panel.getByRole('region',{name:'当天保留候选'}).getByRole('button',{name:'移除'}).count(),0);
 await panel.getByLabel('推荐日期').selectOption('0');assert.match(await panel.getByRole('region',{name:'当天保留候选'}).innerText(),/三峡之巅/);
 await panel.getByRole('button',{name:'找好吃',exact:true}).click();await panel.getByRole('button',{name:'搜索当地候选',exact:true}).click();
 await panel.getByRole('status').waitFor({state:'hidden',timeout:60000});
 const alerts=await panel.getByRole('alert').allTextContents();const results=panel.getByRole('region',{name:'当地候选结果'});
 if(alerts.length){await page.screenshot({path:'.automation/discovery-failed.png',fullPage:true}); console.log(await page.evaluate(()=>({amap:!!window.AMap,href:location.href})));}assert.equal(alerts.length,0,'Live Amap must succeed: '+alerts.join());await results.waitFor();assert.ok(await results.locator('li').count()>0,'live restaurant candidates required');
 await results.getByRole('button',{name:'保留候选',exact:true}).first().click();
 const count=await results.locator('li').count();
 if(await results.getByRole('button',{name:'加载更多当地候选'}).count()){await results.getByRole('button',{name:'加载更多当地候选'}).click();await panel.getByRole('status').waitFor({state:'hidden',timeout:60000});assert.ok(await results.locator('li').count()>count);}
 const foodLoaded=await results.locator('li').count();
 await panel.getByRole('button',{name:'找好玩',exact:true}).click();await panel.getByRole('button',{name:'搜索当地候选',exact:true}).click();await panel.getByRole('status').waitFor({state:'hidden',timeout:60000});assert.equal(await panel.getByRole('alert').count(),0);assert.ok(await results.locator('li').count()>0,'live play candidates required');
 await panel.getByRole('button',{name:'查景区名录与路线',exact:true}).click();await panel.getByRole('status').waitFor({state:'hidden',timeout:15000});
 await page.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded();await panel.screenshot({path:'.automation/discovery-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile overflow');assert.deepEqual(errors,[]);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('roadbook-discovery-v1')));assert.ok(saved['2026-12-01'].length>=2);
 await page.route('**/api/discovery/',r=>r.fulfill({status:502,json:{error:'验证：供应商限流',code:'AMAP_REJECTED'}}));await panel.getByRole('button',{name:'搜索当地候选',exact:true}).click();await panel.getByRole('alert').waitFor();assert.match(await panel.getByRole('alert').innerText(),/供应商限流/);assert.ok(await panel.getByRole('region',{name:'当天保留候选'}).getByRole('button',{name:'移除'}).count()>=2);
 fs.writeFileSync('.automation/discovery-verification.json',JSON.stringify({at:new Date().toISOString(),liveAmap:true,livePlay:true,catalog:true,dayIsolation:true,persisted:true,foodLoaded,failurePreservesChoices:true,errors},null,2));console.log('Discovery browser verification passed');
}finally{await browser.close();}
