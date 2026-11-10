// Actual supplier read-only search/details via production UI; all trading actions are blocked.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:3010';
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
 const context=await browser.newContext({viewport:{width:1365,height:1000}});const p=await context.newPage();p.setDefaultTimeout(60000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/api/travel/query/',async r=>{if(!['search','detail'].includes(r.request().postDataJSON()?.action))throw new Error('Read-only test refuses this action');await r.continue();});
 await p.goto(`${base}/travel/trains/`);await p.waitForLoadState('networkidle');
 const pending=p.waitForResponse(r=>r.url().endsWith('/api/travel/query/')&&r.request().postDataJSON()?.action==='search');await p.getByRole('button',{name:'查询高铁车次',exact:true}).click();const response=await pending;const data=await response.json();
 const report={source:'Tuniu official live via production webpage',checkedAt:new Date().toISOString(),searchStatus:response.status(),noOrdersOrPayments:true};
 if(!response.ok){report.error=data.error;report.code=data.code;fs.writeFileSync('.automation/train-ui-live-report.json',JSON.stringify(report,null,2));throw new Error(`Live search not verified: HTTP ${response.status}; ${data.code||'unknown'}`);}
 assert.equal(data.data.source,'live');assert.ok(data.data.count>0);await p.getByRole('button',{name:'查看席别与余票'}).first().waitFor();
 Object.assign(report,{query:data.data.query,loadedCandidates:data.data.count,shownHighSpeed:await p.getByTestId('travel-offer').count(),totalPages:data.data.totalPages,loadedPages:data.data.loadedPages});
 const detailPending=p.waitForResponse(r=>r.url().endsWith('/api/travel/query/')&&r.request().postDataJSON()?.action==='detail');await p.getByRole('button',{name:'查看席别与余票'}).first().click();const detailResponse=await detailPending;const detail=await detailResponse.json();
 report.detailStatus=detailResponse.status();
 if(!detailResponse.ok){report.detailError=detail.error;fs.writeFileSync('.automation/train-ui-live-report.json',JSON.stringify(report,null,2));throw new Error('Live detail not verified');}
 assert.ok(detail.data.options.length>0);assert.equal(JSON.stringify(detail).includes('bookingParam'),false);report.seatOptions=detail.data.options.length;report.title=detail.data.title;
 await p.getByLabel('高铁席别详情').scrollIntoViewIfNeeded();await p.screenshot({path:'.automation/train-live-desktop.png',fullPage:false});await p.setViewportSize({width:390,height:844});await p.waitForLoadState('networkidle');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await p.screenshot({path:'.automation/train-live-mobile.png',fullPage:false});assert.deepEqual(errors,[]);
 report.passed=true;fs.writeFileSync('.automation/train-ui-live-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
