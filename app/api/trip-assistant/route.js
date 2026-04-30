import { NextResponse } from "next/server";
import { runTripAssistantAction } from "@/lib/trip-assistant";

export async function POST(request) {
  try {
    const body = await request.json();
    const actionId = String(body?.actionId || "");
    const context = body?.context || {};
    const note = String(body?.note || "");

    if (!actionId) {
      return NextResponse.json({ error: "缺少 actionId" }, { status: 400 });
    }

    const result = runTripAssistantAction({ actionId, context, note });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error?.message || "AI 助手异常" }, { status: 500 });
  }
}
