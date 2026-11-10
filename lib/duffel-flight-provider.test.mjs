import test from "node:test";
import assert from "node:assert/strict";
import { searchShanghaiBeijing } from "./duffel-flight-provider.mjs";

test("上海北京查询使用城市代码，并按总价排序", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({ data: { live_mode: false, offers: [
        { id: "high", total_amount: "850.00", total_currency: "CNY", slices: [{ segments: [{ departing_at: "2026-11-14T08:00:00", arriving_at: "2026-11-14T10:00:00", origin: { iata_code: "SHA" }, destination: { iata_code: "PEK" }, marketing_carrier: { iata_code: "CA" }, marketing_carrier_flight_number: "1001", operating_carrier: { name: "Air China" } }] }] },
        { id: "low", total_amount: "620.00", total_currency: "CNY", slices: [{ segments: [{ departing_at: "2026-11-14T09:00:00", arriving_at: "2026-11-14T11:30:00", origin: { iata_code: "PVG" }, destination: { iata_code: "PKX" }, marketing_carrier: { iata_code: "MU" }, marketing_carrier_flight_number: "5101", operating_carrier: { name: "China Eastern" } }] }] }
      ] } })
    };
  };

  const result = await searchShanghaiBeijing({ date: "2026-11-14", adults: 2, token: "duffel_test_example", fetchImpl });
  const offers = result.offers;
  const body = JSON.parse(request.options.body);
  assert.equal(body.data.slices[0].origin, "SHA");
  assert.equal(body.data.slices[0].destination, "BJS");
  assert.equal(body.data.slices[0].departure_date, "2026-11-14");
  assert.equal(body.data.passengers.length, 2);
  assert.equal(request.options.headers.Authorization, "Bearer duffel_test_example");
  assert.deepEqual(offers.map((offer) => offer.amount), [620, 850]);
  assert.deepEqual(offers[0].operatingCarriers, ["China Eastern"]);
  assert.equal(result.liveMode, false);
});

test("无凭据时不会发送查询", async () => {
  await assert.rejects(searchShanghaiBeijing({ date: "2026-11-14", fetchImpl: () => { throw new Error("不应请求"); } }), /缺少 DUFFEL_ACCESS_TOKEN/);
});
