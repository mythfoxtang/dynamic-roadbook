// Browser tests use intercepted fixture responses. No real booking or payment requests.
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { TravelEngine } from '../lib/travel-engine.mjs';
const base = process.argv[2] || 'http://127.0.0.1:3012';
const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const credential = { type: 'apiKey', secret: 'browser-fixture' };
const calls = [];
const connection = { connected: true, checkedAt: Date.now(), domains: { hotel: { ok: true, book: true }, flight: { ok: true, book: true } }, quota: { remainingToday: 40 } };
const engine = new TravelEngine({ tools: async () => [], call: async (c, kind, action, args) => {
  calls.push({ kind, action, args });
  if (action === 'search') {
    const start = ((args.pageNum || 1) - 1) * 20;
    return kind === 'hotel' ? { queryId: 'fixture', totalPageNum: 3, hotels: Array.from({ length: 20 }, (_, j) => ({ hotelId: start + j + 1, hotelName: `fixture客栈${start + j}`, lowestPrice: 200 + start + j, brandName: 'fixture经济', meal: j % 2 ? '不含早餐' : '双早', roomWindow: '有外窗', refund: '限时免费取消', facilities: ['停车场'] })) } : { totalPageNum: 3, data: Array.from({ length: 20 }, (_, j) => ({ flightNumber: `FIX${start + j}`, airlineCompany: 'fixture航空', departureTime: '08:00', arrivalTime: '11:00', departureAirport: '虹桥', arrivalAirport: '天府', basePrice: 300 + start + j, totalTax: 70, remainingSeats: '3', type: j % 2 ? '经停' : '直飞' })) };
  }
  if (action === 'detail') return kind === 'hotel' ? { roomTypes: [{ roomTypeId: 'fixture-room', roomTypeName: 'fixture大床', bedType: '大床', maxOccupancy: 2, ratePlans: [{ preBookParam: 'private', rmbPrices: '250', mealText: '双早', cancelDesc: '免费取消' }] }] } : { cabinInfo: [{ cabinPriceId: 'private', cabinClass: '经济舱', basePrice: 330, totalTax: 70, baggageInfo: '免费托运20kg', refundChangeRule: '收费退改' }, { cabinPriceId: 'private2', cabinClass: '商务舱', basePrice: 1330, totalTax: 70, baggageInfo: '免费托运30kg', refundChangeRule: '可退' }] };
  if (action === 'requirements') return { text: 'fixture乘机须知：证件、出生日期及有效期' };
  if (action === 'book') return { orderId: 'fixture-never-real-order', paymentUrl: 'https://m.tuniu.com/pay/fixture' };
  if (action === 'cancel') return { successCode: true };
  throw new Error('unexpected fixture action');
} });
try {
  const context = await browser.newContext({ viewport: { width: 1365, height: 1000 } }); const page = await context.newPage(); page.setDefaultTimeout(30000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  // Real local endpoints, before mocking: auth is required and cross-origin writes blocked.
  const auth = await context.request.get(`${base}/api/travel/account/`); assert.equal(auth.status(), 200);
  const unauthorized = await context.request.post(`${base}/api/travel/query/`, { headers: { Origin: base }, data: { action: 'search', kind: 'hotel' } });
  assert.equal(unauthorized.status(), (await auth.json()).connected ? 400 : 401);
  const cross = await context.request.post(`${base}/api/travel/query/`, { headers: { Origin: 'https://untrusted.invalid' }, data: { action: 'orders' } }); assert.equal(cross.status(), 403);
  await page.route('**/api/travel/account/', (route) => route.fulfill({ json: connection }));
  await page.route('**/api/travel/query/', async (route) => {
    const body = route.request().postDataJSON(); let data;
    try {
      if (body.action === 'search') data = await engine.search(body, credential, body.refresh);
      else if (body.action === 'next') data = await engine.next(body.searchId, credential, body.count);
      else if (body.action === 'detail') data = await engine.detail(body.searchId, body.offerId, credential, body.refresh);
      else if (body.action === 'requirements') data = await engine.requirements(body.searchId, credential);
      else if (body.action === 'book') data = await engine.book(body, credential);
      else if (body.action === 'orders') data = engine.listOrders(credential);
      else if (body.action === 'cancel') data = await engine.cancelOrder(body, credential);
      else throw new Error('unexpected browser action');
      if (data && !Array.isArray(data)) data = { ...data, source: 'fixture', provider: 'fixture—not live verified' };
      await route.fulfill({ json: { data, connection } });
    } catch (e) { await route.fulfill({ status: e.status || 500, json: { error: e.message } }); }
  });
  await page.goto(`${base}/travel/`); await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '查询国内住宿' }).click();
  await page.getByTestId('travel-offer').nth(19).waitFor(); assert.equal(await page.getByTestId('travel-offer').count(), 20);
  await page.getByLabel('明确包含早餐', { exact: true }).check(); assert.equal(await page.getByTestId('travel-offer').count(), 10);
  await page.getByRole('button', { name: '清空筛选', exact: true }).click();
  await page.getByRole('button', { name: '继续加载最多 3 页' }).click(); await page.getByTestId('travel-offer').nth(59).waitFor();
  assert.equal(await page.getByTestId('travel-offer').count(), 60);
  await page.getByLabel('参考价最高', { exact: true }).fill('205'); assert.equal(await page.getByTestId('travel-offer').count(), 6);
  await page.getByLabel('加入比较', { exact: true }).nth(0).check(); await page.getByLabel('加入比较', { exact: true }).nth(1).check(); assert.equal(await page.getByRole('region', { name: '候选比较' }).count(), 1);
  await page.getByLabel('城市或县名', { exact: true }).fill('丽江'); assert.equal(await page.getByRole('button', { name: '查看房型与报价' }).first().isDisabled(), true);
  await page.getByLabel('城市或县名', { exact: true }).fill('成都'); await page.getByRole('button', { name: '查看房型与报价' }).first().click();
  await page.getByLabel('房型或舱位详情').waitFor(); await page.getByRole('radio').first().check();
  await page.getByLabel('联系人姓名', { exact: true }).fill('虚构测试'); await page.getByLabel('联系人手机号', { exact: true }).fill('13800000000');
  await page.getByLabel('第 1 间房入住人姓', { exact: true }).fill('虚构'); await page.getByLabel('第 1 间房入住人名', { exact: true }).fill('测试');
  assert.equal(await page.getByRole('button', { name: '确认创建未支付订单', exact: true }).isDisabled(), true);
  await page.getByLabel(/我已核对当前报价/).check(); await page.getByRole('button', { name: '确认创建未支付订单', exact: true }).click();
  await page.getByText('官方订单号：fixture-never-real-order').waitFor();
  await page.getByRole('button', { name: '国内机票', exact: true }).click();
  await page.getByRole('button', { name: '查询国内机票' }).click(); await page.getByTestId('travel-offer').nth(19).waitFor();
  await page.getByLabel('只看明确标注的直飞', { exact: true }).check(); assert.equal(await page.getByTestId('travel-offer').count(), 10);
  await page.getByRole('button', { name: '查看舱位、行李与退改' }).first().click();
  await page.getByLabel('舱等筛选', { exact: true }).selectOption('经济舱'); assert.equal(await page.getByRole('radio').count(), 1);
  await page.getByRole('button', { name: '获取官方机票预订须知' }).click(); await page.getByText('fixture乘机须知：证件、出生日期及有效期', { exact: true }).waitFor();
  await page.getByRole('radio').check(); await page.getByLabel('乘机人 1 证件类型', { exact: true }).selectOption('护照');
  await page.getByLabel('乘机人 1 出生日期', { exact: true }).waitFor(); assert.equal(await page.getByLabel('乘机人 1 证件类型', { exact: true }).inputValue(), '护照');
  await page.getByRole('button', { name: '关闭详情' }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  fs.mkdirSync('.automation', { recursive: true }); await page.screenshot({ path: '.automation/travel-mobile-fixture.png', fullPage: true });
  assert.deepEqual(errors, []); assert.equal(calls.filter((c) => c.action === 'book').length, 1);
  console.log(JSON.stringify({ passed: true, evidence: 'fixtures only; real local invalid search/auth blocked, cross-origin=403', hotelCandidates: 60, uiChecks: ['pagination', 'filters', 'compare', 'query change guard', 'confirmed fixture booking', 'flight direct', 'cabin filter', 'passport fields', 'mobile overflow', 'no browser errors'] }, null, 2));
} finally { await browser.close(); }
