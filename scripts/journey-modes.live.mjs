// Real model + browser discussion, with all supplier requests blocked. No booking.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://localhost:3016';
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
  const context=await browser.newContext({viewport:{width:1380,height:1000}}),page=await context.newPage(),errors=[],reports=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/travel/query/**',()=>{throw new Error('Planning must not call suppliers');});
  async function draft(button){
    const pending=page.waitForResponse(r=>r.url().endsWith('/api/travel-agent/')&&r.request().postDataJSON()?.action==='draft',{timeout:110000});
    await page.getByRole('button',{name:button,exact:true}).click();const response=await pending,data=await response.json();assert.ok(response.ok(),data.error);
    await page.getByRole('textbox',{name:'你想怎么修改这份行程？'}).waitFor();reports.push({mode:response.request().postDataJSON().mode,draft:data.draft});return data.draft;
  }
  await page.goto(base+'/agent/');await page.waitForLoadState('networkidle');
  await page.getByLabel('想去哪里，什么时候出发？').fill('云南，2026年12月上旬，约5天，轻松一点');
  await draft('生成行程草案');
  await page.getByRole('textbox',{name:'你想怎么修改这份行程？'}).fill('不要换酒店，只住昆明一座城市。');
  assert.ok(await page.getByRole('button',{name:'确认此行程，开始查价'}).isDisabled());
  await draft('发送修改意见');await page.getByRole('log',{name:'行程修改记录'}).waitFor();
  await page.screenshot({path:'.automation/two-modes-idea-desktop.png',fullPage:true});
  await page.getByRole('tab',{name:/模式1/}).click();
  await page.getByLabel('把确定的行程交给 DeepSeek').fill('2026年12月5日上海飞昆明，6日游翠湖，7日昆明飞上海，2成人。路线和日期已经确定，只需整理。');
  const fixed=await draft('整理已有行程');assert.equal(fixed.days.length,3);assert.equal(fixed.days[0].date,'2026-12-05');assert.equal(fixed.days[2].date,'2026-12-07');
  await page.getByRole('textbox',{name:'你想怎么修改这份行程？'}).fill('第二天只在翠湖轻松散步，其他日期和路线都不要变。');
  const revised=await draft('发送修改意见');assert.equal(revised.days.length,3);assert.equal(revised.days[0].date,'2026-12-05');assert.equal(revised.days[2].date,'2026-12-07');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.automation/two-modes-fixed-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);fs.writeFileSync('.automation/two-modes-live.json',JSON.stringify(reports,null,2));
  console.log('PASS: real DeepSeek browser discussion and visible edit/confirm controls in both modes; fixed dates preserved, no supplier queries or orders.');
  await context.close();
}finally{await browser.close();}
