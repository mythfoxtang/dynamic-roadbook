import { numericPrice } from "./travel-filters.mjs";
export { numericPrice, filterTravelOffers } from "./travel-filters.mjs";
import { randomUUID } from "node:crypto";
export class TravelError extends Error {
  constructor(message, status = 400, code = "INVALID_REQUEST", extra = {}) { super(message); Object.assign(this, { status, code, ...extra }); }
}
export function requiredText(value, label, max = 100) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new TravelError(`请填写有效的${label}`);
  return value.trim();
}
export function number(value, label, min, max, fallback = null) {
  if (value === "" || value == null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new TravelError(`${label}须在 ${min}–${max} 之间`);
  return n;
}
function date(value, label) {
  const text = requiredText(value, label);
  const time = Date.parse(text);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== text) throw new TravelError(`${label}无效`);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (text < today) throw new TravelError(`${label}已过期，请重新选择日期`);
  return text;
}
export function validateTravelSearch(body) {
  if (!["hotel", "flight"].includes(body.kind)) throw new TravelError("请选择酒店或机票");
  const adults = number(body.adults, "成人数", 1, 9, 2);
  const children = number(body.children, "儿童数", 0, 8, 0);
  if (!Number.isInteger(adults) || !Number.isInteger(children) || adults + children > 9) throw new TravelError("总人数须为不超过 9 人的整数");
  const q = { kind: body.kind, adults, children };
  if (q.kind === "hotel") {
    q.city = requiredText(body.city, "城市或县名"); q.startDate = date(body.startDate, "入住日期"); q.endDate = date(body.endDate, "离店日期");
    q.nights = (Date.parse(q.endDate) - Date.parse(q.startDate)) / 86400000;
    if (q.nights < 1 || q.nights > 30) throw new TravelError("住宿时长须为 1–30 晚");
    q.rooms = number(body.rooms, "房间数", 1, 7, 1);
    if (!Number.isInteger(q.rooms) || q.rooms > adults) throw new TravelError("每间房至少需要 1 位成人");
    q.keyword = typeof body.keyword === "string" ? body.keyword.trim().slice(0, 100) : "";
    q.poi = typeof body.poi === "string" ? body.poi.trim().slice(0, 100) : "";
    q.childAges = children ? (Array.isArray(body.childAges) ? body.childAges : String(body.childAges || "").split(/[,，\s]+/)).map((v) => number(v, "儿童年龄", 0, 17)) : [];
    if (q.childAges.length !== children || q.childAges.some((v) => v === null || !Number.isInteger(v))) throw new TravelError("请为每位儿童填写 0–17 岁的年龄，用逗号分隔");
  } else {
    q.from = requiredText(body.from, "出发城市"); q.to = requiredText(body.to, "到达城市"); q.date = date(body.date, "出发日期");
    if (q.from === q.to) throw new TravelError("出发和到达城市不能相同");
    q.mode = body.mode || "LOWEST";
    if (!["LOWEST", "TIME", "PRICE", "NEAR_GO", "NEAR_BACK", "TRANSFER"].includes(q.mode)) throw new TravelError("航班查询模式无效");
    for (const field of ["departureTime", "arrivalTime"]) {
      const value = body[field] || "";
      if (value && (!/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(value) || value.slice(0, 5) >= value.slice(6))) throw new TravelError("时间范围应为 06:00-12:00，起点须早于终点");
      q[field] = value;
    }
  }
  q.minPrice = number(body.minPrice, "最低价格", 0, 100000, null);
  q.maxPrice = body.maxPrice === "" ? null : number(body.maxPrice, "最高价格", 0, 100000, q.kind === "hotel" ? 300 : null);
  if (q.minPrice !== null && q.maxPrice !== null && q.minPrice > q.maxPrice) throw new TravelError("最低价格不能超过最高价格");
  return q;
}
// Never turn redacted/unknown prices, facilities or seats into definite facts.

const string = (value) => typeof value === "string" || typeof value === "number" ? String(value) : "";
const list = (value) => Array.isArray(value) ? value : [];
export function normalizeHotels(result, query) {
  return list(result.hotels).map((h) => ({
    id: randomUUID(), supplierId: string(h.hotelId), name: string(h.hotelName), kind: "hotel", price: numericPrice(h.lowestPrice), priceUnit: "供应商起价，具体每晚／整单口径须以房型详情确认", currency: "CNY",
    brand: string(h.brandName), stars: string(h.starName) || "未标星", rating: numericPrice(h.commentScore), address: string(h.address), area: string(h.business),
    roomName: string(h.roomName), meal: string(h.meal), refund: string(h.refund), window: string(h.roomWindow), roomArea: string(h.roomArea), distance: string(h.distance), review: string(h.commentDigest),
    facilities: [...list(h.facilities), ...list(h.services)].filter((v) => typeof v === "string" || v?.available !== false).map((v) => typeof v === "string" ? v : string(v?.name)).filter(Boolean), query,
  })).filter((h) => h.supplierId && h.name);
}
export function normalizeFlights(result, query) {
  return list(result.data).map((f) => {
    const fare = numericPrice(f.basePrice), tax = numericPrice(f.totalTax);
    return { id: randomUUID(), supplierId: string(f.flightNumber), kind: "flight", name: `${string(f.airlineCompany)} ${string(f.flightNumber)}`.trim(),
      price: fare !== null && tax !== null ? fare + tax : null, fare, tax, currency: "CNY", priceUnit: "每位成人含税参考价；儿童及多人总额以舱位和最终验价为准",
      airline: string(f.airlineCompany), departureTime: string(f.departureTime), arrivalTime: string(f.arrivalTime), departureAirport: string(f.departureAirport), arrivalAirport: string(f.arrivalAirport),
      departureTerminal: string(f.departureTerminal), arrivalTerminal: string(f.arrivalTerminal), duration: string(f.totalDuration || f.flyTime), type: string(f.type), cabin: string(f.cabinClass), seats: string(f.remainingSeats), shared: string(f.shareFlightNo), craft: string(f.craftType), query };
  }).filter((f) => f.supplierId);
}
export function normalizeHotelRooms(result, query) {
  return list(result.roomTypes).flatMap((room) => list(room.ratePlans).map((rate) => ({
    id: randomUUID(), supplierRoomId: string(room.roomTypeId), bookingParam: string(rate.preBookParam), name: string(room.roomTypeName), bed: string(room.bedType), area: string(room.roomSize),
    capacity: numericPrice(room.maxOccupancy), floor: string(room.floor), plan: string(rate.ratePlanName), price: numericPrice(rate.rmbPrices), rawPrice: string(rate.rmbPrices), currency: "CNY",
    priceUnit: "供应商房型报价；每晚／整单口径以官方验价为准", meal: string(rate.mealText), refund: string(rate.cancelDesc), stock: string(rate.count), query,
  })).filter((r) => r.supplierRoomId && r.bookingParam));
}
export function normalizeCabins(result, query) {
  return list(result.cabinInfo).map((c) => {
    const fare = numericPrice(c.basePrice), tax = numericPrice(c.totalTax);
    return { id: randomUUID(), bookingParam: string(c.cabinPriceId), name: string(c.cabinClass), code: string(c.cabinClassCodes), fare, tax, price: fare !== null && tax !== null ? fare + tax : null,
      currency: "CNY", baggage: string(c.baggageInfo), refund: string(c.refundChangeRule), conditions: string(c.buyCondition), meal: string(c.mealCode), seats: string(c.remainingSeats), query };
  }).filter((c) => c.bookingParam);
}
export function publicTravelValue(value) {
  if (Array.isArray(value)) return value.map(publicTravelValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !["bookingParam", "supplierRoomId", "apiKey", "accessToken", "refreshToken"].includes(key)).map(([k, v]) => [k, publicTravelValue(v)]));
}
