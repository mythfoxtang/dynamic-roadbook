// Validate the actual public tunnel. Credentials stay in ignored local files.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const access=JSON.parse(fs.readFileSync('.automation/cpolar/access.json','utf8'));
assert.ok(access.url?.startsWith('https://'));
const base=new URL(access.url).origin;
for(const endpoint of ['/agent/','/api/ai/config/']){
  const r=await fetch(base+endpoint,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,401);await r.body?.cancel();
}
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(executablePath?{executablePath}:{})});
try{
  const context=await browser.newContext({httpCredentials:{username:access.username,password:access.password},viewport:{width:1365,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(access.url,{waitUntil:'networkidle',timeout:60000});
  await page.getByRole('tab',{name:/模式1/}).waitFor();await page.getByRole('tab',{name:/模式2/}).waitFor();
  const config=await page.evaluate(async()=>{const r=await fetch('/api/ai/config/');return {status:r.status,data:await r.json()};});assert.equal(config.status,200);assert.equal(config.data.provider,'DeepSeek');
  const pending=page.waitForResponse(r=>r.url().endsWith('/api/travel-agent/')&&r.request().postDataJSON()?.action==='draft',{timeout:110000});
  await page.getByLabel('想去哪里，什么时候出发？').fill('2026年12月上旬昆明轻松游3天，只住一个城市。先规划，不查询库存。');
  await page.getByRole('button',{name:'生成行程草案',exact:true}).click();
  const response=await pending,data=await response.json();assert.ok(response.ok(),data.error);assert.equal(data.draft.days.length,3);
  await page.getByRole('textbox',{name:'你想怎么修改这份行程？'}).waitFor();await page.getByRole('button',{name:'确认此行程，开始查价',exact:true}).waitFor();
  await page.screenshot({path:'.automation/cpolar/public-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.automation/cpolar/public-mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  const report={url:access.url,anonymousPageStatus:401,anonymousApiStatus:401,authenticatedPageStatus:200,aiProvider:config.data.provider,realDraftDays:data.draft.days.length,browserProxy:'disabled with --no-proxy-server; host-level routing not independently verified',mobileLayout:'passed',pageErrors:errors,orders:0,checkedAt:new Date().toISOString()};
  fs.writeFileSync('.automation/cpolar/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await context.close();
}finally{await browser.close();}
