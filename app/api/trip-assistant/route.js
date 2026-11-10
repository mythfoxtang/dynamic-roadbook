import { createAiFetch } from "@/lib/ai-config.mjs";
import { aiRequestBody, requestAiConfig, safeAiError } from "@/lib/ai-request";
import { NextResponse } from "next/server";
import { generateTripAssistantAction } from "@/lib/trip-assistant";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await aiRequestBody(request);
    const config = requestAiConfig(request);
    const actionId = String(body?.actionId || "");
    const context = body?.context || {};
    const note = String(body?.note || "");

    if (!actionId) {
      return NextResponse.json({ error: "缺少 actionId" }, { status: 400 });
    }

    const result = await generateTripAssistantAction({
      actionId, context, note,
      fetchImpl: createAiFetch(config),
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model
    });
    return NextResponse.json({ ...result, provider: config.provider }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const result = safeAiError(error);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }
}
