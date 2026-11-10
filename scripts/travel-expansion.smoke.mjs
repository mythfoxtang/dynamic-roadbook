// Fixtures exercise trading UI; real supplier requests are never made by this test.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {TravelEngine} from '../lib/travel-engine.mjs';
const base=process.argv[2]||'http://127.0.0.1:3013';
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const c={type:'apiKey',secret:'fixture-expansion'};const calls=[];let queryDate='';
const engine=new TravelEngine({tools:async()=>[],call:async(c,domain,action,args)=>{
 calls.push({domain,action,args});
 if(action==='search'){queryDate=args.departureDate||queryDate;const page=args.pageNum||1;return {data:Array.from({length:20},(_,j)=>({trainNum:`${j%2?'K':'G'}${(page-1)*20+j+1}`,departStationName:'上海虹桥',destStationName:'南京南',departureTime:`${queryDate} 08:00`,arrivalTime:`${queryDate} 09:00`,duration:'1时',price:{edzPrice:'160',swzPrice:'600'},seatAvailable:{edzNum:5,swzNum:1}})),...(page===1?{queryId:'fixture-snapshot',totalPageNum:3}:{})};}
 if(action==='detail')return {data:{trainInfo:{trainNum:args.trainNum,departStationName:args.departureStationName,destStationName:args.arrivalStationName,departsDate:args.departureDate},seatInfo:[{seatName:'二等座',seatId:3,resId:12345,price:160,leftNumber:5},{seatName:'无座',seatId:9,resId:12346,price:160,leftNumber:0}]}};
 if(action==='book')return {orderId:'567890',orderDetailUrl:'https://m.tuniu.com/order/567890'};
 if(action==='order')return {data:{orderId:567890,statusName:'待付款',payStatusName:'未付款',payStatus:1,contact:{tel:'PRIVATE'},touristList:[{psptId:'PRIVATE'}]}};
 if(action==='cancel')return {successCode:true};throw new Error('Unexpected fixture action');
}});
try{
 const context=await browser.newContext({viewport:{width:1365,height:1000}});const p=await context.newPage();p.setDefaultTimeout(30000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/api/travel/account/',r=>r.fulfill({json:{connected:true,fromEnvironment:true,domains:{train:{ok:true,book:true}},quota:{remainingToday:35}}}));
 await p.route('**/api/travel/query/',async r=>{const b=r.request().postDataJSON();let d;try{if(b.action==='search')d=await engine.search(b,c);else if(b.action==='next')d=await engine.next(b.searchId,c,b.count);else if(b.action==='detail')d=await engine.detail(b.searchId,b.offerId,c,b.refresh);else if(b.action==='book')d=await engine.book(b,c);else if(b.action==='sync')d=await engine.syncOrder(b,c);else if(b.action==='cancel')d=await engine.cancelOrder(b,c);else if(b.action==='orders')d=engine.listOrders(c);else throw new Error('Unexpected action');await r.fulfill({json:{data:d,connection:{connected:true}}});}catch(e){await r.fulfill({status:e.status||500,json:{error:e.message}});}});
 await p.goto(`${base}/travel/trains/`);await p.waitForLoadState('networkidle');
 await p.getByLabel('成人数',{exact:true}).fill('1');await p.getByRole('button',{name:'查询高铁车次',exact:true}).click();await p.getByTestId('travel-offer').nth(9).waitFor();assert.equal(await p.getByTestId('travel-offer').count(),10);
 await p.getByLabel('仅高铁／动车／城际',{exact:true}).uncheck();assert.equal(await p.getByTestId('travel-offer').count(),20);await p.getByLabel('仅高铁／动车／城际',{exact:true}).check();
 await p.getByRole('button',{name:'继续加载最多 3 页',exact:true}).click();await p.getByTestId('travel-offer').nth(29).waitFor();assert.equal(await p.getByTestId('travel-offer').count(),30);
 await p.getByLabel('席别',{exact:true}).selectOption('swz');await p.getByLabel('参考价最高',{exact:true}).fill('400');assert.equal(await p.getByTestId('travel-offer').count(),0);
 await p.getByRole('button',{name:'重置筛选',exact:true}).click();await p.getByRole('button',{name:'查看席别与余票'}).first().click();await p.getByLabel('高铁席别详情').waitFor();assert.equal(await p.getByRole('radio').nth(1).isDisabled(),true);await p.getByRole('radio').first().check();
 await p.getByLabel('联系人姓名',{exact:true}).fill('虚构测试');await p.getByLabel('联系人手机号',{exact:true}).fill('13800000000');await p.getByLabel('乘车人 1 姓名',{exact:true}).fill('虚构测试');await p.getByLabel('乘车人 1 证件类型',{exact:true}).selectOption('护照');await p.getByLabel('乘车人 1 证件号码',{exact:true}).fill('FIXTURE');await p.getByLabel('乘车人 1 出生日期',{exact:true}).fill('1990-01-01');await p.getByLabel('乘车人 1 证件有效期',{exact:true}).fill('2099-01-01');
 assert.equal(await p.getByRole('button',{name:'确认创建未支付车票订单',exact:true}).isDisabled(),true);await p.getByLabel(/我已核对日期、车站、席别/).check();await p.getByRole('button',{name:'确认创建未支付车票订单',exact:true}).click();await p.getByText('官方订单号：567890',{exact:true}).waitFor();
 await p.getByRole('button',{name:'同步高铁官方订单状态',exact:true}).click();await p.getByText('待付款 · 未付款',{exact:true}).waitFor();assert.equal((await p.locator('body').innerText()).includes('PRIVATE'),false);
 await p.getByRole('button',{name:'申请取消未支付车票订单',exact:true}).click();await p.getByRole('button',{name:'确认申请取消此未支付订单',exact:true}).click();await p.getByText('已取消 · 未付款',{exact:true}).waitFor();
 await p.getByRole('button',{name:'自驾租车',exact:true}).click();await p.getByLabel('还车城市',{exact:true}).fill('丽江');await p.getByLabel('整段租期总预算上限',{exact:true}).fill('1800');await p.getByRole('button',{name:'保存租车计划',exact:true}).click();await p.getByRole('status').filter({hasText:'已保存在当前浏览器'}).waitFor();
 await p.getByRole('button',{name:'查询租车报价',exact:true}).click();await p.getByText('当前可以保存计划，实时货源尚未接通',{exact:true}).waitFor();assert.equal(await p.getByTestId('car-offer').count(),0);
 await p.reload();await p.waitForLoadState('networkidle');await p.getByRole('button',{name:'恢复已存计划',exact:true}).click();assert.equal(await p.getByLabel('还车城市',{exact:true}).inputValue(),'丽江');
 await p.route('**/api/travel/cars/',async r=>{if(r.request().method()==='GET')return r.fulfill({json:{connected:true}});const q=r.request().postDataJSON();const fee={rental:500,basicInsurance:100,extraInsurance:0,service:0,oneWay:200,delivery:0,other:0};await r.fulfill({json:{connected:true,source:'test',provider:'fixture租车',query:q,offers:[{id:'fixture-car1',name:'fixture经济车',totalAmount:800,deposit:1500,seats:5,transmission:'自动',unlimitedMileage:true,fees:fee},{id:'fixture-car2',name:'fixture手动车',totalAmount:700,deposit:null,seats:4,transmission:'手动',unlimitedMileage:null,fees:{}}]}});});
 await p.getByRole('button',{name:'查询租车报价',exact:true}).click();await p.getByTestId('car-offer').nth(1).waitFor();await p.getByLabel('自动挡',{exact:true}).check();assert.equal(await p.getByTestId('car-offer').count(),1);await p.getByLabel('加入租车比较（最多3个）',{exact:true}).check();await p.getByLabel('租车费用比较').waitFor();
 await p.setViewportSize({width:390,height:844});await p.waitForLoadState('networkidle');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);fs.mkdirSync('.automation',{recursive:true});await p.screenshot({path:'.automation/travel-expansion-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.equal(calls.filter(c=>c.action==='book').length,1);assert.equal(calls.filter(c=>c.action==='cancel').length,1);console.log(JSON.stringify({passed:true,evidence:'fixture UI; no real trading',trainLoaded:60,trainHighSpeedShown:30,verified:['pagination metadata retention','seat budget','sold-out disabled','confirmation','owned status sync','unpaid cancellation','car plan persistence','unavailable supply','fixture fees/filter/compare','mobile overflow','browser errors']},null,2));
}finally{await browser.close();}
