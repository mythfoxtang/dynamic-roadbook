import { NextResponse } from "next/server";
import { AI_COOKIE, SESSION_SECONDS, resolveAiConfig, publicAiConfig, validateAiInput, saveAiSession, deleteAiSession, checkDeepSeek } from "@/lib/ai-config.mjs";
import { aiRequestBody, sameOrigin, safeAiError } from "@/lib/ai-request";
import { requestUsesHttps } from "@/lib/request-origin.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export function GET(request) {
  return NextResponse.json(publicAiConfig(resolveAiConfig(request.cookies.get(AI_COOKIE)?.value)), { headers });
}
export async function POST(request) {
  try {
    const config = validateAiInput(await aiRequestBody(request));
    const models = await checkDeepSeek(config);
    const id = saveAiSession(config, request.cookies.get(AI_COOKIE)?.value);
    const response = NextResponse.json({ ...publicAiConfig({ ...config, source: "session" }), models, message: "连接成功，已加密保存到当前浏览器对应的服务端会话。模型调用与余额请以实际生成结果为准。" }, { headers });
    response.cookies.set(AI_COOKIE, id, { httpOnly: true, sameSite: "strict", secure: requestUsesHttps(request), path: "/", maxAge: SESSION_SECONDS });
    return response;
  } catch (error) { const result = safeAiError(error); return NextResponse.json({ error: result.error }, { status: result.status, headers }); }
}
export function DELETE(request) {
  try {
    sameOrigin(request);
    deleteAiSession(request.cookies.get(AI_COOKIE)?.value);
    const response = NextResponse.json({ ...publicAiConfig(resolveAiConfig(null)), message: "已清除当前会话配置；如服务器配置了环境变量，将继续使用环境变量。" }, { headers });
    response.cookies.set(AI_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
    return response;
  } catch (error) { const result = safeAiError(error); return NextResponse.json({ error: result.error }, { status: result.status, headers }); }
}
