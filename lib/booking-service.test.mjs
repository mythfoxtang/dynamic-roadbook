import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSearch, searchBookings, providerStatus } from "./booking-service.mjs";

const now = new Date("2026-11-09T10:00:00Z");
const flight = { kind: "flight", from: "上海", to: "北京", date: "2027-06-01", adults: 2 };
const gatewayEnv = { BOOKING_GATEWAY_URL: "https://adapter.example/api", BOOKING_GATEWAY_TOKEN: "secret", BOOKING_CHECKOUT_HOSTS: "checkout.example" };
const offer = { id: "one", title: "客房", amount: 1250, currency: "CNY", priceBasis: "全程含税总价", checkoutUrl: "https://checkout.example/session/1" };
const response = (data) => ({ ok: true, json: async () => data });

test("search validation accepts known input and strips extra client fields", () => {
  assert.deepEqual(validateSearch({ ...flight, token: "ignored" }, now), flight);
});
test("dates reject past, invalid calendar dates and reversed stays", () => {
  for (const date of ["2026-11-08", "2027-02-30", "not-a-date"]) assert.throws(() => validateSearch({ ...flight, date }, now));
  assert.throws(() => validateSearch({ kind: "hotel", city: "丽江", startDate: "2027-06-02", endDate: "2027-06-01" }, now));
  assert.throws(() => validateSearch({ kind: "car", city: "丽江", returnCity: "昆明", startDate: "2027-06-01", endDate: "2027-06-01" }, now));
});
test("today is computed in Shanghai rather than UTC", () => {
  assert.throws(() => validateSearch({ ...flight, date: "2026-11-09" }, new Date("2026-11-09T18:00:00Z")));
});
test("invalid kinds, non-string places and excessive passengers are rejected", () => {
  for (const adults of [0, 10, 1.5, "abc"]) assert.throws(() => validateSearch({ ...flight, adults }, now));
  assert.throws(() => validateSearch({ ...flight, kind: "train" }, now));
  assert.throws(() => validateSearch({ ...flight, from: {} }, now));
  assert.throws(() => validateSearch({ ...flight, to: "上海" }, now));
});
test("missing credentials return an explicit unavailable response without network or invented offers", async () => {
  assert.ok(providerStatus({}).every((item) => !item.configured));
  assert.ok(providerStatus({ DUFFEL_ACCESS_TOKEN: "your_duffel_access_token_here" }).every((item) => !item.configured));
  await assert.rejects(searchBookings(flight, { env: {}, fetchImpl: () => assert.fail("must not fetch") }), (error) => error.status === 503);
});
test("gateway contract forwards conditions with server-only token and retains native currency", async () => {
  const result = await searchBookings(flight, { env: gatewayEnv, fetchImpl: async (url, options) => {
    assert.equal(String(url), "https://adapter.example/api/search");
    assert.deepEqual(JSON.parse(options.body), flight);
    assert.equal(options.headers.Authorization, "Bearer secret");
    assert.equal(options.cache, "no-store");
    return response({ provider: "合作方", liveMode: true, offers: [{ ...offer, currency: "USD" }] });
  } });
  assert.equal(result.offers[0].currency, "USD"); assert.equal(result.offers[0].checkoutUrl, offer.checkoutUrl);
  assert.equal(result.offers[0].amount, 1250); assert.equal(result.liveMode, true);
});
test("checkout rejects arbitrary, deceptive, non-HTTPS and credential-bearing URLs", async () => {
  for (const checkoutUrl of ["https://evil.example/a", "https://checkout.example.evil.example/", "http://checkout.example/", "javascript:alert(1)", "https://user:password@checkout.example/a"]) {
    const result = await searchBookings(flight, { env: gatewayEnv, fetchImpl: async () => response({ provider: "合作方", liveMode: true, offers: [{ ...offer, checkoutUrl }] }) });
    assert.equal(result.offers[0].checkoutUrl, null);
  }
});
test("test environment never exposes a checkout link", async () => {
  const result = await searchBookings(flight, { env: gatewayEnv, fetchImpl: async () => response({ provider: "合作方", liveMode: false, offers: [offer] }) });
  assert.equal(result.liveMode, false); assert.equal(result.offers[0].checkoutUrl, null);
});
test("missing environment identity, missing inventory and malformed prices are errors", async () => {
  for (const data of [{ offers: [] }, { liveMode: true, provider: "p" }, { provider: "p", liveMode: true, offers: [{ ...offer, amount: "100" }] }, { provider: "p", liveMode: true, offers: [{ ...offer, currency: "" }] }]) {
    await assert.rejects(searchBookings(flight, { env: gatewayEnv, fetchImpl: async () => response(data) }), (error) => error.status === 502);
  }
});
test("no inventory is a successful empty result and supplier errors expose no private response", async () => {
  const result = await searchBookings(flight, { env: gatewayEnv, fetchImpl: async () => response({ provider: "p", liveMode: true, offers: [] }) });
  assert.deepEqual(result.offers, []);
  await assert.rejects(searchBookings(flight, { env: gatewayEnv, fetchImpl: async () => ({ ok: false, status: 401, json: () => assert.fail("private errors must not be forwarded") }) }), (error) => error.status === 502);
});
test("Duffel sends generalized IATA route and adult count and preserves test flag", async () => {
  const result = await searchBookings(flight, { env: { DUFFEL_ACCESS_TOKEN: "test-token" }, fetchImpl: async (url, options) => {
    assert.ok(url.startsWith("https://api.duffel.com/air/offer_requests?"));
    const data = JSON.parse(options.body).data;
    assert.deepEqual(data.slices, [{ origin: "SHA", destination: "BJS", departure_date: flight.date }]);
    assert.equal(data.passengers.length, 2);
    return response({ data: { live_mode: false, offers: [{ id: "off_1", total_amount: "99.50", total_currency: "GBP", slices: [{ segments: [{ departing_at: "2027-06-01T09:00:00", arriving_at: "2027-06-01T11:00:00", origin: { iata_code: "SHA" }, destination: { iata_code: "PEK" }, marketing_carrier: { iata_code: "XX" }, marketing_carrier_flight_number: "123", operating_carrier: { name: "测试航司" } }] }] }] } });
  } });
  assert.equal(result.offers[0].amount, 99.5); assert.equal(result.offers[0].currency, "GBP");
  assert.equal(result.liveMode, false); assert.equal(result.offers[0].checkoutUrl, null);
});
test("unknown city is not silently mapped to another airport", async () => {
  await assert.rejects(searchBookings({ ...flight, from: "未知城市" }, { env: { DUFFEL_ACCESS_TOKEN: "test-token" }, fetchImpl: () => assert.fail("must not fetch") }), (error) => error.status === 400);
});
