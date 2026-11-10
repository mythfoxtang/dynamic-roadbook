// Explicit fixtures exercise orchestration and selection, not real inventory.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://localhost:3012';
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const plan={title:'测试行程（fixture）',input:'测试行程',analysis:{model:'fixture'},days:[{date:'2099-11-16',city:'宜昌',activity:'抵达'},{date:'2099-11-17',city:'上海',activity:'回家'}],assumptions:['一位成人查价'],warnings:['测试数据'],tasks:[{id:'task-1',kind:'flight',title:'上海到宜昌',reason:'出发',checks:['时刻'],query:{from:'上海',to:'宜昌',date:'2099-11-16'}},{id:'task-2',kind:'hotel',title:'宜昌一晚',reason:'住宿',checks:[],query:{city:'宜昌',startDate:'2099-11-16',endDate:'2099-11-17'}},{id:'task-3',kind:'car',title:'租车',checks:[],query:{}},{id:'task-4',kind:'attraction',title:'门票',checks:[],query:{}}]};
try{
 const context=await browser.newContext({viewport:{width:1380,height:1000}}),page=await context.newPage(),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
 let rateLimited=false,staleDetail=false,recoveryQuota=false;
 await page.route('**/api/travel-agent/',async route=>{const body=route.request().postDataJSON();calls.push(body.action);return route.fulfill({json:body.action==='plan'?{plan}:{recommendations:[{taskId:'task-1',offerIds:['flight'],reason:'测试推荐'}]}});});
 await page.route('**/api/travel/query/',async route=>{
  const body=route.request().postDataJSON();calls.push(body.action);assert.ok(['search','detail'].includes(body.action),'never create orders');
  if(body.action==='detail'){
   if(staleDetail){staleDetail=false;recoveryQuota=true;return route.fulfill({status:404,json:{error:'fixture服务重启',code:'SEARCH_NOT_FOUND'}});}
   return route.fulfill({json:{data:{options:[{id:'option',name:'fixture经济舱',price:400,refund:'收费退改'}]}}});
  }
  if(recoveryQuota){recoveryQuota=false;return route.fulfill({status:429,json:{error:'fixture恢复时限流',retryAfter:2,code:'MINUTE_QUOTA'}});}
  if(!rateLimited){rateLimited=true;return route.fulfill({status:429,json:{error:'fixture限流',retryAfter:2,code:'MINUTE_QUOTA'}});}
  return route.fulfill({json:{data:{id:body.kind+'-search',source:'fixture',queriedAt:new Date().toISOString(),offers:[{id:body.kind,supplierId:body.kind+'-supplier',name:body.kind==='flight'?'fixture航班':'fixture酒店',price:300,priceUnit:'fixture报价',departureTime:'08:00',arrivalTime:'10:00',type:'直飞'}]}}});
 });
 await page.route('**/api/travel/cars/',route=>route.fulfill({json:{source:'unavailable',offers:[],notice:'fixture租车未授权'}}));
 await page.goto(base+'/agent/');await page.waitForLoadState('networkidle');await page.getByRole('button',{name:'交给 DeepSeek 安排'}).click();
 await page.getByText('候选已整理好，请选择你喜欢的方案',{exact:true}).waitFor({timeout:30000});
 assert.equal(await page.getByTestId('agent-task').count(),4);assert.equal(await page.getByTestId('agent-offer').count(),2);
 await page.getByRole('button',{name:'选择 fixture航班',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'¥400 · 选这个',exact:true}).click();
 await page.getByRole('complementary',{name:'我的选择'}).getByText('fixture经济舱').waitFor();
 await page.screenshot({path:'.automation/agent-fixture-desktop.png',fullPage:true});
 await page.reload();await page.waitForLoadState('networkidle');assert.ok(await page.getByRole('button',{name:'选择 fixture航班',exact:true}).isEnabled());
 staleDetail=true;
 await page.getByRole('button',{name:'选择 fixture航班',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'¥400 · 选这个',exact:true}).waitFor();await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.automation/agent-fixture-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);assert.ok(calls.includes('recommend'));assert.ok(!calls.includes('book'));
 console.log('PASS: automatic task queue, rate-limit retry, real-option selection, restoration, mobile width, no order creation; fixtures only.');
 await context.close();
}finally{await browser.close();}
