// Uses a fixture itinerary with real AMap SDK/search; no AI or booking calls.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const access=JSON.parse(fs.readFileSync('.automation/cpolar/access.json','utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const draft={title:'地图联动验证',summary:'地图测试',input:'昆明大理',ready:true,questions:[],assumptions:[],warnings:[],days:[{date:'2026-12-01',city:'昆明市',activity:'翠湖散步',transport:'当地交通',stay:'市区',stops:['翠湖公园','云南省博物馆']},{date:'2026-12-02',city:'大理市',activity:'古城游览',transport:'动车',stay:'古城',stops:['大理古城','喜洲古镇']}]};
const results=[];
try{
 for(const base of ['http://localhost:3010/agent/',access.url]){
  const context=await browser.newContext({viewport:{width:1280,height:900},httpCredentials:{username:access.username,password:access.password}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(d=>{localStorage.setItem('roadbook-agent-mode','idea');localStorage.setItem('roadbook-journey-draft-v1',JSON.stringify({input:d.input,draft:d}));},draft);
  await page.route('**/api/travel-agent/',route=>route.fulfill({json:{state:null,sources:[]}}));
  await page.goto(base);await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
  const map=page.getByRole('region',{name:'规划行程地图'});await map.waitFor();
  await map.getByText('正在检索行程地点…',{exact:true}).waitFor({state:'hidden',timeout:65000});
  const text=await map.innerText();const canvas=map.locator('.amap-container');
  await canvas.waitFor({timeout:20000});await canvas.scrollIntoViewIfNeeded();assert.equal(await map.getByRole('alert').count(),0,text);
  assert.ok(await map.locator('.amap-marker').count()>0,'real geocoded markers required');if(text.includes('未定位'))assert.equal(await map.getByRole('button',{name:'重新检索未定位地点'}).count(),1);
  await map.getByRole('button',{name:'第2天',exact:false}).click();await map.getByRole('button',{name:'第2天',exact:false}).getAttribute('aria-pressed').then(v=>assert.equal(v,'true'));
  await page.setViewportSize({width:390,height:844});await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(4000);await page.screenshot({path:'.automation/journey-map-'+(base.startsWith('http:')?'local':'public')+'.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile overflow');
  assert.deepEqual(errors,[]);
  results.push({url:base,mapLoaded:true,placeSearch:true,partialLocation:text.includes('未定位'),daySwitch:true,mobile:true});await context.close();
 }
 console.log(JSON.stringify(results,null,2));fs.writeFileSync('.automation/journey-map-verification.json',JSON.stringify(results,null,2));
}finally{await browser.close();}
