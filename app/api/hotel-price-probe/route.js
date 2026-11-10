import { handleBookingSearch } from "@/lib/booking-api";
export const runtime = "nodejs";
export function POST(request) {
  return handleBookingSearch(request, (body) => ({ ...body, kind: "hotel", city: body.city || body.keyword, startDate: body.startDate || body.checkIn, endDate: body.endDate || body.checkOut }));
}
