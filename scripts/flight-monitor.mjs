import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchShanghaiBeijing } from "../lib/duffel-flight-provider.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSnapshotPath = path.join(projectRoot, ".automation", "flight-monitor", "shanghai-beijing.json");

function parseArgs(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    if (!args[index].startsWith("--")) continue;
    result[args[index].slice(2)] = args[index + 1];
    index += 1;
  }
  return result;
}

async function loadLocalEnv() {
  const content = await fs.readFile(path.join(projectRoot, ".env.local"), "utf8").catch(() => "");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(DUFFEL_ACCESS_TOKEN)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2").trim();
  }
}

async function readHistory(snapshotPath) {
  const content = await fs.readFile(snapshotPath, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "{}";
    throw error;
  });
  return JSON.parse(content);
}

async function writeHistory(snapshotPath, history) {
  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
  const temporaryPath = `${snapshotPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(history, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, snapshotPath);
}

function validateDate(value) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? new Date(`${value}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("请传入有效日期，例如 --date 2026-11-14");
  }
}

function formatShanghaiTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  validateDate(args.date);
  const adults = Number(args.adults || 1);
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) throw new Error("--adults 必须是 1 到 9 的整数");
  const snapshotPath = args.store ? path.resolve(args.store) : defaultSnapshotPath;
  const isManual = args.price !== undefined;
  let source;
  let offers;

  if (isManual) {
    const amount = Number(args.price);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("--price 必须是大于 0 的报价");
    if (!args.source?.trim()) throw new Error("手动记录请提供 --source，例如 --source 携程");
    source = `manual:${args.source.trim()}`;
    offers = [{
      offerId: "",
      amount,
      currency: "CNY",
      departureAt: "",
      arrivalAt: "",
      departureAirport: "SHA",
      arrivalAirport: "BJS",
      flightNumbers: args.flight ? [args.flight] : [],
      stops: null,
      seats: null,
      sourceUrl: args.url || ""
    }];
  } else {
    await loadLocalEnv();
    if (!process.env.DUFFEL_ACCESS_TOKEN) {
      throw new Error("缺少 DUFFEL_ACCESS_TOKEN。无凭据时可用 --price 实际报价 --source 携程 手动记录。");
    }
    const result = await searchShanghaiBeijing({
      date: args.date,
      adults,
      token: process.env.DUFFEL_ACCESS_TOKEN
    });
    source = result.liveMode ? "duffel-live" : "duffel-test";
    offers = result.offers;
  }
  if (!offers.length) {
    console.log(`上海 → 北京 ${args.date}：查询成功，但数据源没有返回报价。未写入价格快照。`);
    return;
  }

  const history = await readHistory(snapshotPath);
  const key = `${args.date}|${adults}|${source}`;
  const previous = history[key]?.at(-1);
  const cheapest = offers[0];
  const snapshot = {
    checkedAt: new Date().toISOString(),
    source,
    date: args.date,
    adults,
    lowestAmount: cheapest.amount,
    currency: cheapest.currency,
    offerCount: offers.length,
    topOffers: offers.slice(0, 5)
  };
  history[key] = [...(history[key] || []), snapshot].slice(-100);
  await writeHistory(snapshotPath, history);

  const delta = previous?.currency === cheapest.currency ? cheapest.amount - previous.lowestAmount : null;
  console.log(`上海 → 北京 ${args.date}｜${adults} 位成人｜${snapshot.source}`);
  console.log(`记录时间：${formatShanghaiTime(snapshot.checkedAt)}（北京时间）｜报价数：${offers.length}`);
  console.log(`最低总价：${cheapest.currency} ${cheapest.amount.toFixed(2)}${delta === null ? "（首次记录）" : `（较上次 ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}）`}`);
  if (isManual) {
    console.log(`手动记录${cheapest.flightNumbers.length ? `｜航班 ${cheapest.flightNumbers.join("+")}` : ""}${cheapest.sourceUrl ? `｜来源 ${cheapest.sourceUrl}` : ""}`);
  } else {
    for (const offer of snapshot.topOffers) {
      console.log(`${offer.currency} ${offer.amount.toFixed(2)}｜${offer.operatingCarriers.join("、")} ${offer.flightNumbers.join("+")}｜${offer.departureAt} → ${offer.arrivalAt}｜经停 ${offer.stops}`);
    }
  }
  console.log(`历史快照：${snapshotPath}`);
  console.log("报价仅代表查询当时的搜索结果，预订前需重新验价。");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
