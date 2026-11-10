export function normalizeDuffelOffers(offers) {
  return (Array.isArray(offers) ? offers : [])
    .map((offer) => {
      const segments = offer.slices?.[0]?.segments || [];
      const first = segments[0];
      const last = segments[segments.length - 1];
      const amount = Number(offer.total_amount);
      if (!first || !last || !Number.isFinite(amount)) return null;
      return {
        offerId: offer.id || "",
        amount,
        currency: offer.total_currency || "",
        departureAt: first.departing_at || "",
        arrivalAt: last.arriving_at || "",
        departureAirport: first.origin?.iata_code || "",
        arrivalAirport: last.destination?.iata_code || "",
        flightNumbers: segments.map((segment) => `${segment.marketing_carrier?.iata_code || ""}${segment.marketing_carrier_flight_number || ""}`),
        operatingCarriers: [...new Set(segments.map((segment) => segment.operating_carrier?.name).filter(Boolean))],
        stops: Math.max(0, segments.length - 1),
        seats: null,
        expiresAt: offer.expires_at || ""
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.amount - b.amount);
}

export async function searchShanghaiBeijing({ date, adults = 1, token, fetchImpl = fetch }) {
  if (!token) throw new Error("缺少 DUFFEL_ACCESS_TOKEN");
  const response = await fetchImpl("https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=20000", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Duffel-Version": "v2",
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      data: {
        slices: [{ origin: "SHA", destination: "BJS", departure_date: date }],
        passengers: Array.from({ length: adults }, () => ({ type: "adult" })),
        cabin_class: "economy"
      }
    }),
    signal: AbortSignal.timeout(35000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.errors?.[0]?.message || data?.errors?.[0]?.title;
    throw new Error(`Duffel 查询失败 (${response.status})${detail ? `：${detail}` : ""}`);
  }
  return {
    offers: normalizeDuffelOffers(data?.data?.offers),
    liveMode: data?.data?.live_mode === true
  };
}
