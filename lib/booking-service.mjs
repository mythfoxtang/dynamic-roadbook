import { normalizeDuffelOffers } from "./duffel-flight-provider.mjs";

export class BookingError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const CITY_CODES = { 上海: "SHA", 北京: "BJS", 成都: "CTU", 昆明: "KMG", 丽江: "LJG", 大理: "DLU", 拉萨: "LXA", 重庆: "CKG", 广州: "CAN", 深圳: "SZX", 杭州: "HGH", 西安: "SIA", 乌鲁木齐: "URC", 喀什: "KHG", 香格里拉: "DIG" };
function text(value, name) {
  if (typeof value !== "string" || !value.trim() || value.length > 100) throw new BookingError(`请填写有效的${name}`);
  return value.trim();
}
function date(value, name, today) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new BookingError(`${name}格式无效`);
  if (value < today) throw new BookingError(`${name}已过期，请选择今天或之后的日期`);
  return value;
}
export function validateSearch(body, now = new Date()) {
  if (!body || !["flight", "hotel", "car"].includes(body.kind)) throw new BookingError("请选择机票、酒店或租车");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const adults = body.adults === undefined ? 1 : Number(body.adults);
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) throw new BookingError("成人数须为 1 至 9 人");
  const result = { kind: body.kind, adults };
  if (body.kind === "flight") {
    result.from = text(body.from, "出发城市 / 机场"); result.to = text(body.to, "到达城市 / 机场");
    if (result.from.toUpperCase() === result.to.toUpperCase()) throw new BookingError("出发地和到达地不能相同");
    result.date = date(body.date, "出发日期", today);
  } else {
    result.city = text(body.city, body.kind === "hotel" ? "住宿城市" : "取车城市");
    result.startDate = date(body.startDate, body.kind === "hotel" ? "入住日期" : "取车日期", today);
    result.endDate = date(body.endDate, body.kind === "hotel" ? "离店日期" : "还车日期", today);
    if (result.endDate <= result.startDate) throw new BookingError("结束日期必须晚于开始日期");
    if (body.kind === "car") result.returnCity = text(body.returnCity, "还车城市");
  }
  return result;
}

function configured(value) { return Boolean(value && !/^(your_|example)/i.test(value)); }
export function providerStatus(env = process.env) {
  const gateway = configured(env.BOOKING_GATEWAY_URL) && configured(env.BOOKING_GATEWAY_TOKEN);
  return ["flight", "hotel", "car"].map((kind) => ({ kind, configured: gateway || (kind === "flight" && configured(env.DUFFEL_ACCESS_TOKEN)), provider: gateway ? "合作供应商网关" : kind === "flight" && configured(env.DUFFEL_ACCESS_TOKEN) ? "Duffel" : null }));
}
function airport(value) {
  const code = CITY_CODES[value] || value.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new BookingError(`暂未识别“${value}”，请填写三位 IATA 城市或机场代码`);
  return code;
}
function safeCheckout(value, env) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const allowed = (env.BOOKING_CHECKOUT_HOSTS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return url.protocol === "https:" && !url.username && !url.password && allowed.includes(url.hostname.toLowerCase()) ? url.href : null;
  } catch { return null; }
}

export async function searchBookings(query, { env = process.env, fetchImpl = fetch } = {}) {
  const status = providerStatus(env).find((item) => item.kind === query.kind);
  if (!status?.configured) throw new BookingError("该类预订尚未配置报价接口。可先前往携程查询和预订，返回后手动记录确认号。", 503);
  let offers, liveMode, provider;
  if (status.provider === "合作供应商网关") {
    let url;
    try { url = new URL(env.BOOKING_GATEWAY_URL); } catch { throw new BookingError("供应商网关配置无效", 503); }
    if (url.protocol !== "https:" || url.username || url.password) throw new BookingError("供应商网关必须使用 HTTPS", 503);
    url.pathname = `${url.pathname.replace(/\/$/, "")}/search`;
    url.search = "";
    const response = await fetchImpl(url, { method: "POST", headers: { Authorization: `Bearer ${env.BOOKING_GATEWAY_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(query), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(35000) });
    if (!response.ok) throw new BookingError(`供应商查询失败（${response.status}），请稍后重试`, 502);
    const data = await response.json();
    if (!Array.isArray(data.offers) || typeof data.liveMode !== "boolean" || typeof data.provider !== "string" || !data.provider.trim()) throw new BookingError("供应商响应缺少报价、来源或测试环境标识", 502);
    liveMode = data.liveMode; provider = data.provider.slice(0, 100);
    offers = data.offers.slice(0, 50).map((offer) => {
      if (!offer || typeof offer.id !== "string" || !offer.id || typeof offer.title !== "string" || !offer.title || typeof offer.amount !== "number" || !Number.isFinite(offer.amount) || offer.amount < 0 || !/^[A-Z]{3}$/.test(offer.currency)) throw new BookingError("供应商报价格式无效", 502);
      return { id: offer.id.slice(0, 200), title: offer.title.slice(0, 300), description: typeof offer.description === "string" ? offer.description.slice(0, 1500) : "", amount: offer.amount, currency: offer.currency, priceBasis: typeof offer.priceBasis === "string" ? offer.priceBasis.slice(0, 100) : "请向供应商确认计价范围", expiresAt: typeof offer.expiresAt === "string" && Number.isFinite(Date.parse(offer.expiresAt)) ? offer.expiresAt : null, checkoutUrl: liveMode ? safeCheckout(offer.checkoutUrl, env) : null };
    });
  } else {
    provider = "Duffel";
    const origin = airport(query.from), destination = airport(query.to);
    if (origin === destination) throw new BookingError("出发地和到达地对应同一城市 / 机场");
    const response = await fetchImpl("https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=20000", {
      method: "POST", headers: { Authorization: `Bearer ${env.DUFFEL_ACCESS_TOKEN}`, "Duffel-Version": "v2", Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ data: { slices: [{ origin, destination, departure_date: query.date }], passengers: Array.from({ length: query.adults }, () => ({ type: "adult" })), cabin_class: "economy" } }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(35000)
    });
    if (!response.ok) throw new BookingError(`Duffel 查询失败（${response.status}），请检查接口权限或稍后重试`, 502);
    const data = await response.json();
    if (!Array.isArray(data?.data?.offers) || typeof data?.data?.live_mode !== "boolean") throw new BookingError("Duffel 报价响应不完整", 502);
    liveMode = data.data.live_mode;
    const normalized = normalizeDuffelOffers(data.data.offers);
    if (normalized.length !== data.data.offers.length || normalized.some((offer) => !offer.offerId || offer.amount < 0 || !/^[A-Z]{3}$/.test(offer.currency))) throw new BookingError("Duffel 报价缺少有效的标识、金额或币种", 502);
    offers = normalized.slice(0, 50).map((offer) => ({ id: offer.offerId, title: `${offer.operatingCarriers.join(" / ")} ${offer.flightNumbers.join(" / ")}`, description: `${offer.departureAirport} ${offer.departureAt} → ${offer.arrivalAirport} ${offer.arrivalAt}；中转 ${offer.stops} 次`, amount: offer.amount, currency: offer.currency, priceBasis: `${query.adults} 位成人含税总价`, expiresAt: offer.expiresAt && Number.isFinite(Date.parse(offer.expiresAt)) ? offer.expiresAt : null, checkoutUrl: null }));
  }
  return { kind: query.kind, query, provider, liveMode, searchedAt: new Date().toISOString(), offers, notice: liveMode ? "报价及库存以供应商确认时为准；打开预订页不会自动完成下单。" : "测试环境报价，不能用于真实出行预订。" };
}
