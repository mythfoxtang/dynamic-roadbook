// Delayed and failed responses reproduce confirmation feedback without supplier calls.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://localhost:3010';
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const draft={title:'确认反馈测试',summary:'测试草案',input:'昆明两天',days:[{date:'2099-12-01',city:'昆明',activity:'散步',transport:'步行',stay:'市区'},{date:'2099-12-02',city:'昆明',activity:'返程',transport:'返程',stay:'无需住宿'}],questions:[],assumptions:[],warnings:[],ready:true};
const plan={title:draft.title,input:draft.input,days:draft.days,analysis:{model:'fixture'},tasks:[{id:'task-1',kind:'hotel',title:'昆明一晚',checks:[],query:{city:'昆明',startDate:'2099-12-01',endDate:'2099-12-02'}},{id:'task-2',kind:'train',title:'尚未开售的高铁',checks:[],query:{from:'上海',to:'昆明',date:'2099-12-01',adults:1}}],assumptions:[],warnings:[]};
try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();let confirmations=0,searches=0,release;
  await page.addInitScript(d=>localStorage.setItem('roadbook-journey-draft-v1',JSON.stringify({input:d.input,draft:d})),draft);
  await page.route('**/api/travel-agent/',async route=>{
    const b=route.request().postDataJSON();
    if(b.action==='restore')return route.fulfill({json:{state:null}});
    if(b.action==='confirm-draft'){
      confirmations++;await new Promise(resolve=>{release=resolve;});
      return route.fulfill(confirmations===1?{status:422,json:{error:'fixture：任务日期无效，请修改后重试'}}:{json:{plan}});
    }
    return route.fulfill({json:{sources:[],recommendations:[]}});
  });
  await page.route('**/api/travel/query/',route=>{searches++;return route.fulfill({json:{data:{source:'fixture',offers:[]}}});});
  await page.goto(base+'/agent/');await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:'确认此行程，开始查价',exact:true}).click();
  const controls=page.getByRole('region',{name:'修改行程或进入下一步'});
  await controls.getByRole('status').filter({hasText:/正在整理查价任务/}).waitFor({timeout:2000});
  assert.ok(await controls.getByRole('button',{name:/正在整理查价任务/}).isDisabled());assert.equal(searches,0);
  release();const alert=controls.getByRole('alert');await alert.filter({hasText:/任务日期无效/}).waitFor();
  assert.ok(await alert.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'failure must be visible at confirmation controls');
  release=null;await page.getByRole('button',{name:'确认此行程，开始查价',exact:true}).click();
  await controls.getByRole('status').waitFor();for(let i=0;i<100&&!release;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(release);release();
  await page.getByRole('region',{name:'统一预订工作台',exact:true}).waitFor();await page.getByText('候选已整理好，请选择你喜欢的方案',{exact:true}).waitFor();
  assert.equal(confirmations,2);assert.equal(searches,1);await page.getByText(/铁路尚未进入含当天15天的预售期/).waitFor();await context.close();
  for(const action of ['cancel','timeout']){
    const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();let finish;
    await p.addInitScript(d=>localStorage.setItem('roadbook-journey-draft-v1',JSON.stringify({input:d.input,draft:d})),draft);
    await p.route('**/api/travel-agent/',async route=>{
      if(route.request().postDataJSON().action==='confirm-draft'){await new Promise(resolve=>{finish=resolve;});try{await route.fulfill({json:{plan}});}catch{}return;}
      return route.fulfill({json:{state:null,sources:[]}});
    });
    await p.goto(base+'/agent/');await p.waitForLoadState('networkidle');if(action==='timeout')await p.clock.install();
    await p.getByRole('button',{name:'确认此行程，开始查价',exact:true}).click();await p.getByRole('button',{name:'取消本次整理'}).waitFor();
    if(action==='cancel'){await p.getByRole('button',{name:'取消本次整理'}).click();await p.getByRole('status').filter({hasText:/已取消整理查价任务/}).waitFor();}
    else{await p.clock.fastForward(101000);await p.getByRole('alert').filter({hasText:/整理查价任务超时/}).waitFor();}
    assert.ok(await p.getByRole('button',{name:'确认此行程，开始查价',exact:true}).isEnabled());assert.equal(await p.getByTestId('journey-draft').count(),1);finish?.();await c.close();
  }
  console.log('PASS: pending progress, duplicate-click guard, visible mobile failure, successful retry, future rail deferral, cancellation and timeout preserve draft. Fixtures only.');
}finally{await browser.close();}
