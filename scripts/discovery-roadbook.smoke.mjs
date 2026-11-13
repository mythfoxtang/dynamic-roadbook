// Explicit search fixture: tests old-roadbook migration and add-stop wiring, not live Amap.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();
 await page.addInitScript(()=>{localStorage.setItem('dynamic-roadbook-day-recommendations-v1',JSON.stringify(Object.fromEntries(Array.from({length:28},(_,i)=>['day-'+(i+1),[{id:'old-poi',name:'原已选候选',kind:'food'}]]))));});
 let request;
 await page.route('**/api/discovery/',async r=>{request=r.request().postDataJSON();await r.fulfill({json:{items:[{id:'fixture-poi',name:'测试餐厅候选',coord:[100.23,26.87],location:'100.23,26.87',kind:'food',address:'丽江市（测试）',source:'测试数据',fetchedAt:new Date().toISOString()}],page:1,hasMore:false,source:'测试数据',scope:'丽江市'}});});
 await page.goto((process.argv[2]||'http://localhost:3018')+'/roadbook/',{timeout:90000});
 await page.getByRole('button',{name:'推荐',exact:true}).click();
 const panel=page.locator('details').filter({has:page.locator('summary',{hasText:'景区清单与吃喝游玩推荐'})}).first();await panel.locator('summary').click();
 assert.match(await panel.getByRole('region',{name:'当天保留候选'}).innerText(),/原已选候选/);
 await panel.getByLabel('推荐城市').fill('丽江市');await panel.getByRole('button',{name:'找好吃',exact:true}).click();await panel.getByRole('button',{name:'搜索当地候选',exact:true}).click();
 await panel.getByRole('button',{name:'加入当天路线',exact:true}).click();
 assert.equal(request.city,'丽江市');assert.equal(request.kind,'food');
 await page.waitForFunction(()=>Object.entries(localStorage).some(([k,v])=>k.includes('day-plan')&&v.includes('测试餐厅候选')));
 console.log('Roadbook migration and add-stop fixture verification passed');
}finally{await browser.close();}
