import { NextResponse } from "next/server";
import { providerStatus } from "@/lib/booking-service.mjs";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ providers: providerStatus() }, { headers: { "Cache-Control": "no-store" } });
}
