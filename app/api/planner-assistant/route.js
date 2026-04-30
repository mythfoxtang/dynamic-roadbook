import { NextResponse } from "next/server";
import { runFlightPriceProbe } from "@/lib/flight-probe";
import { runHotelPriceProbe } from "@/lib/hotel-probe";
import { buildPlannerContext, generatePlannerAnalysis } from "@/lib/planner-assistant";

export const runtime = "nodejs";

const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL || "qwen-plus";

export async function POST(request) {
  try {
    const body = await request.json();
    const activeType = String(body?.activeType || "");
    const form = body?.form && typeof body.form === "object" ? body.form : {};

    const context = buildPlannerContext({ activeType, form });
    if (!context.destinations.length && !context.formSnapshot.sourceContent) {
      return NextResponse.json({ error: "至少先补一个目的地、想去的点，或贴入已有行程内容。" }, { status: 400 });
    }

    const hotelSignals = [];
    for (const query of context.hotelQueries) {
      try {
        hotelSignals.push({ ...query, ...(await runHotelPriceProbe(query)) });
      } catch (error) {
        hotelSignals.push({
          ...query,
          ok: false,
          minPrice: null,
          referencePrice: null,
          maxPrice: null,
          sampleCount: 0,
          risk: "高",
          reason: error?.message || "酒店探针执行失败"
        });
      }
    }

    const flightSignals = [];
    for (const query of context.flightQueries) {
      try {
        flightSignals.push({ ...query, ...(await runFlightPriceProbe(query)) });
      } catch (error) {
        flightSignals.push({
          ...query,
          ok: false,
          minPrice: null,
          referencePrice: null,
          maxPrice: null,
          sampleCount: 0,
          risk: "高",
          reason: error?.message || "机票探针执行失败"
        });
      }
    }

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

    return NextResponse.json({
      context,
      hotelSignals,
      flightQueries: context.flightQueries,
      flightSignals,
      analysis
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "规划助手执行失败" }, { status: 500 });
  }
}
