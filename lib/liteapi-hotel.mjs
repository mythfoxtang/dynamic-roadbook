import { randomUUID } from "node:crypto";

// Published for sandbox development by LiteAPI in its official coding guide.
const PUBLIC_SANDBOX_KEY = "sand_ca230deb-5a6b-42e7-bb72-869facd8892b";
export class HotelError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function sandboxKey(env = process.env) {
  const key = env.LITEAPI_SANDBOX_KEY || PUBLIC_SANDBOX_KEY;
  if (!/^(sand_|sandbox_)/.test(key)) throw new HotelError("试订入口只接受沙盒 Key，已阻止正式交易", 503);
  return key;
}
export async function liteApi(path, body, { env = process.env, fetchImpl = fetch, booking = false } = {}) {
  const key = sandboxKey(env);
  const base = booking ? "https://book.liteapi.travel/v3.0" : "https://api.liteapi.travel/v3.0";
  let response;
  try {
    response = await fetchImpl(`${base}${path}`, { method: body ? "POST" : "GET", headers: { "X-API-Key": key, Accept: "application/json", "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(45000) });
  } catch { throw new HotelError("供应商请求超时或网络不可用；订单提交后请勿重复提交", 502); }
  const result = await response.json().catch(() => null);
  if (result?.error?.code === 2001) return { data: [], hotels: [], sandbox: true };
  if (!response.ok || result?.error || !result) throw new HotelError(`LiteAPI 查询或交易失败（${result?.error?.code || response.status}），请检查测试 Key、房态或稍后重试`, response.status === 401 ? 401 : 502);
  return result;
}
function rateSummary(room) {
  const rate = room.rates?.[0];
  const total = room.offerRetailRate || rate?.retailRate?.total?.[0];
  const amount = Number(total?.amount);
  if (!rate || !total || !Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(total.currency)) throw new HotelError("供应商缺少有效的金额或币种", 502);
  return { amount, currency: total.currency, roomName: rate.name || "房型待确认", board: rate.boardName || "餐食待确认", refundable: rate.cancellationPolicies?.refundableTag || "待确认", cancellation: rate.cancellationPolicies || {}, taxes: rate.retailRate?.taxesAndFees || [] };
}
export function validateHotelFilters(body) {
  const currency = body.currency || "CNY";
  if (!["CNY", "USD", "EUR"].includes(currency)) throw new HotelError("请选择人民币、美元或欧元");
  const maxNightly = body.maxNightly === "" || body.maxNightly == null ? null : Number(body.maxNightly);
  if (maxNightly !== null && (!Number.isFinite(maxNightly) || maxNightly <= 0 || maxNightly > 1000000)) throw new HotelError("每晚预算必须大于 0，可留空表示不限");
  const maxStars = body.maxStars === "" || body.maxStars == null ? null : Number(body.maxStars);
  if (maxStars !== null && ![2, 3, 4, 5].includes(maxStars)) throw new HotelError("酒店星级筛选无效");
  for (const key of ["refundableOnly", "breakfastOnly"]) if (body[key] !== undefined && typeof body[key] !== "boolean") throw new HotelError("退改与早餐筛选须为布尔值");
  const sort = body.sort || "priceAsc";
  if (!["priceAsc", "priceDesc"].includes(sort)) throw new HotelError("排序方式无效");
  return { currency, maxNightly, maxStars, refundableOnly: body.refundableOnly === true, breakfastOnly: body.breakfastOnly === true, sort };
}
export function normalizeHotelRates(result, query) {
  if (result.sandbox !== true || !Array.isArray(result.data)) throw new HotelError("未收到明确的沙盒报价，已停止试订", 502);
  const hotels = new Map((result.hotels || []).map((hotel) => [String(hotel.id), hotel]));
  const offers = [];
  for (const hotel of result.data) for (const room of hotel.roomTypes || []) {
    // Package-only rates must not be sold as standalone accommodation.
    if (!room.offerId || room.rateType === "package" || room.isPackageRate === true) continue;
    const content = hotels.get(String(hotel.hotelId)) || {};
    const rawStars = content.stars ?? content.starRating;
    const stars = rawStars != null && Number(rawStars) > 0 && Number(rawStars) <= 5 ? Number(rawStars) : null;
    const summary = rateSummary(room);
    const nights = Math.max(1, Math.round((Date.parse(query.endDate) - Date.parse(query.startDate)) / 86400000));
    const nightlyAmount = summary.amount / nights;
    if (query.currency && summary.currency !== query.currency) throw new HotelError("供应商返回币种与查询不一致，无法按预算筛选", 502);
    if (query.maxNightly != null && nightlyAmount > query.maxNightly) continue;
    if (query.maxStars != null && (stars === null || stars > query.maxStars)) continue;
    if (query.refundableOnly && summary.refundable !== "RFN") continue;
    if (query.breakfastOnly && room.rates?.[0]?.boardType !== "BI") continue;
    offers.push({ id: randomUUID(), supplierOfferId: room.offerId, hotelId: String(hotel.hotelId), hotelName: content.name || `酒店 ${hotel.hotelId}`, address: content.address || "", stars, ...summary, nightlyAmount, nights, query });
  }
  // Pick each hotel's cheapest eligible room before limiting the hotel list.
  offers.sort((a, b) => a.amount - b.amount);
  const cheapestByHotel = new Map();
  for (const offer of offers) if (!cheapestByHotel.has(offer.hotelId)) cheapestByHotel.set(offer.hotelId, offer);
  const selected = [...cheapestByHotel.values()];
  if (query.sort === "priceDesc") selected.reverse();
  return selected.slice(0, 30);
}
export async function searchHotelSandbox(query, options = {}) {
  const places = await liteApi(`/data/places?textQuery=${encodeURIComponent(query.city)}`, null, options);
  const place = places.data?.find((item) => item.types?.includes("locality"));
  if (!place?.placeId) throw new HotelError("没有找到明确的城市，请填写城市全名和国家，例如 Paris France");
  const result = await liteApi("/hotels/rates", { placeId: place.placeId, occupancies: [{ adults: 1 }], checkin: query.startDate, checkout: query.endDate, currency: query.currency || "CNY", guestNationality: "CN", includeHotelData: true, maxRatesPerHotel: 3, limit: 100, timeout: 15, ...(query.maxStars != null ? { starRating: Array.from({ length: query.maxStars * 2 }, (_, i) => (i + 1) / 2) } : {}), ...(query.refundableOnly ? { refundableRatesOnly: true } : {}), ...(query.breakfastOnly ? { boardType: "BI" } : {}) }, options);
  if (!Array.isArray(result.data)) throw new HotelError("供应商房价响应不完整", 502);
  return { place: `${place.displayName} ${place.formattedAddress || ""}`.trim(), candidateCount: result.data.length, offers: normalizeHotelRates(result, query) };
}
export async function prebookHotelSandbox(offer, options = {}) {
  const result = await liteApi("/rates/prebook", { offerId: offer.supplierOfferId, usePaymentSdk: false }, { ...options, booking: true });
  const data = result.data;
  if (result.sandbox !== true || !data?.prebookId || !Number.isFinite(Number(data.price)) || !/^[A-Z]{3}$/.test(data.currency) || !data.paymentTypes?.includes("ACC_CREDIT_CARD")) throw new HotelError("供应商未返回完整的沙盒验价或模拟付款权限", 502);
  return { id: randomUUID(), supplierPrebookId: data.prebookId, clientReference: `roadbook-sandbox-${randomUUID()}`, amount: Number(data.price), currency: data.currency, terms: typeof data.termsAndConditions === "string" ? data.termsAndConditions : "", cancellationChanged: data.cancellationChanged === true, boardChanged: data.boardChanged === true, cancellation: data.roomTypes?.[0]?.rates?.[0]?.cancellationPolicies || offer.cancellation, taxes: data.roomTypes?.[0]?.rates?.[0]?.retailRate?.taxesAndFees || offer.taxes, offer, state: "ready", expiresAt: Date.now() + 10 * 60 * 1000 };
}
export function validateGuest(body) {
  if (body.confirmed !== true) throw new HotelError("请先确认沙盒金额、退改规则和模拟付款");
  const guest = {};
  for (const field of ["firstName", "lastName", "email"]) {
    if (typeof body[field] !== "string" || !body[field].trim() || body[field].length > 100) throw new HotelError("请填写完整的测试入住人姓名与邮箱");
    guest[field] = body[field].trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email)) throw new HotelError("测试邮箱格式不正确");
  return guest;
}
export async function bookHotelSandbox(prebook, guest, options = {}) {
  if (prebook.expiresAt <= Date.now()) throw new HotelError("验价已过期，请重新搜索并验价", 409);
  const result = await liteApi("/rates/book", { prebookId: prebook.supplierPrebookId, clientReference: prebook.clientReference, holder: guest, guests: [{ occupancyNumber: 1, ...guest }], payment: { method: "ACC_CREDIT_CARD" } }, { ...options, booking: true });
  if (result.sandbox !== true || !result.data?.bookingId || !result.data.status) throw new HotelError("供应商订单结果不明确，请保留当前页面并勿重复提交", 502);
  const data = result.data;
  return { bookingId: data.bookingId, status: data.status, hotelConfirmationCode: data.hotelConfirmationCode || "", hotelName: data.hotel?.name || prebook.offer.hotelName, amount: data.price, currency: data.currency, checkin: data.checkin, checkout: data.checkout, sandbox: true, createdAt: new Date().toISOString() };
}
