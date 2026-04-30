import { NextResponse } from "next/server";
import { runFlightPriceProbe } from "@/lib/flight-probe";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const from = String(body?.from || "");
    const to = String(body?.to || "");
    const date = String(body?.date || "");

    if (!from || !to || !date) {
      return NextResponse.json({ error: "缺少 from / to / date" }, { status: 400 });
    }

    const result = await runFlightPriceProbe({ from, to, date });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error?.message || "机票价格探针失败" }, { status: 500 });
  }
}
