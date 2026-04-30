import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

function parseArgs(argv) {
  const parsed = {};

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    i += 1;
  }

  return parsed;
}

function getBrowserPath(preferred) {
  const candidates = preferred
    ? [preferred]
    : [
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      ];

  return candidates.find((filePath) => fs.existsSync(filePath)) || null;
}

function getAutomationUserDataDir(customDir) {
  const targetDir = customDir || path.join(process.cwd(), ".automation", "edge-ctrip");
  fs.mkdirSync(targetDir, { recursive: true });
  return targetDir;
}

function parseDateParts(dateText) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText || "");
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function computePriceSummary(prices) {
  const sorted = [...prices].sort((a, b) => a - b);
  if (!sorted.length) return null;

  const min = sorted[0];
  const mid = sorted[Math.floor(sorted.length / 2)];
  const max = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))];

  return { min, mid, max, sampleCount: sorted.length };
}

function computeRisk(summary) {
  if (!summary) return "高";
  if (summary.sampleCount < 5 || summary.min >= 900) return "高";
  if (summary.min >= 600 || summary.mid >= 800) return "中";
  return "低";
}

function collectPrices(text) {
  return [...String(text || "").matchAll(/[¥￥]\s*(\d{2,5})|(\d{2,5})\s*(?:起|每晚|\/间|元)/g)]
    .map((item) => Number(item[1] || item[2]))
    .filter((price) => Number.isFinite(price) && price >= 100 && price <= 5000);
}

async function clickFirstVisible(page, selectors, timeout = 1200) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout });
      await locator.click();
      return true;
    } catch {
      // Try next selector.
    }
  }

  return false;
}

async function fillFirstVisible(page, selectors, value, timeout = 1600) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout });
      await locator.click({ clickCount: 3 });
      await locator.fill(value);
      return true;
    } catch {
      // Try next selector.
    }
  }

  return false;
}

async function dismissCommonPopups(page) {
  await clickFirstVisible(page, ["text=知道了", "text=我知道了", "text=以后再说", "text=暂不开启", "text=关闭", "text=取消"], 900);
}

async function fillDestination(page, keyword) {
  const ok = await fillFirstVisible(
    page,
    ['input[placeholder*="目的地"]', 'input[placeholder*="酒店"]', 'input[placeholder*="城市"]', 'input[placeholder*="景点"]', 'input[placeholder*="商圈"]'],
    keyword,
    2600
  );

  if (!ok) return false;

  await page.keyboard.press("Control+A").catch(() => {});
  await page.keyboard.type(keyword, { delay: 50 }).catch(() => {});
  await page.waitForTimeout(1200);

  const picked = await clickFirstVisible(page, [`text=${keyword}`, '[class*="suggest"] li', '[class*="autocomplete"] li', '[role="option"]'], 2200);
  if (!picked) await page.keyboard.press("Enter").catch(() => {});
  return true;
}

async function openDatePanel(page) {
  return clickFirstVisible(
    page,
    ['input[placeholder*="入住"]', 'input[placeholder*="离店"]', 'input[placeholder*="日期"]', 'div:has-text("入住")', 'div:has-text("离店")', 'span:has-text("入住")', 'span:has-text("离店")'],
    1500
  );
}

async function setDateInputsDirectly(page, checkIn, checkOut) {
  return page.evaluate(
    ({ nextCheckIn, nextCheckOut }) => {
      const visibleInputs = [...document.querySelectorAll("input")].filter((input) => {
        const text = `${input.placeholder || ""} ${input.getAttribute("data-testid") || ""} ${input.name || ""}`;
        const style = window.getComputedStyle(input);
        return style.visibility !== "hidden" && style.display !== "none" && text;
      });

      const setValue = (input, value) => {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        nativeSetter?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("blur", { bubbles: true }));
      };

      const checkInInput = visibleInputs.find((input) => /入住|checkin|date/i.test(`${input.placeholder || ""} ${input.name || ""} ${input.getAttribute("data-testid") || ""}`));
      const checkOutInput = visibleInputs.find((input) => /离店|退房|checkout|date/i.test(`${input.placeholder || ""} ${input.name || ""} ${input.getAttribute("data-testid") || ""}`) && input !== checkInInput);

      if (!checkInInput && !checkOutInput) return false;
      if (checkInInput) setValue(checkInInput, nextCheckIn);
      if (checkOutInput) setValue(checkOutInput, nextCheckOut);
      return true;
    },
    { nextCheckIn: checkIn, nextCheckOut: checkOut }
  );
}

async function calendarHasTargetMonth(page, year, month) {
  const patterns = [`${year}年${month}月`, `${year}.${month}`, `${month}月`];

  for (const pattern of patterns) {
    const locator = page.locator(`text=${pattern}`).first();
    if (await locator.isVisible().catch(() => false)) return true;
  }

  return false;
}

async function moveCalendarMonth(page) {
  return clickFirstVisible(page, ['button[aria-label*="下"]', 'button[title*="下"]', '[class*="next"]', '[class*="arrow-right"]', "text=下个月", "text=下一月"], 1000);
}

async function clickCalendarDay(page, day) {
  const selectors = [`button:has-text("${day}")`, `td:has-text("${day}")`, `div:has-text("${day}")`, `span:has-text("${day}")`];

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout: 900 });
      const text = (await locator.textContent())?.trim() || "";
      if (text !== String(day)) continue;
      await locator.click();
      return true;
    } catch {
      // Try next selector.
    }
  }

  return false;
}

async function selectDateFromCalendar(page, dateText) {
  const parts = parseDateParts(dateText);
  if (!parts) return false;

  for (let i = 0; i < 16; i += 1) {
    if (await calendarHasTargetMonth(page, parts.year, parts.month)) {
      return clickCalendarDay(page, parts.day);
    }

    const moved = await moveCalendarMonth(page);
    if (!moved) break;
    await page.waitForTimeout(500);
  }

  return false;
}

async function fillDates(page, checkIn, checkOut) {
  if (!checkIn || !checkOut) return false;

  const direct = await setDateInputsDirectly(page, checkIn, checkOut);
  await page.waitForTimeout(400);

  const directLooksGood = await page
    .evaluate(
      ({ nextCheckIn, nextCheckOut }) => {
        const values = [...document.querySelectorAll("input")].map((input) => input.value || "");
        return values.includes(nextCheckIn) || values.includes(nextCheckOut);
      },
      { nextCheckIn: checkIn, nextCheckOut: checkOut }
    )
    .catch(() => false);

  if (direct && directLooksGood) {
    return true;
  }

  const opened = await openDatePanel(page);
  if (!opened) return false;

  await page.waitForTimeout(800);
  const checkInPicked = await selectDateFromCalendar(page, checkIn);
  await page.waitForTimeout(500);
  const checkOutPicked = await selectDateFromCalendar(page, checkOut);
  return checkInPicked || checkOutPicked;
}

async function submitSearch(page) {
  const clicked = await clickFirstVisible(page, ["text=搜索", "text=查找酒店", 'button:has-text("搜索")', '[data-testid*="search"]'], 2000);
  if (!clicked) await page.keyboard.press("Enter").catch(() => {});
}

async function waitForResults(page) {
  await page.waitForTimeout(3000);
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(2500);
}

async function scrapeHotelProbe(page, input) {
  return page.evaluate((context) => {
    const bodyText = document.body?.innerText || "";
    const title = document.title || "";
    const hasLoginText = /登录|验证码|验证|请先登录/.test(bodyText);
    const containsKeyword = [context.keyword, context.city].filter(Boolean).some((value) => bodyText.includes(value) || title.includes(value));
    const selectorBuckets = [
      '[data-testid*="price"]',
      '[class*="price"]',
      '[class*="Price"]',
      '[class*="hotel"] [class*="amount"]',
      '[class*="room"] [class*="amount"]'
    ];

    const visibleTexts = selectorBuckets.flatMap((selector) =>
      [...document.querySelectorAll(selector)]
        .filter((element) => {
          const style = window.getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden";
        })
        .map((element) => element.textContent || "")
    );

    const nearbyTexts = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const text = element.textContent || "";
        return style.display !== "none" && style.visibility !== "hidden" && text.length > 0 && text.length < 80 && /[¥￥]/.test(text);
      })
      .map((element) => element.textContent || "");

    const prices = [...visibleTexts, ...nearbyTexts, bodyText].flatMap((text) =>
      [...String(text).matchAll(/[¥￥]\s*(\d{2,5})|(\d{2,5})\s*(?:起|每晚|\/间|元)/g)]
        .map((item) => Number(item[1] || item[2]))
        .filter((price) => price >= 100 && price <= 5000)
    );

    return {
      title,
      currentUrl: location.href,
      keyword: context.keyword,
      city: context.city,
      checkIn: context.checkIn,
      checkOut: context.checkOut,
      prices: prices.slice(0, 160),
      hasLoginText,
      containsKeyword
    };
  }, input);
}

async function runCtripHotelFlow(input) {
  const browserPath = getBrowserPath(input.browser);
  if (!browserPath) throw new Error("No local Edge or Chrome executable was found.");

  const userDataDir = getAutomationUserDataDir(input.userDataDir);
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: browserPath,
    headless: input.probe ? !!input.headless : false,
    args: ["--disable-geolocation", "--disable-notifications", "--start-maximized"],
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    viewport: input.probe ? { width: 1440, height: 960 } : null
  });

  const page = context.pages().length ? context.pages()[0] : await context.newPage();

  console.log(`Opening Ctrip hotel search with keyword="${input.keyword}", city="${input.city}", checkIn="${input.checkIn}", checkOut="${input.checkOut}"`);
  console.log(`Using persistent browser profile: ${userDataDir}`);

  await page.goto("https://hotels.ctrip.com/hotels", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await dismissCommonPopups(page);

  const destinationOk = await fillDestination(page, input.keyword);
  await page.waitForTimeout(1000);
  const datesOk = await fillDates(page, input.checkIn, input.checkOut);
  await page.waitForTimeout(800);
  await submitSearch(page);

  if (!input.probe) {
    console.log(destinationOk ? "Automation filled the destination field." : "Could not reliably locate the destination field.");
    console.log(datesOk ? "Automation handled the date fields or calendar." : "Date automation was not fully reliable. Browser left open for manual takeover.");
    console.log("The browser will remain open. Complete login or booking manually if needed, then close it yourself.");
    return { destinationOk, datesOk };
  }

  await waitForResults(page);
  const scraped = await scrapeHotelProbe(page, input);
  const prices = [...new Set(scraped.prices)];
  const summary = scraped.containsKeyword ? computePriceSummary(prices) : null;
  const result = {
    ok: !!summary,
    destinationOk,
    datesOk,
    title: scraped.title,
    currentUrl: scraped.currentUrl,
    keyword: input.keyword,
    city: input.city,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    minPrice: summary?.min ?? null,
    referencePrice: summary?.mid ?? null,
    maxPrice: summary?.max ?? null,
    sampleCount: summary?.sampleCount ?? 0,
    risk: computeRisk(summary),
    needsLogin: scraped.hasLoginText || !summary,
    reason: summary
      ? "抓到当前查询结果页的价格摘要"
      : scraped.containsKeyword
        ? "结果页价格节点不稳定，暂时没有提取到可靠价格"
        : "结果页没有稳定落到当前城市或关键词，已放弃返回伪价格"
  };

  await context.close();
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = {
    keyword: args.keyword || args.location || "",
    city: args.city || "",
    checkIn: args.checkin || "",
    checkOut: args.checkout || "",
    browser: args.browser || "",
    userDataDir: args.userDataDir || "",
    probe: Boolean(args.probe),
    headless: !args["show-browser"]
  };

  if (!input.keyword) {
    console.error("Missing required argument: --keyword");
    process.exit(1);
  }

  const result = await runCtripHotelFlow(input);
  if (input.probe) {
    console.log(JSON.stringify(result));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
