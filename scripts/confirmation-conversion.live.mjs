// Real confirmation conversion; supplier searches are intercepted and never executed.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://localhost:3010';
const file='.automation/planner-browser-real.json';
const {draft}=JSON.parse(fs.readFileSync(file,'utf8'));
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
 const context=await browser.newContext(),page=await context.newPage(),queries=[];
 await page.addInitScript(d=>localStorage.setItem('roadbook-journey-draft-v1',JSON.stringify({input:d.input,draft:d})),draft);
 await page.route('**/api/travel-agent/',route=>route.request().postDataJSON()?.action==='recommend'?route.fulfill({json:{recommendations:[]}}):route.continue());
 await page.route('**/api/travel/query/**',route=>{queries.push(route.request().postDataJSON().kind);return route.fulfill({json:{data:{source:'fixture',offers:[]}}});});
 await page.route('**/api/travel/cars/**',route=>route.fulfill({json:{source:'unavailable',offers:[]}}));
 await page.goto(base+'/agent/');await page.waitForLoadState('networkidle');
 const started=Date.now(),pending=page.waitForResponse(r=>r.url().endsWith('/api/travel-agent/')&&r.request().postDataJSON()?.action==='confirm-draft',{timeout:110000});
 await page.getByRole('button',{name:'确认此行程，开始查价',exact:true}).click();
 const response=await pending,data=await response.json();
 console.log(JSON.stringify({httpStatus:response.status(),seconds:(Date.now()-started)/1000,error:data.error,tasks:data.plan?.tasks?.map(t=>({kind:t.kind,title:t.title}))}));
 fs.writeFileSync('.automation/confirmation-real-conversion.json',JSON.stringify(data,null,2));
 assert.ok(response.ok(),data.error);
 await page.getByRole('region',{name:'统一预订工作台',exact:true}).waitFor();
 await page.getByText('候选已整理好，请选择你喜欢的方案',{exact:true}).waitFor();
 assert.ok(queries.includes('hotel'));assert.ok(!queries.includes('train'));await page.getByText(/铁路尚未进入含当天15天的预售期/).first().waitFor();
 console.log(JSON.stringify({bookingWorkspaceVisible:true,searchKinds:queries,railQueries:0,inventory:'intercepted fixtures; no real supplier queries or orders'}));
 await context.close();
}finally{await browser.close();}
