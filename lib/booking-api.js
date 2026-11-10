import { NextResponse } from "next/server";
import { BookingError, validateSearch, searchBookings } from "./booking-service.mjs";
import { isSameOriginRequest } from "./request-origin.mjs";

const requests = new Map();

export async function handleBookingSearch(request, transform = (body) => body) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (!isSameOriginRequest(request)) throw new BookingError("不允许跨站查询", 403);
    // Single-process guard. Put an authenticated rate limiter at the edge for public deployment.
    const key = "search";
    const now = Date.now();
    const recent = (requests.get(key) || []).filter((time) => now - time < 60000);
    if (recent.length >= 20) throw new BookingError("查询较频繁，请一分钟后重试", 429);
    if (Number(request.headers.get("content-length")) > 16384) throw new BookingError("查询内容过长", 413);
    const raw = await request.text();
    if (raw.length > 16384) throw new BookingError("查询内容过长", 413);
    let body;
    try { body = JSON.parse(raw); } catch { throw new BookingError("请求必须为有效的 JSON"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new BookingError("查询内容必须为 JSON 对象");
    const query = validateSearch(transform(body));
    requests.set(key, [...recent, now]);
    return NextResponse.json(await searchBookings(query), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof BookingError ? error.message : "报价服务暂时不可用，请稍后重试或前往携程查询" }, { status: error instanceof BookingError ? error.status : 502, headers });
  }
}
