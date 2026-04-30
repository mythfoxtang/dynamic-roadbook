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
  const targetDir = customDir || path.join(process.cwd(), ".automation", "edge-ctrip-flight");
  fs.mkdirSync(targetDir, { recursive: true });
  return targetDir;
}

function dedupeNumbers(values) {
  return [...new Set(values.filter((value) => Number.isFinite(value)))];
}

function computePriceSummary(prices) {
  const sorted = dedupeNumbers(prices).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const min = sorted[0];
  const mid = sorted[Math.floor(sorted.length / 2)];
  const high = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))];
  return { min, mid, high, sampleCount: sorted.length };
}

function computeRisk(summary) {
  if (!summary) return "高";
  if (summary.sampleCount < 3 || summary.min >= 1800) return "高";
  if (summary.min >= 1200 || summary.mid >= 1600) return "中";
  return "低";
}

const CITY_CODE_MAP = {
  上海: "SHA",
  北京: "BJS",
  广州: "CAN",
  深圳: "SZX",
  成都: "CTU",
  重庆: "CKG",
  杭州: "HGH",
  南京: "NKG",
  西安: "SIA",
  昆明: "KMG",
  丽江: "LJG",
  香格里拉: "DIG",
  迪庆: "DIG",
  拉萨: "LXA",
  日喀则: "RKZ",
  阿里: "NGQ",
  喀什: "KHG",
  塔县: "HQL",
  塔什库尔干: "HQL",
  库车: "KCA",
  伊宁: "YIN",
  博乐: "BPL",
  乌鲁木齐: "URC"
};

function normalizeCityCode(value) {
  const text = String(value || "").trim();
  if (/^[A-Za-z]{3}$/.test(text)) return text.toUpperCase();
  return CITY_CODE_MAP[text] || text;
}

function buildCtripFlightUrl(input) {
  const from = encodeURIComponent(normalizeCityCode(input.from));
  const to = encodeURIComponent(normalizeCityCode(input.to));
  const date = encodeURIComponent(input.date);
  return `https://flights.ctrip.com/online/list/oneway-${from}-${to}?depdate=${date}`;
}

async function dismissCommonPopups(page) {
  const selectors = ["text=知道了", "text=我知道了", "text=以后再说", "text=暂不开启", "text=关闭", "text=取消"];
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout: 700 });
      await locator.click();
      return true;
    } catch {
      // Try next selector.
    }
  }
  return false;
}

async function waitForResults(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(3500);
  await dismissCommonPopups(page);
  await page.waitForTimeout(2500);
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
}

function normalizeTime(value) {
  const match = String(value || "").match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

async function scrapeFlightProbe(page, input) {
  return page.evaluate((context) => {
    const bodyText = document.body?.innerText || "";
    const hasLoginText = /登录|验证码|验证|请先登录|安全校验/.test(bodyText);
    const pricePattern = /[¥￥]\s*(\d{2,5})|(\d{2,5})\s*(?:起|元)/g;
    const allPrices = [...bodyText.matchAll(pricePattern)]
      .map((item) => Number(item[1] || item[2]))
      .filter((price) => price >= 200 && price <= 10000);

    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    };

    const candidateSelectors = [
      '[class*="flight"]',
      '[class*="Flight"]',
      '[class*="card"]',
      '[class*="Card"]',
      '[class*="list"] > div',
      '[data-testid*="flight"]'
    ];

    const candidateElements = [...new Set(candidateSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]))]
      .filter(visible)
      .filter((element) => {
        const text = element.innerText || "";
        return text.length >= 25 && text.length <= 1200 && /[¥￥]\s*\d{2,5}|\d{2,5}\s*(?:起|元)/.test(text) && /\d{1,2}:\d{2}/.test(text);
      })
      .slice(0, 80);

    const parseCard = (element, index) => {
      const text = (element.innerText || "").replace(/\s+/g, " ").trim();
      const lines = (element.innerText || "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      const price = [...text.matchAll(pricePattern)]
        .map((item) => Number(item[1] || item[2]))
        .filter((value) => value >= 200 && value <= 10000)
        .sort((a, b) => a - b)[0] || null;
      const times = [...text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)].map((item) => `${item[1].padStart(2, "0")}:${item[2]}`);
      const flightNo = (text.match(/\b(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])[A-Z0-9]?\s?\d{3,4}\b/i)?.[0] || "").replace(/\s+/g, "");
      const airline =
        lines.find((line) => /航空|航司|Airlines|Airways/i.test(line) && line.length <= 28) ||
        text.match(/[\u4e00-\u9fa5A-Za-z]{2,16}(?:航空|航司|Airlines|Airways)/)?.[0] ||
        "";
      const duration = text.match(/(?:约)?\d+\s*(?:小时|h|H)(?:\s*\d+\s*(?:分钟|min))?/)?.[0] || "";
      const stopInfo = text.match(/直飞|经停[^ ]{0,12}|中转[^ ]{0,12}|转机[^ ]{0,12}/)?.[0] || "";
      const airportLines = lines.filter((line) => /机场|航站楼|T\d|国际|虹桥|浦东|首都|大兴|天府|双流|白云|宝安|萧山|禄口|咸阳|地窝堡|喀什|贡嘎|三义|江北/.test(line));

      return {
        id: `${context.from}-${context.to}-${context.date}-${index}`,
        airline,
        flightNo,
        departureTime: times[0] || "",
        arrivalTime: times[1] || "",
        departureAirport: airportLines[0] || "",
        arrivalAirport: airportLines[1] || "",
        duration,
        stopInfo: stopInfo || (text.includes("中转") ? "中转" : text.includes("经停") ? "经停" : text.includes("直飞") ? "直飞" : ""),
        price,
        rawText: text.slice(0, 260)
      };
    };

    const flights = candidateElements
      .map(parseCard)
      .filter((flight) => flight.price && (flight.departureTime || flight.arrivalTime || flight.flightNo))
      .filter((flight, index, list) => {
        const key = [flight.flightNo, flight.departureTime, flight.arrivalTime, flight.price].join("|");
        return list.findIndex((item) => [item.flightNo, item.departureTime, item.arrivalTime, item.price].join("|") === key) === index;
      })
      .slice(0, 20);

    return {
      title: document.title || "",
      currentUrl: location.href,
      from: context.from,
      to: context.to,
      date: context.date,
      isListPage: /\/online\/list\//.test(location.href),
      prices: flights.length ? flights.map((flight) => flight.price).filter(Boolean) : allPrices.slice(0, 160),
      flights,
      hasLoginText,
      bodySample: bodyText.slice(0, 500)
    };
  }, input);
}

async function runFlightFlow(input) {
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
  const searchUrl = buildCtripFlightUrl(input);

  console.log(`Opening Ctrip flight search from="${input.from}" to="${input.to}" date="${input.date}"`);
  console.log(`Using persistent browser profile: ${userDataDir}`);
  await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

  if (!input.probe) {
    console.log("The browser will remain open for manual takeover.");
    return { ok: true, currentUrl: page.url() };
  }

  await waitForResults(page);
  const scraped = await scrapeFlightProbe(page, input);
  const usablePrices = scraped.isListPage ? scraped.prices : [];
  const summary = computePriceSummary(usablePrices);
  const result = {
    ok: !!summary,
    title: scraped.title,
    currentUrl: scraped.currentUrl,
    from: input.from,
    to: input.to,
    date: input.date,
    minPrice: summary?.min ?? null,
    referencePrice: summary?.mid ?? null,
    maxPrice: summary?.high ?? null,
    sampleCount: summary?.sampleCount ?? 0,
    flightCount: scraped.flights.length,
    flights: scraped.flights,
    risk: computeRisk(summary),
    needsLogin: scraped.hasLoginText || !summary,
    reason: summary
      ? scraped.flights.length
        ? "抓到当前携程航班列表和价格摘要"
        : "抓到价格摘要，但航班卡片结构不稳定，未能稳定拆出航班明细"
      : scraped.isListPage
        ? "未能稳定抓到机票价格，可能需要登录、验证，或携程页面结构发生变化"
        : "携程未进入航班列表页，通常是城市代码缺失、路线不支持或页面被重定向"
  };

  await context.close();
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = {
    from: args.from || "",
    to: args.to || "",
    date: args.date || "",
    browser: args.browser || "",
    userDataDir: args.userDataDir || "",
    probe: Boolean(args.probe),
    headless: !args["show-browser"]
  };

  if (!input.from || !input.to || !input.date) {
    console.error("Missing required arguments: --from --to --date");
    process.exit(1);
  }

  const result = await runFlightFlow(input);
  if (input.probe) {
    console.log(JSON.stringify(result));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
