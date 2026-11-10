// Real supplier sandbox search only; no booking or payment.
import { chromium } from "playwright";
import fs from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:3010";
const executablePath = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((path) => fs.existsSync(path));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1365, height: 1000 } });
try {
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/booking/hotels/`); await page.waitForLoadState("networkidle");
  assert.equal(await page.getByLabel("报价币种", { exact: true }).inputValue(), "CNY");
  assert.equal(await page.getByLabel("酒店星级", { exact: true }).inputValue(), "3");
  const budget = page.getByLabel("每晚房价上限", { exact: false });
  assert.equal(await budget.inputValue(), "500");
  await budget.fill("1000");
  const ready = page.waitForResponse((r) => r.url().endsWith("/api/hotel-trial/") && r.request().method() === "POST");
  await page.getByRole("button", { name: "查询沙盒房价" }).click();
  const response = await ready; assert.equal(response.status(), 200);
  const result = await response.json(); assert.ok(result.offers.length > 0);
  for (let i = 0; i < result.offers.length; i++) {
    const offer = result.offers[i];
    assert.equal(offer.currency, "CNY"); assert.ok(offer.nightlyAmount <= 1000);
    assert.ok(offer.stars > 0 && offer.stars <= 3);
    if (i) assert.ok(result.offers[i - 1].amount <= offer.amount);
  }
  assert.equal(new Set(result.offers.map((o) => o.hotelId)).size, result.offers.length);
  const choose = page.getByRole("button", { name: "选择房型并验价", exact: true });
  await choose.first().waitFor();
  assert.ok(await page.getByText(/3 星/).count() > 0);
  fs.mkdirSync(".automation", { recursive: true });
  await page.locator('[aria-label="酒店报价列表"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".automation/hotel-filters-results.png", fullPage: false });
  await budget.fill("1");
  assert.equal(await choose.first().isEnabled(), false, "changing filters invalidates old offers");
  await page.getByRole("checkbox", { name: "只看可退款房价", exact: true }).check();
  await page.getByRole("checkbox", { name: "只看含早餐", exact: true }).check();
  const emptyReady = page.waitForResponse((r) => r.url().endsWith("/api/hotel-trial/") && r.request().method() === "POST");
  await page.getByRole("button", { name: "查询沙盒房价" }).click();
  const emptyResponse = await emptyReady; assert.equal(emptyResponse.status(), 200);
  assert.deepEqual((await emptyResponse.json()).offers, []);
  await page.getByText(/当前条件下没有符合要求/).waitFor();
  await page.reload(); await page.waitForLoadState("networkidle");
  await page.getByText(/当前条件下没有符合要求/).waitFor();
  assert.equal(await budget.inputValue(), "1");
  assert.ok(await page.getByRole("checkbox", { name: "只看含早餐", exact: true }).isChecked());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("group", { name: "价格与住宿条件" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".automation/hotel-filters-mobile.png", fullPage: false });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ provider: "LiteAPI sandbox", currency: "CNY", maxStars: 3, maxNightly: 1000, offers: result.offers.length, lowestNightly: result.offers[0].nightlyAmount, sorted: true, uniqueHotels: true, emptyFiltersHandled: true, staleOffersDisabled: true, reloadAndMobile: true }));
} finally { await context.close(); await browser.close(); }
