// UI success is a fixture; this test never sends a real API key to DeepSeek.
import { chromium } from "playwright";
import fs from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:3010";
const executablePath = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((path) => fs.existsSync(path));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
try {
  const api = await context.request.get(`${base}/api/ai/config/`);
  assert.equal(api.status(), 200); assert.equal(api.headers()["cache-control"], "no-store");
  const actual = await api.json(); assert.equal(actual.apiKey, undefined);
  const invalid = await context.request.post(`${base}/api/ai/config/`, { data: { apiKey: "short", model: "deepseek-flash" } });
  assert.equal(invalid.status(), 400);
  const cross = await context.request.post(`${base}/api/ai/config/`, { data: {}, headers: { Origin: "https://evil.example" } });
  assert.equal(cross.status(), 403);
  const proxied = await context.request.post(`${base}/api/ai/config/`, { data: { apiKey: "short", model: "deepseek-flash" }, headers: { Origin: base, "Sec-Fetch-Site": "same-origin", "X-Forwarded-Proto": "https" } });
  assert.equal(proxied.status(), 400, "a proxy scheme mismatch must reach input validation rather than fail origin checks");
  if (!actual.configured) {
    for (const endpoint of ["trip-assistant", "planner-assistant", "planner-assistant/stream"]) {
      const response = await context.request.post(`${base}/api/${endpoint}/`, { data: { actionId: "summary", context: {}, form: {} } });
      assert.equal(response.status(), 503);
    }
  }
  console.log("Real API: redacted status, input validation, cross-origin rejection and missing-config handling passed.");
  const page = await context.newPage();
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/settings/ai/`); await page.waitForLoadState("networkidle");
  const browserSubmission = await page.evaluate(async () => {
    const response = await fetch("/api/ai/config/", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https" }, body: JSON.stringify({ apiKey: "short", model: "deepseek-flash" }) });
    return { status: response.status, data: await response.json() };
  });
  assert.equal(browserSubmission.status, 400, "a real same-origin browser submission must survive a rewritten proxy scheme");
  assert.ok(!browserSubmission.data.error.includes("跨站"));
  let status = { configured: false, provider: "DeepSeek", model: "deepseek-flash" };
  let failSave = false;
  await page.route("**/api/ai/config/", async (route) => {
    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON();
      assert.equal(payload.apiKey, "test-key-only-not-real"); assert.equal(payload.model, "deepseek-flash");
      if (failSave) return route.fulfill({ status: 401, json: { error: "DeepSeek：API Key 无效，请重新填写" } });
      status = { configured: true, provider: "DeepSeek", model: payload.model, source: "session", message: "连接成功（UI 测试响应）" };
    }
    if (route.request().method() === "DELETE") status = { configured: false, provider: "DeepSeek", model: "deepseek-flash", message: "已清除当前会话配置" };
    await route.fulfill({ json: status });
  });
  await page.goto(`${base}/settings/ai/`); await page.waitForLoadState("networkidle");
  await page.getByRole("heading", { name: "DeepSeek API 配置" }).waitFor();
  const key = page.getByLabel("DeepSeek API Key", { exact: true });
  assert.equal(await key.getAttribute("type"), "password");
  await key.fill("test-key-only-not-real");
  await page.getByRole("button", { name: "保存并检测连接" }).click();
  await page.getByText("连接成功（UI 测试响应）", { exact: true }).waitFor();
  assert.equal(await key.inputValue(), "");
  const storage = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie]));
  assert.ok(!storage.includes("test-key-only-not-real"));
  await page.reload(); await page.waitForLoadState("networkidle");
  await page.getByText("当前：DeepSeek / deepseek-flash", { exact: true }).waitFor();
  await page.getByRole("button", { name: "清除会话配置" }).click();
  await page.getByText("尚未配置 AI", { exact: true }).waitFor();
  failSave = true;
  await key.fill("test-key-only-not-real");
  await page.getByRole("button", { name: "保存并检测连接" }).click();
  await page.getByRole("alert").filter({ hasText: "API Key 无效" }).waitFor();
  await key.fill("");
  fs.mkdirSync(".automation", { recursive: true });
  await page.screenshot({ path: ".automation/ai-settings-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: ".automation/ai-settings-mobile.png", fullPage: true });
  await page.goto(`${base}/booking/`); await page.waitForLoadState("networkidle");
  await page.getByText("配置 DeepSeek API", { exact: true }).click();
  await page.getByRole("heading", { name: "DeepSeek API 配置" }).waitFor();
  await page.goto(`${base}/planner/`); await page.waitForLoadState("networkidle");
  await page.getByRole("heading", { name: "DeepSeek API 配置" }).waitFor();
  assert.deepEqual(errors, []);
  console.log("Browser: settings form, masked key, save/test/error/clear (fixtures), reload status, no key in browser storage, booking/planner entries and mobile layout passed.");
} finally { await context.close(); await browser.close(); }
