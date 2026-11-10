import { NextResponse } from "next/server";
import { finishTravelOAuth } from "@/lib/travel-oauth.mjs";
import { saveTravelAccount, TRAVEL_COOKIE } from "@/lib/travel-vault.mjs";
export const runtime = "nodejs";
export async function GET(request) {
  const url = new URL(request.url);
  try {
    const result = await finishTravelOAuth(url.searchParams.get("state"), request.cookies.get("travel_oauth_state")?.value, url.searchParams.get("code"));
    const id = saveTravelAccount(result.credential, request.cookies.get(TRAVEL_COOKIE)?.value);
    const response = NextResponse.redirect(`${result.origin}/travel/?connected=1`);
    response.cookies.set(TRAVEL_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: result.origin.startsWith("https:"), maxAge: 43200, path: "/" });
    response.cookies.set("travel_oauth_state", "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" });
    response.headers.set("Cache-Control", "no-store"); return response;
  } catch (error) { return NextResponse.json({ error: error.message || "登录失败，请重新授权" }, { status: error.status || 502, headers: { "Cache-Control": "no-store" } }); }
}
