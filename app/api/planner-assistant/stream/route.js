import { NextResponse } from "next/server";
import { aiRequestBody, requestAiConfig, safeAiError } from "@/lib/ai-request";
import { plannerContext, runPlanner } from "@/lib/planner-runner";
export const runtime = "nodejs";
export async function POST(request) {
  let context, config;
  try {
    const body = await aiRequestBody(request);
    config = requestAiConfig(request);
    context = plannerContext(body);
  } catch (error) {
    const result = safeAiError(error);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const push = (data) => { if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); };
      try {
        push({ type: "stage", stage: "context", message: `正在使用 ${config.provider} / ${config.model} 分析行程，尚未查询实时报价…`, context });
        const data = await runPlanner(context, config);
        push({ type: "result", data });
      } catch (error) { push({ type: "error", error: safeAiError(error).error }); }
      finally { if (!cancelled) controller.close(); }
    },
    cancel() { cancelled = true; }
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" } });
}
