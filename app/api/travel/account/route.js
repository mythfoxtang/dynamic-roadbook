import { NextResponse } from "next/server";
import { aiRequestBody, sameOrigin } from "@/lib/ai-request";
import { requestUsesHttps } from "@/lib/request-origin.mjs";
import { TRAVEL_COOKIE, getTravelAccount, saveTravelAccount, deleteTravelAccount } from "@/lib/travel-vault.mjs";
import { inspectTravelAccount, publicConnection } from "@/lib/travel-account.mjs";
import { TravelError } from "@/lib/travel-core.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export function GET(request) { return NextResponse.json(publicConnection(getTravelAccount(request.cookies.get(TRAVEL_COOKIE)?.value)?.credential), { headers }); }
export async function POST(request) {
  try {
    const body = await aiRequestBody(request);
    if (body.action === "inspect") {
      const credential = getTravelAccount(request.cookies.get(TRAVEL_COOKIE)?.value)?.credential;
      if (!credential) throw new TravelError("请先登录途牛或配置 Key", 401);
      await inspectTravelAccount(credential, { refresh: true });
      return NextResponse.json(publicConnection(credential), { headers });
    }
    const secret = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!/^[\x21-\x7E]{8,2048}$/.test(secret)) throw new TravelError("请填写有效的途牛开放平台 API Key");
    const credential = { type: "apiKey", secret };
    const checked = await inspectTravelAccount(credential, { refresh: true });
    if (!Object.values(checked.domains).some(d=>d.ok)) throw new TravelError("酒店、机票和高铁连接均未通过。请检查 Key、访问权限或供应商配额。", 401, "CONNECT_FAILED");
    const id = saveTravelAccount(credential, request.cookies.get(TRAVEL_COOKIE)?.value);
    const response = NextResponse.json(publicConnection(credential), { headers });
    response.cookies.set(TRAVEL_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: requestUsesHttps(request), maxAge: 43200, path: "/" });
    return response;
  } catch (error) { return NextResponse.json({ error: error.status ? error.message : "无法完成供应商连接，请稍后重试" }, { status: error.status || 502, headers }); }
}
export function DELETE(request) {
  try { sameOrigin(request); deleteTravelAccount(request.cookies.get(TRAVEL_COOKIE)?.value); const response = NextResponse.json({ connected: false }, { headers }); response.cookies.set(TRAVEL_COOKIE, "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" }); return response; }
  catch (error) { return NextResponse.json({ error: error.message }, { status: error.status || 400, headers }); }
}
