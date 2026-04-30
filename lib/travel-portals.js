export const HOTEL_PORTAL = {
  label: "去携程酒店",
  href: "https://hotels.ctrip.com/hotels"
};

export const FLIGHT_PORTAL = {
  label: "去携程机票",
  href: "https://flights.ctrip.com/"
};

export function buildUrl(baseUrl, params) {
  const url = new URL(baseUrl);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}
