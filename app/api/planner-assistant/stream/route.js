import { runFlightPriceProbe } from "@/lib/flight-probe";
import { runHotelPriceProbe } from "@/lib/hotel-probe";
import { buildPlannerContext, generatePlannerAnalysis } from "@/lib/planner-assistant";

export const runtime = "nodejs";

const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL || "qwen-plus";

function sseEvent(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(request) {
  const body = await request.json();
  const activeType = String(body?.activeType || "");
  const form = body?.form && typeof body.form === "object" ? body.form : {};
  const context = buildPlannerContext({ activeType, form });

  if (!context.destinations.length && !context.formSnapshot.sourceContent) {
    return new Response(sseEvent({ type: "error", error: "至少先补一个目的地、想去的点，或贴入已有行程内容。" }), {
      status: 400,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const push = (payload) => controller.enqueue(encoder.encode(sseEvent(payload)));

      try {
        push({ type: "stage", stage: "context", message: "正在解析规划信息...", context });

        const hotelSignals = [];
        for (const [index, query] of context.hotelQueries.entries()) {
          push({ type: "stage", stage: "hotel_probe", message: `正在探测酒店价格 ${index + 1}/${context.hotelQueries.length}...`, query });
          try {
            const signal = { ...query, ...(await runHotelPriceProbe(query)) };
            hotelSignals.push(signal);
            push({ type: "hotel_signal", signal, hotelSignals });
          } catch (error) {
            const signal = {
              ...query,
              ok: false,
              minPrice: null,
              referencePrice: null,
              maxPrice: null,
              sampleCount: 0,
              risk: "高",
              reason: error?.message || "酒店探针执行失败"
            };
            hotelSignals.push(signal);
            push({ type: "hotel_signal", signal, hotelSignals });
          }
        }

        const flightSignals = [];
        for (const [index, query] of context.flightQueries.entries()) {
          push({ type: "stage", stage: "flight_probe", message: `正在探测机票价格 ${index + 1}/${context.flightQueries.length}...`, query });
          try {
            const signal = { ...query, ...(await runFlightPriceProbe(query)) };
            flightSignals.push(signal);
            push({ type: "flight_signal", signal, flightSignals });
          } catch (error) {
            const signal = {
              ...query,
              ok: false,
              minPrice: null,
              referencePrice: null,
              maxPrice: null,
              sampleCount: 0,
              risk: "高",
              reason: error?.message || "机票探针执行失败"
            };
            flightSignals.push(signal);
            push({ type: "flight_signal", signal, flightSignals });
          }
        }

        push({ type: "stage", stage: "analysis", message: "正在汇总路线、酒店和机票建议..." });

        const analysis = await generatePlannerAnalysis({
          context,
          hotelSignals,
          flightQueries: context.flightQueries,
          flightSignals,
          fetchImpl: fetch,
          apiKey: process.env.DASHSCOPE_API_KEY,
          baseUrl: DASHSCOPE_BASE_URL,
          model: DASHSCOPE_MODEL
        });

        push({
          type: "result",
          data: {
            context,
            hotelSignals,
            flightQueries: context.flightQueries,
            flightSignals,
            analysis
          }
        });
      } catch (error) {
        push({ type: "error", error: error?.message || "规划助手执行失败" });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
