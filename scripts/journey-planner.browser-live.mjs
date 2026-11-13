// Real browser/model planning check. No supplier queries, orders or payments.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://localhost:3010';
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
 const context=await browser.newContext({viewport:{width:1365,height:1000}}),page=await context.newPage(),errors=[];let supplierCalls=0;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/travel/query/**',route=>{supplierCalls++;return route.abort();});
 await page.route('**/api/travel/cars/**',route=>{supplierCalls++;return route.abort();});
 await page.goto(base+'/agent/');await page.waitForLoadState('networkidle');
 await page.getByLabel('想去哪里，什么时候出发？').fill('云南，2026年12月上旬，约5天，轻松一点');
 const result=page.waitForResponse(r=>r.url().endsWith('/api/travel-agent/')&&r.request().postDataJSON()?.action==='draft',{timeout:110000});
 await page.getByRole('button',{name:'生成行程草案',exact:true}).click();
 const response=await result,data=await response.json();assert.ok(response.ok(),data.error);assert.equal(data.draft.days.length,5);
 await page.getByTestId('journey-draft').waitFor();await page.screenshot({path:'.automation/planner-real-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.automation/planner-real-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);assert.equal(supplierCalls,0);
 fs.writeFileSync('.automation/planner-browser-real.json',JSON.stringify(data,null,2));
 console.log(JSON.stringify({result:'PASS',model:'real server DeepSeek',title:data.draft.title,days:data.draft.days.length,questions:data.draft.questions,ready:data.draft.ready,supplierCalls,browserErrors:errors}));await context.close();
}finally{await browser.close();}
