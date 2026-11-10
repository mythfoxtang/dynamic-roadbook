// Actual official inventory via local webpage. Explicitly blocks trading actions.
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:3012';
const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const report = { source: 'real Tuniu official inventory through local UI', startedAt: new Date().toISOString(), noOrdersOrPayments: true, cases: [] };
try {
  const context = await browser.newContext({ viewport: { width: 1365, height: 1000 } }); const page = await context.newPage(); const errors = [];
  page.setDefaultTimeout(60000); page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/travel/query/', async (route) => {
    if (['book', 'cancel'].includes(route.request().postDataJSON()?.action)) throw new Error('Read-only smoke test blocks all trading');
    await route.continue();
  });
  async function ready() {
    for (;;) { const r = await context.request.get(`${base}/api/travel/account/`); const c = await r.json(); assert.equal(c.connected, true); const wait = c.quota?.retryAfter || 0;
      if (!wait) return;
      console.log(`UI read-only test waiting for supplier quota: ${wait}s`); await new Promise((r) => setTimeout(r, Math.min(55, wait + 1) * 1000));
    }
  }
  async function clickRequest(locator, expectedAction) {
    await ready(); const pending = page.waitForResponse((r) => r.url().endsWith('/api/travel/query/') && r.request().postDataJSON()?.action === expectedAction);
    await locator.click(); const response = await pending; const body = await response.json(); return { response, body };
  }
  await page.goto(`${base}/travel/`); await page.waitForLoadState('networkidle');
  const low = page.getByLabel('搜索价格下限', { exact: true });
  if (await low.count()) await low.fill('200');
  let r = await clickRequest(page.getByRole('button', { name: '查询国内住宿', exact: true }), 'search'); assert.equal(r.response.status(), 200); assert.equal(r.body.data.source, 'live');
  const first = r.body.data; assert.ok(first.count > 0);
  if (!first.complete && first.totalPages > 1) { r = await clickRequest(page.getByRole('button', { name: /^加载下一页/ }), 'next'); assert.equal(r.response.status(), 200); }
  const hotel = r.body.data; const cards = page.getByTestId('travel-offer'); const displayed = await cards.count();
  assert.equal(displayed, hotel.offers.filter((o) => o.price !== null && o.price <= 300).length);
  report.cases.push({ kind: 'hotel', city: '成都', loadedCandidates: hotel.count, budgetCandidates: displayed, loadedPages: hotel.loadedPages, totalPages: hotel.totalPages, queryDate: hotel.query.startDate });
  r = await clickRequest(page.getByRole('button', { name: '查看房型与报价' }).first(), 'detail'); assert.equal(r.response.status(), 200); assert.ok(r.body.data.options.length);
  assert.equal(JSON.stringify(r.body).includes('preBookParam'), false); report.cases[0].roomRateOptions = r.body.data.options.length;
  await page.getByRole('button', { name: '关闭详情', exact: true }).click();
  await page.getByRole('button', { name: '国内机票', exact: true }).click();
  r = await clickRequest(page.getByRole('button', { name: '查询国内机票', exact: true }), 'search'); assert.equal(r.response.status(), 200); assert.equal(r.body.data.source, 'live'); assert.ok(r.body.data.count > 0);
  const flight = r.body.data; report.cases.push({ kind: 'flight', from: flight.query.from, to: flight.query.to, count: flight.count, queryDate: flight.query.date });
  await page.getByLabel('只看明确标注的直飞', { exact: true }).check(); assert.equal(await cards.count(), flight.offers.filter((o) => o.type === '直飞').length);
  r = await clickRequest(page.getByRole('button', { name: '查看舱位、行李与退改' }).first(), 'detail'); assert.equal(r.response.status(), 200); assert.ok(r.body.data.options.length); report.cases[1].cabinOptions = r.body.data.options.length;
  r = await clickRequest(page.getByRole('button', { name: '获取官方机票预订须知', exact: true }), 'requirements'); assert.equal(r.response.status(), 200); assert.ok(r.body.data.text);
  fs.mkdirSync('.automation', { recursive: true }); await page.getByLabel('房型或舱位详情').scrollIntoViewIfNeeded(); await page.screenshot({ path: '.automation/travel-live-flight.png', fullPage: false });
  await page.getByRole('button', { name: '国内住宿', exact: true }).click(); await page.getByLabel('城市或县名', { exact: true }).fill('香格里拉');
  r = await clickRequest(page.getByRole('button', { name: '查询国内住宿', exact: true }), 'search'); assert.equal(r.response.status(), 200); assert.ok(r.body.data.count); report.cases.push({ kind: 'hotel', city: '香格里拉', count: r.body.data.count, verifiedPrefectureHandling: true });
  await page.screenshot({ path: '.automation/travel-live-hotels.png', fullPage: false });
  await page.getByLabel('城市或县名', { exact: true }).fill('芒康'); r = await clickRequest(page.getByRole('button', { name: '查询国内住宿', exact: true }), 'search');
  assert.equal(r.body.code, 'CITY_MISMATCH'); await page.getByRole('alert').filter({ hasText: '上海' }).waitFor(); report.cases.push({ kind: 'hotel', city: '芒康', expectedFailure: 'CITY_MISMATCH', wrongCityNotDisplayedAsNewResult: true });
  assert.deepEqual(errors, []); report.passed = true; report.finishedAt = new Date().toISOString(); fs.writeFileSync('.automation/travel-ui-live-report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
