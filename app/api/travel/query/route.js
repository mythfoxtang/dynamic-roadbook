import { NextResponse } from "next/server";
import {withQueryReport} from '@/lib/query-report.mjs';
import { aiRequestBody } from "@/lib/ai-request";
import { TRAVEL_COOKIE, getTravelAccount } from "@/lib/travel-vault.mjs";
import { TravelError } from "@/lib/travel-core.mjs";
import { travelEngine } from "@/lib/travel-engine.mjs";
import { publicConnection } from "@/lib/travel-account.mjs";
export const runtime = "nodejs";
export const POST=request=>withQueryReport(request,handlePost);
async function handlePost(request) {
  try {
    const body = await aiRequestBody(request);
    const account = getTravelAccount(request.cookies.get(TRAVEL_COOKIE)?.value);
    if (!account) throw new TravelError("请先连接途牛个人账号，再查询正式机票和酒店", 401, "AUTH_REQUIRED");
    const credential = account.credential;
    let data;
    if (body.action === "search") data = await travelEngine.search(body, credential, body.refresh === true);
    else if (body.action === "next") data = await travelEngine.next(body.searchId, credential, body.count);
    else if (body.action === "detail") data = await travelEngine.detail(body.searchId, body.offerId, credential, body.refresh === true);
    else if (body.action === "requirements") data = await travelEngine.requirements(body.searchId, credential);
    else if (body.action === "book") data = await travelEngine.book(body, credential);
    else if (body.action === "orders") data = travelEngine.listOrders(credential);
    else if (body.action === "sync") data = await travelEngine.syncOrder(body,credential);
    else if (body.action === "cancel") data = await travelEngine.cancelOrder(body, credential);
    else throw new TravelError("未知查询动作");
    return NextResponse.json({ data, connection: publicConnection(credential) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error.status ? error.message : "查询服务发生异常，请稍后重试", code: error.code || "SERVER_ERROR", retryAfter: error.retryAfter || 0 }, { status: error.status || 502, headers: { "Cache-Control": "no-store", ...(error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}) } });
  }
}
