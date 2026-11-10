import { NextResponse } from "next/server";
import { aiRequestBody } from "@/lib/ai-request";
import { requestUsesHttps } from "@/lib/request-origin.mjs";
import { startTravelOAuth } from "@/lib/travel-oauth.mjs";
export const runtime = "nodejs";
export async function POST(request) {
  try {
    await aiRequestBody(request);
    const origin = new URL(request.headers.get("origin") || request.url).origin;
    const result = await startTravelOAuth(origin);
    const response = NextResponse.json({ url: result.url }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set("travel_oauth_state", result.state, { httpOnly: true, sameSite: "lax", secure: requestUsesHttps(request), maxAge: 600, path: "/" });
    return response;
  } catch (error) { return NextResponse.json({ error: error.message || "授权服务暂不可用" }, { status: error.status || 502 }); }
}
