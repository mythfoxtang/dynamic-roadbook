// Run with a local server: node scripts/booking-ui.smoke.mjs http://127.0.0.1:3010
// Supplier success responses below are UI fixtures, never real market prices.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";

const base = process.argv[2] || "http://127.0.0.1:3010";
const browserPath = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((path) => fs.existsSync(path));
const browser = await chromium.launch({ headless: true, ...(browserPath ? { executablePath: browserPath } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  // Exercise real API validation and configuration; do not spend supplier quota.
  const status = await context.request.get(`${base}/api/bookings/providers`);
  assert.equal(status.status(), 200);
  const providers = (await status.json()).providers;
  assert.equal(providers.length, 3);
  assert.ok(!JSON.stringify(providers).includes("TOKEN"));
  for (const endpoint of ["bookings/search", "flight-price-probe", "hotel-price-probe"]) {
    const malformed = await context.request.post(`${base}/api/${endpoint}`, { data: "not json", headers: { "Content-Type": "application/json" } });
    assert.equal(malformed.status(), 400);
    const nullBody = await context.request.post(`${base}/api/${endpoint}`, { data: "null", headers: { "Content-Type": "application/json" } });
    assert.equal(nullBody.status(), 400);
  }
  const past = await context.request.post(`${base}/api/bookings/search`, { data: { kind: "flight", from: "SHA", to: "BJS", date: "2020-01-01", adults: 1 } });
  assert.equal(past.status(), 400);
  const crossOrigin = await context.request.post(`${base}/api/bookings/search`, { data: {}, headers: { Origin: "https://untrusted.example" } });
  assert.equal(crossOrigin.status(), 403);
  const large = await context.request.post(`${base}/api/bookings/search`, { data: "x".repeat(17000) });
  assert.equal(large.status(), 413);
  if (!providers.find((item) => item.kind === "hotel").configured) {
    const unavailable = await context.request.post(`${base}/api/bookings/search`, { data: { kind: "hotel", city: "丽江", startDate: "2027-06-01", endDate: "2027-06-02", adults: 2 } });
    assert.equal(unavailable.status(), 503);
    assert.equal(unavailable.headers()["cache-control"], "no-store");
  }
  console.log("Real local API: status, validation, origin, size limit, missing configuration checked.");

  await page.goto(`${base}/booking/`);
  await page.waitForLoadState("networkidle");
  assert.equal(await page.getByRole("heading", { name: "把行程变成预订" }).count(), 1);
  await page.getByRole("button", { name: "带入条件查询酒店", exact: true }).first().click();
  assert.ok(await page.getByLabel("住宿城市 / 地点", { exact: true }).inputValue());
  await page.getByRole("button", { name: /^租车 ·/ }).click();
  await page.getByRole("button", { name: "带入条件查询租车", exact: true }).click();
  assert.ok(await page.getByLabel("取车城市", { exact: true }).inputValue());
  assert.ok(await page.getByLabel("还车城市", { exact: true }).inputValue());
  await page.getByRole("button", { name: "酒店", exact: true }).click();
  await page.getByLabel("住宿城市 / 地点", { exact: true }).fill("丽江");
  await page.getByLabel("入住日期", { exact: true }).fill("2027-06-01");
  await page.getByLabel("离店日期", { exact: true }).fill("2027-06-03");

  let fixture = { kind: "hotel", provider: "UI 测试供应商", liveMode: false, query: { kind: "hotel", city: "丽江" }, searchedAt: new Date().toISOString(), notice: "测试环境报价，不能用于真实出行预订。", offers: [{ id: "fixture-1", title: "测试客房（非真实报价）", description: "仅测试交互", amount: 888, currency: "USD", priceBasis: "2 晚总价", checkoutUrl: null, expiresAt: "2027-06-01T10:00:00Z" }] };
  await page.route("**/api/bookings/search", (route) => route.fulfill({ json: fixture }));
  await page.getByRole("button", { name: "查询报价", exact: true }).click();
  await page.getByRole("heading", { name: "测试客房（非真实报价）" }).waitFor();
  assert.ok(await page.getByText("USD 888.00", { exact: true }).isVisible());
  assert.equal(await page.getByRole("link", { name: "前往供应商确认预订" }).count(), 0);
  await page.getByRole("button", { name: "保存候选", exact: true }).click();
  await page.getByText("已保存候选（1）", { exact: true }).click();
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("dynamic-roadbook-shortlist-v1")))[0].status, "selected");
  await page.reload(); await page.waitForLoadState("networkidle");
  await page.getByText("已保存候选（1）", { exact: true }).click();
  await page.getByRole("button", { name: "移除候选", exact: true }).click();
  assert.equal(await page.getByText("已保存候选（1）", { exact: true }).count(), 0);

  // Verify official checkout is visible only for an unexpired live result.
  await page.getByLabel("入住日期", { exact: true }).fill("2027-06-01");
  await page.getByLabel("离店日期", { exact: true }).fill("2027-06-03");
  fixture = { ...fixture, liveMode: true, offers: [{ ...fixture.offers[0], checkoutUrl: "https://checkout.example/fixture" }] };
  await page.getByRole("button", { name: "查询报价", exact: true }).click();
  await page.getByRole("link", { name: "前往供应商确认预订" }).waitFor();
  // Editing conditions clears results and prevents buying an offer for old dates.
  await page.getByLabel("入住日期", { exact: true }).fill("2027-06-02");
  assert.equal(await page.getByRole("link", { name: "前往供应商确认预订" }).count(), 0);

  fixture = { ...fixture, offers: [] };
  await page.getByRole("button", { name: "查询报价", exact: true }).click();
  await page.getByText(/此条件下未返回报价/).waitFor();
  await page.unroute("**/api/bookings/search");
  await page.route("**/api/bookings/search", (route) => route.fulfill({ status: 502, json: { error: "测试供应商超时" } }));
  await page.getByRole("button", { name: "查询报价", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "测试供应商超时" }).waitFor();

  // Persist an order as a user record, with no supplier order creation.
  await page.getByRole("button", { name: /^酒店 ·/ }).click();
  const card = page.locator("article").first();
  await card.getByPlaceholder("例如：酒店确认号、航班订单号").fill("UI-TEST-ORDER");
  await card.getByRole("button", { name: "已预订（手动记录）", exact: true }).click();
  await page.reload(); await page.waitForLoadState("networkidle");
  assert.equal(await page.getByPlaceholder("例如：酒店确认号、航班订单号").first().inputValue(), "UI-TEST-ORDER");
  await page.locator("article").first().getByRole("button", { name: "重置", exact: true }).click();
  fs.mkdirSync(".automation", { recursive: true });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: ".automation/booking-desktop.png", fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "租车", exact: true }).click();
  await page.screenshot({ path: ".automation/booking-mobile.png", fullPage: false });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "mobile horizontal overflow");
  assert.deepEqual(errors, []);
  console.log("Browser: task prefilling, hotel/car tabs, test/live quotes (fixtures), native currency, shortlist persistence, stale result clearing, empty/error states, manual order persistence, and mobile width passed.");
} finally {
  await context.close(); await browser.close();
}
