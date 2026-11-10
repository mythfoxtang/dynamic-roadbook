import { test } from "node:test";
import assert from "node:assert/strict";
import { sandboxKey, normalizeHotelRates, prebookHotelSandbox, bookHotelSandbox, validateGuest, liteApi, validateHotelFilters, searchHotelSandbox } from "./liteapi-hotel.mjs";
const env = { LITEAPI_SANDBOX_KEY: "sandbox_test_only" };
const query = { city: "Paris", startDate: "2027-01-15", endDate: "2027-01-16" };
const room = { offerId: "supplier-offer", offerRetailRate: { amount: 100, currency: "USD" }, rates: [{ name: "Test Room", retailRate: { taxesAndFees: [{ description: "City tax", amount: 10, currency: "USD", included: false }] }, cancellationPolicies: { refundableTag: "NRFN" } }] };
const response = (data) => ({ ok: true, json: async () => data });
test("filter validation rejects invalid budget, currency, stars and truthy strings", () => {
  assert.equal(validateHotelFilters({}).currency, "CNY");
  assert.equal(validateHotelFilters({ maxNightly: "", maxStars: "" }).maxNightly, null);
  for (const invalid of [{ maxNightly: -1 }, { maxNightly: "NaN" }, { currency: "BAD" }, { maxStars: 8 }, { refundableOnly: "false" }, { sort: "invalid" }]) assert.throws(() => validateHotelFilters(invalid));
});
test("budget uses nightly prices and rejects luxury, unknown-star and nonrefundable offers when requested", () => {
  const makeRoom = (price, refundable = "RFN") => ({ ...room, offerId: `offer-${price}`, offerRetailRate: { amount: price, currency: "USD" }, rates: [{ ...room.rates[0], boardType: "BI", cancellationPolicies: { refundableTag: refundable } }] });
  const result = { sandbox: true, data: [
    { hotelId: "cheap", roomTypes: [makeRoom(140), makeRoom(130)] },
    { hotelId: "over-budget", roomTypes: [makeRoom(150)] },
    { hotelId: "luxury", roomTypes: [makeRoom(80)] },
    { hotelId: "unknown", roomTypes: [makeRoom(60)] },
    { hotelId: "nonrefundable", roomTypes: [makeRoom(100, "NRFN")] }
  ], hotels: [{ id: "cheap", stars: 3 }, { id: "over-budget", stars: 2 }, { id: "luxury", stars: 5 }, { id: "nonrefundable", stars: 3 }] };
  const selected = normalizeHotelRates(result, { ...query, endDate: "2027-01-17", currency: "USD", maxNightly: 70, maxStars: 3, refundableOnly: true, breakfastOnly: true });
  assert.equal(selected.length, 1); assert.equal(selected[0].hotelId, "cheap");
  assert.equal(selected[0].nightlyAmount, 65); assert.equal(selected[0].amount, 130);
});
test("sort and deduplicate full candidate list before limiting, including cheaper late candidates", () => {
  const result = { sandbox: true, data: Array.from({ length: 40 }, (_, i) => ({ hotelId: `h${i}`, roomTypes: [{ ...room, offerRetailRate: { amount: 100 - i, currency: "USD" } }] })) };
  const selected = normalizeHotelRates(result, query);
  assert.equal(selected.length, 30); assert.equal(selected[0].hotelId, "h39"); assert.equal(selected[0].amount, 61);
  assert.equal(normalizeHotelRates(result, { ...query, sort: "priceDesc" })[0].amount, 100);
  assert.throws(() => normalizeHotelRates(result, { ...query, currency: "CNY" }));
});
test("stars, breakfast, refundable and currency are sent to the official supplier", async () => {
  let count = 0;
  await searchHotelSandbox({ ...query, ...validateHotelFilters({ currency: "CNY", maxStars: "3", maxNightly: "500", refundableOnly: true, breakfastOnly: true }) }, { env, fetchImpl: async (url, options) => {
    count++;
    if (url.includes("/data/places")) return response({ data: [{ placeId: "city-id", displayName: "Paris", types: ["locality"] }] });
    const payload = JSON.parse(options.body);
    assert.equal(payload.currency, "CNY"); assert.equal(payload.limit, 100);
    assert.equal(payload.refundableRatesOnly, true); assert.equal(payload.boardType, "BI");
    assert.deepEqual(payload.starRating, [0.5, 1, 1.5, 2, 2.5, 3]);
    return response({ sandbox: true, data: [], hotels: [] });
  } });
  assert.equal(count, 2);
});
test("production keys cannot reach any supplier endpoint", async () => {
  assert.throws(() => sandboxKey({ LITEAPI_SANDBOX_KEY: "prod_never_charge" }));
  await assert.rejects(liteApi("/rates/book", {}, { env: { LITEAPI_SANDBOX_KEY: "prod_never_charge" }, fetchImpl: () => assert.fail("no call allowed") }));
});
test("official rates retain currency, excluded taxes, and opaque selection ID", () => {
  const [offer] = normalizeHotelRates({ sandbox: true, data: [{ hotelId: "hotel-1", roomTypes: [room] }], hotels: [{ id: "hotel-1", name: "Test Hotel" }] }, query);
  assert.equal(offer.hotelName, "Test Hotel"); assert.equal(offer.currency, "USD"); assert.equal(offer.amount, 100);
  assert.equal(offer.taxes[0].included, false); assert.notEqual(offer.id, room.offerId);
});
test("package-only rates and unverified environments are never sold as standalone", () => {
  assert.deepEqual(normalizeHotelRates({ sandbox: true, data: [{ hotelId: "h", roomTypes: [{ ...room, rateType: "package" }] }] }, query), []);
  assert.throws(() => normalizeHotelRates({ data: [] }, query));
  assert.throws(() => normalizeHotelRates({ sandbox: false, data: [] }, query));
});
test("prebook uses selected supplier offer, disables actual payment SDK, and takes latest price", async () => {
  const result = await prebookHotelSandbox({ ...room, supplierOfferId: room.offerId, hotelName: "Test" }, { env, fetchImpl: async (url, options) => {
    assert.equal(url, "https://book.liteapi.travel/v3.0/rates/prebook");
    assert.deepEqual(JSON.parse(options.body), { offerId: room.offerId, usePaymentSdk: false });
    return response({ sandbox: true, data: { prebookId: "p", price: 120, currency: "USD", paymentTypes: ["ACC_CREDIT_CARD"], cancellationChanged: true } });
  } });
  assert.equal(result.amount, 120); assert.equal(result.cancellationChanged, true); assert.equal(result.state, "ready");
});
test("confirmation and complete test traveler are required", () => {
  assert.throws(() => validateGuest({ confirmed: false }));
  assert.throws(() => validateGuest({ confirmed: true, firstName: "Test", lastName: "Guest", email: "bad" }));
  assert.equal(validateGuest({ confirmed: true, firstName: "Test", lastName: "Guest", email: "test@example.com" }).email, "test@example.com");
});
test("sandbox order uses stable reference and simulated payment and keeps pending distinct", async () => {
  const pre = { expiresAt: Date.now() + 100000, supplierPrebookId: "p", clientReference: "stable-reference", offer: { hotelName: "Test" } };
  const guest = { firstName: "Test", lastName: "Guest", email: "test@example.com" };
  const result = await bookHotelSandbox(pre, guest, { env, fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.clientReference, pre.clientReference); assert.equal(body.prebookId, "p");
    assert.deepEqual(body.payment, { method: "ACC_CREDIT_CARD" });
    return response({ sandbox: true, data: { bookingId: "sandbox-order", status: "PENDING", price: 100, currency: "USD" } });
  } });
  assert.equal(result.status, "PENDING"); assert.equal(result.sandbox, true);
  await assert.rejects(bookHotelSandbox({ ...pre, expiresAt: 0 }, guest, { env, fetchImpl: () => assert.fail("expired quote") }));
});
test("timeout is not retried and no upstream body or key is echoed", async () => {
  let calls = 0;
  await assert.rejects(liteApi("/rates/book", {}, { env, booking: true, fetchImpl: async () => { calls++; throw new Error("secret raw upstream content"); } }), (error) => error.status === 502 && !error.message.includes("secret"));
  assert.equal(calls, 1);
});
