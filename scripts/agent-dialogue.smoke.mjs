// Fixture-only browser checks. These do not establish inventory coverage.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://localhost:3016';
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,executablePath});
const dates=[3,4,5].map(n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+n*86400000)));
const query={kind:'hotel',city:'宜昌',startDate:dates[0],endDate:dates[1],adults:1,rooms:1};
let plan={title:'fixture 对话行程',input:'fixture 行程',analysis:{model:'fixture'},days:[{date:dates[0],city:'宜昌',activity:'抵达'},{date:dates[1],city:'奉节',activity:'徒步'},{date:dates[2],city:'上海',activity:'返回'}],assumptions:[],warnings:[],tasks:[{id:'task-1',kind:'flight',title:'上海到宜昌',reason:'出发',checks:[],query:{from:'上海',to:'宜昌',date:dates[0]}},{id:'task-2',kind:'hotel',title:'宜昌住宿',reason:'住宿',checks:[],query},{id:'task-3',kind:'hotel',title:'三峡之巅住宿',reason:'待核实地点',checks:[],query:{...query,startDate:dates[1],endDate:dates[2],poi:'三峡之巅'}}]};
const hotelOffers=Array.from({length:12},(_,i)=>({id:`hotel-${i}`,supplierId:`hotel-supplier-${i}`,kind:'hotel',name:`fixture酒店${i}`,price:200+i*10,facilities:['停车场'],address:'fixture 地址',query}));
const flight={id:'flight',supplierId:'flight-supplier',kind:'flight',name:'fixture已选航班',price:600,departureTime:'08:00',arrivalTime:'10:00'};
const initial={plan,input:plan.input,results:{'task-1':{id:'flight-search',kind:'flight',source:'fixture',loadedPages:1,totalPages:1,offers:[flight]},'task-2':{id:'hotel-search',kind:'hotel',source:'fixture',loadedPages:1,totalPages:2,offers:hotelOffers.slice(0,4)},'task-3':{id:'wrong-city',source:'fixture',offers:[{id:'wrong',kind:'hotel',name:'错误城市酒店',price:1}]}},choices:{'task-1':{offer:flight,option:{name:'fixture经济舱'}},'task-2':{offer:hotelOffers[0],option:{name:'fixture大床房'}}},recommendations:[]};
try{
 const context=await browser.newContext({viewport:{width:1380,height:1000}}),page=await context.newPage(),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(s=>{if(!localStorage.getItem('roadbook-deepseek-agent-v1'))localStorage.setItem('roadbook-deepseek-agent-v1',JSON.stringify(s));},initial);
 await page.route('**/api/travel-agent/',async route=>{
  const body=route.request().postDataJSON();calls.push(body.action);
  if(body.action==='capabilities')return route.fulfill({json:{sources:[{id:'rail',name:'高铁',state:'configured',notice:'fixture已配置'},{id:'car',name:'租车',state:'needs_auth',notice:'fixture未授权'}]}});
  if(body.action==='chat'){
   let actions=[];if(body.message.includes('更多'))actions=[{type:'more',taskId:'task-2',pages:1}];
   if(body.message.includes('250'))actions=[{type:'filter',taskId:'task-2',filters:{maxPrice:250,parking:true}}];
   if(body.message.includes('高铁')){plan={...plan,tasks:[...plan.tasks,{id:'task-4',kind:'train',title:'高铁备选',alternativeTo:'task-1',checks:[],query:{from:'上海',to:'宜昌',date:dates[0],mode:'3'}}]};actions=[{type:'add',taskId:'task-4'}];}
   return route.fulfill({json:{reply:'fixture：按这轮要求调整，保留其他选择。',plan,actions}});
  }
  if(body.action==='recommend')return route.fulfill({json:{recommendations:[]}});
  return route.fulfill({json:{saved:true}});
 });
 await page.route('**/api/travel/query/',async route=>{
  const b=route.request().postDataJSON();calls.push(b.action);assert.ok(['search','next','detail'].includes(b.action));
  if(b.action==='next')return route.fulfill({json:{data:{id:'hotel-search',source:'fixture',loadedPages:2,totalPages:2,offers:hotelOffers}}});
  if(b.action==='detail')return route.fulfill({json:{data:{options:[{id:'seat',name:'fixture二等座',price:500,seats:10}]}}});
  assert.equal(b.kind,'train');return route.fulfill({json:{data:{id:'train-search',source:'fixture',loadedPages:1,totalPages:1,offers:[{id:'train',supplierId:'fixture-G',kind:'train',name:'fixture高铁',price:500,seats:[{code:'edz',price:500,remaining:10}],departureTime:'09:00',arrivalTime:'15:00',departureStation:'上海虹桥',arrivalStation:'宜昌东'}]}}});
 });
 await page.goto(base+'/agent/');await page.waitForLoadState('networkidle');await page.getByRole('heading',{name:'继续和 DeepSeek 商量'}).waitFor();
 assert.equal(await page.getByText('错误城市酒店',{exact:true}).count(),0);await page.getByText(/三峡之巅位于奉节县/).first().waitFor();
 const hotel=page.getByTestId('agent-task').filter({has:page.getByRole('heading',{name:'宜昌住宿',exact:true})});
 async function chat(text){await page.getByLabel('这轮想怎么调整？').fill(text);await page.getByRole('button',{name:'发给 DeepSeek',exact:true}).click();await page.getByText('已按这轮要求更新，原有未受影响的选择已保留',{exact:true}).waitFor();}
 await chat('给我更多酒店');await hotel.getByText(/已加载 12 个/).waitFor();assert.equal(await hotel.getByTestId('agent-offer').count(),6);
 assert.ok((await page.getByRole('complementary',{name:'我的选择'}).innerText()).includes('fixture已选航班'));
 await chat('酒店250元以内，能停车');await hotel.getByText(/筛选后 6 个/).waitFor();assert.equal(await hotel.getByTestId('agent-offer').count(),6);
 await chat('增加高铁备选');const rail=page.getByTestId('agent-task').filter({has:page.getByRole('heading',{name:'高铁备选',exact:true})});await rail.getByRole('button',{name:'选择 fixture高铁'}).click();await page.getByRole('button',{name:'¥500 · 选这个',exact:true}).click();
 const selection=page.getByRole('complementary',{name:'我的选择'});await selection.getByText('fixture高铁',{exact:true}).waitFor();assert.ok(!(await selection.innerText()).includes('fixture已选航班'));assert.ok((await selection.innerText()).includes('fixture酒店0'));
 await page.reload();await page.waitForLoadState('networkidle');await page.getByRole('log').waitFor();assert.equal(await page.getByRole('log').locator('article').count(),6);await selection.getByText('fixture高铁',{exact:true}).waitFor();
 await page.screenshot({path:'.automation/agent-dialogue-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.automation/agent-dialogue-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);assert.ok(calls.includes('next'));assert.ok(!calls.includes('book'));
 await context.close();
 for(const unsynced of [false,true]){
  const restoreContext=await browser.newContext(),restorePage=await restoreContext.newPage();
  const local=structuredClone(initial);local.unsynced=unsynced;if(unsynced)local.choices['task-2'].offer.name='fixture本地未同步选择';
  const server=structuredClone(initial);server.results['task-2'].offers=hotelOffers;server.results['task-2'].loadedPages=2;
  await restorePage.addInitScript(s=>localStorage.setItem('roadbook-deepseek-agent-v1',JSON.stringify(s)),local);
  await restorePage.route('**/api/travel-agent/',route=>{const body=route.request().postDataJSON();return route.fulfill({json:body.action==='restore'?{state:server}:body.action==='capabilities'?{sources:[]}:{saved:true}});});
  await restorePage.goto(base+'/agent/');await restorePage.waitForLoadState('networkidle');
  const restoredHotel=restorePage.getByTestId('agent-task').filter({has:restorePage.getByRole('heading',{name:'宜昌住宿',exact:true})});
  await restoredHotel.getByText(unsynced?/已加载 4 个/:/已加载 12 个/).waitFor();
  if(unsynced)await restorePage.getByRole('complementary',{name:'我的选择'}).getByText('fixture本地未同步选择',{exact:true}).waitFor();
  await restoreContext.close();
 }
 console.log('PASS: follow-up conversation, pagination, filters, rail alternatives, original-choice preservation, mutually exclusive alternatives, wrong-city quarantine, history restoration, fresh server snapshots, unsynced local choices and mobile layout; fixtures only.');
}finally{await browser.close();}
