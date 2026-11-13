// Fixture test: validates the confirmation boundary, revision, recovery and mobile layout.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://localhost:3016';
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const draft={title:'云南慢游（测试草案）',summary:'只规划大理，减少换酒店',days:[{date:'2099-12-01',city:'大理市',activity:'古城散步与休息',transport:'当地接驳，待核实',stay:'古城周边'},{date:'2099-12-02',city:'大理市',activity:'返程',transport:'返程交通待核实',stay:'无需住宿'}],questions:[],assumptions:['仅当地行程'],warnings:['预约待核实'],ready:true};
const plan={title:draft.title,input:'大理2天',analysis:{model:'fixture'},days:draft.days,tasks:[{id:'task-1',kind:'hotel',title:'大理一晚',query:{city:'大理市',startDate:'2099-12-01',endDate:'2099-12-02'},checks:[]}],assumptions:[],warnings:[]};
try{
 const context=await browser.newContext({viewport:{width:1365,height:1000}}),page=await context.newPage(),errors=[];let searches=0,confirmations=0;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/travel-agent/',async route=>{
  const b=route.request().postDataJSON();let data={};
  if(b.action==='draft')data={draft:b.adjustment?{...draft,title:'已调整的大理草案'}:draft};
  if(b.action==='confirm-draft'){confirmations++;data={plan};}
  if(b.action==='restore')data={state:null,sources:[]};
  if(b.action==='recommend')data={recommendations:[]};
  return route.fulfill({json:data});
 });
 await page.route('**/api/travel/query/',route=>{searches++;return route.fulfill({json:{data:{source:'fixture',offers:[]}}});});
 await page.goto(base+'/agent/');await page.waitForLoadState('networkidle');
 await page.getByLabel('想去哪里，什么时候出发？').fill('12月上旬想去云南，轻松两天');
 await page.getByRole('button',{name:'生成行程草案',exact:true}).click();await page.getByTestId('journey-draft').waitFor();
 assert.equal(searches,0);assert.equal(confirmations,0);
 await page.getByLabel('你想怎么修改这份行程？').fill('只住大理，不要换酒店');
 assert.ok(await page.getByRole('button',{name:'确认此行程，开始查价'}).isDisabled());
 await page.getByRole('button',{name:'发送修改意见',exact:true}).click();await page.getByRole('heading',{name:'已调整的大理草案'}).waitFor();
 assert.equal(searches,0);await page.reload();await page.waitForLoadState('networkidle');await page.getByRole('heading',{name:'已调整的大理草案'}).waitFor();
 await page.screenshot({path:'.automation/planner-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.automation/planner-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'确认此行程，开始查价'}).click();await page.getByTestId('agent-task').waitFor();
 assert.equal(confirmations,1);assert.equal(searches,1);assert.deepEqual(errors,[]);
 await page.getByRole('region',{name:'统一预订工作台',exact:true}).waitFor();
 await page.getByRole('button',{name:'返回行程修改',exact:true}).click();
 await page.getByRole('heading',{name:'已调整的大理草案'}).waitFor();
 await page.getByRole('tab',{name:/模式1/}).click();
 await page.getByLabel('把确定的行程交给 DeepSeek').fill('2099年12月1日到大理，2日返程');
 await page.getByRole('button',{name:'整理已有行程',exact:true}).click();
 await page.getByTestId('journey-draft').filter({visible:true}).waitFor();
 assert.equal(searches,1,'fixed mode also waits for explicit confirmation');
 await page.getByRole('button',{name:'确认此行程，开始查价'}).click();
 await page.getByRole('region',{name:'统一预订工作台',exact:true}).waitFor();
 await page.getByText('候选已整理好，请选择你喜欢的方案',{exact:true}).waitFor();
 assert.equal(confirmations,2);assert.equal(searches,2);assert.deepEqual(errors,[]);
 await context.close();console.log('PASS: draft → revise → reload → explicit confirmation → first supplier query; mobile, no browser errors. Fixtures only.');
}finally{await browser.close();}
