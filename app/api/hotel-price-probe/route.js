import { NextResponse } from "next/server";
import { runHotelPriceProbe } from "@/lib/hotel-probe";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const city = String(body?.city || "");
    const keyword = String(body?.keyword || "");
    const checkIn = String(body?.checkIn || "");
    const checkOut = String(body?.checkOut || "");

    if (!keyword) {
      return NextResponse.json({ error: "缺少 keyword" }, { status: 400 });
    }

    const result = await runHotelPriceProbe({ city, keyword, checkIn, checkOut });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error?.message || "酒店价格探针失败" }, { status: 500 });
  }
}
