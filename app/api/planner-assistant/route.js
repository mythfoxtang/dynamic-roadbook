import { NextResponse } from "next/server";
import { aiRequestBody, requestAiConfig, safeAiError } from "@/lib/ai-request";
import { plannerContext, runPlanner } from "@/lib/planner-runner";
export const runtime = "nodejs";
export async function POST(request) {
  try {
    const body = await aiRequestBody(request);
    const config = requestAiConfig(request);
    return NextResponse.json(await runPlanner(plannerContext(body), config), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const result = safeAiError(error);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }
}
