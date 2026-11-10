import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { aiRequestBody, safeAiError } from "@/lib/ai-request";
import { requestUsesHttps } from "@/lib/request-origin.mjs";
import { validateSearch } from "@/lib/booking-service.mjs";
import { HotelError, searchHotelSandbox, prebookHotelSandbox, bookHotelSandbox, validateGuest, validateHotelFilters } from "@/lib/liteapi-hotel.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cookie = "roadbook_hotel_trial";
const sessions = globalThis.__roadbookHotelTrial || (globalThis.__roadbookHotelTrial = new Map());
const headers = { "Cache-Control": "no-store" };
function publicOffer({ supplierOfferId, ...offer }) { return offer; }
function publicSession(session) {
  const pre = session.prebook;
  return { sandbox: true, query: session.query, candidateCount: session.candidateCount, place: session.place, offers: [...session.offers.values()].map(publicOffer), prebook: pre ? { id: pre.id, amount: pre.amount, currency: pre.currency, hotelName: pre.offer.hotelName, roomName: pre.offer.roomName, query: pre.offer.query, terms: pre.terms, cancellation: pre.cancellation, taxes: pre.taxes, cancellationChanged: pre.cancellationChanged, boardChanged: pre.boardChanged, expiresAt: pre.expiresAt, state: pre.state } : null, booking: session.booking || null };
}
export function GET(request) {
  const session = sessions.get(request.cookies.get(cookie)?.value);
  if (!session || session.expiresAt <= Date.now()) return NextResponse.json({ sandbox: true, offers: [], prebook: null, booking: null }, { headers });
  return NextResponse.json(publicSession(session), { headers });
}
export async function POST(request) {
  let activeSession;
  try {
    const body = await aiRequestBody(request);
    const now = Date.now();
    for (const [id, session] of sessions) if (session.expiresAt < now) sessions.delete(id);
    let id = request.cookies.get(cookie)?.value;
    let session = sessions.get(id);
    if (!session) {
      if (sessions.size >= 100) throw new HotelError("试订服务繁忙，请稍后再试", 429);
      id = randomBytes(32).toString("hex");
      session = { offers: new Map(), expiresAt: now + 30 * 60 * 1000, calls: [] };
      sessions.set(id, session);
    }
    session.calls = session.calls.filter((time) => now - time < 60000);
    if (session.calls.length >= 8) throw new HotelError("查询较频繁，请一分钟后再试", 429);
    session.calls.push(now);
    if (session.busy) throw new HotelError("上一项操作尚未完成，请稍候", 409);
    session.busy = true;
    activeSession = session;
    if (session.prebook?.state === "submitting" || session.prebook?.state === "unknown") throw new HotelError("上一次订单正在处理或结果未知，请勿重新提交或搜索", 409);
    if (body.action === "search") {
      const query = { ...validateSearch({ kind: "hotel", city: body.city, startDate: body.startDate, endDate: body.endDate, adults: 1 }), ...validateHotelFilters(body) };
      if ((Date.parse(query.endDate) - Date.parse(query.startDate)) / 86400000 > 14) throw new HotelError("试订最多支持 14 晚");
      const result = await searchHotelSandbox(query);
      session.query = query; session.candidateCount = result.candidateCount;
      session.place = result.place; session.offers = new Map(result.offers.map((offer) => [offer.id, offer])); session.prebook = null; session.booking = null;
    } else if (body.action === "prebook") {
      const offer = session.offers.get(body.offerId);
      if (!offer) throw new HotelError("该房价不属于当前会话，请重新搜索", 409);
      session.prebook = await prebookHotelSandbox(offer); session.booking = null;
    } else if (body.action === "book") {
      const pre = session.prebook;
      if (!pre || pre.id !== body.prebookId) throw new HotelError("验价记录不属于当前会话，请重新验价", 409);
      if (pre.state === "complete") return NextResponse.json(publicSession(session), { headers });
      const guest = validateGuest(body);
      pre.state = "submitting";
      try { session.booking = await bookHotelSandbox(pre, guest); pre.state = "complete"; }
      catch (error) { pre.state = "unknown"; throw error; }
    } else throw new HotelError("未知操作");
    const response = NextResponse.json(publicSession(session), { headers });
    response.cookies.set(cookie, id, { httpOnly: true, sameSite: "strict", secure: requestUsesHttps(request), path: "/", maxAge: 1800 });
    return response;
  } catch (error) {
    const info = error instanceof HotelError || error?.status ? { error: error.message, status: error.status } : safeAiError(error);
    return NextResponse.json({ error: info.error }, { status: info.status, headers });
  } finally { if (activeSession) activeSession.busy = false; }
}
