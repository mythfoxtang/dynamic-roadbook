import { handleBookingSearch } from "@/lib/booking-api";
export const runtime = "nodejs";
export function POST(request) { return handleBookingSearch(request); }
