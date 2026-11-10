// Uses a local encrypted browser-session credential; only search/detail/model calls.
// No order creation, cancellation or payment is permitted by this script.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readTravelPrivate} from '../lib/travel-vault.mjs';
const base=process.argv[2]||'http://localhost:3012';
const sessions=readTravelPrivate('ai-sessions',[]).filter(([,s])=>s.provider==='DeepSeek'&&s.expiresAt>Date.now());
assert.ok(sessions.length,'Configure DeepSeek in the local settings page first.');
const [sessionId]=sessions.at(-1),{plan}=JSON.parse(fs.readFileSync('.automation/agent-live-plan.json','utf8'));
assert.ok(plan?.analysis?.provider==='DeepSeek');
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
 const context=await browser.newContext({viewport:{width:1380,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addCookies([{name:'roadbook_ai_session',value:sessionId,url:base,httpOnly:true,sameSite:'Strict'}]);
 await page.addInitScript(p=>{if(!localStorage.getItem('roadbook-deepseek-agent-v1'))localStorage.setItem('roadbook-deepseek-agent-v1',JSON.stringify({plan:p,input:p.input,results:{},choices:{},recommendations:[]}));},plan);
 await page.route('**/api/travel/query/',route=>{const body=route.request().postDataJSON();assert.ok(['search','detail'].includes(body.action),'Read-only boundary');return route.continue();});
 await page.goto(base+'/agent/');await page.waitForLoadState('networkidle');
 await page.getByRole('button',{name:'重新核实全部候选'}).click();
 await page.getByRole('button',{name:'交给 DeepSeek 安排',exact:true}).waitFor({timeout:300000});
 const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('roadbook-deepseek-agent-v1')));
 fs.writeFileSync('.automation/agent-live-results.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({model:report.plan.analysis.model,tasks:report.plan.tasks.map(t=>({title:t.title,kind:t.kind,state:report.results[t.id]?.state,source:report.results[t.id]?.source,count:report.results[t.id]?.offers?.length,notice:report.results[t.id]?.notice})),recommendations:report.recommendations,errors},null,2));
 await page.screenshot({path:'.automation/agent-live-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.automation/agent-live-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);
 assert.ok(report.recommendations.length,'Actual DeepSeek recommendation pass must complete.');
 console.log('PASS: real DeepSeek analysis artifact → live supplier query queue → real DeepSeek recommendations; no orders.');
 await context.close();
}finally{await browser.close();}
