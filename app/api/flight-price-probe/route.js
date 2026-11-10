import { handleBookingSearch } from "@/lib/booking-api";
export const runtime = "nodejs";

// Compatibility endpoint; queries the supplier API without launching a browser.
export function POST(request) {
  return handleBookingSearch(request, (body) => ({ ...body, kind: "flight" }));
}
