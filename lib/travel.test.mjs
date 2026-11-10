import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateTravelSearch, normalizeHotels, normalizeFlights, normalizeHotelRooms, publicTravelValue } from './travel-core.mjs';
import { filterTravelOffers, filterTravelOptions, numericPrice } from './travel-filters.mjs';
import { TravelEngine } from './travel-engine.mjs';
import { validateTravelPassenger } from './travel-people.mjs';
import { parseRpc, unpackTool, tuniuRpc, callTuniu } from './tuniu-transport.mjs';
import { startTravelOAuth, finishTravelOAuth } from './travel-oauth.mjs';
import { accountOwner } from './travel-account.mjs';

// Explicit fixtures: these prove behavior, never actual inventory, price or booking access.
const credential = { type: 'apiKey', secret: 'fixture-secret' };
const hotel = { kind: 'hotel', city: '成都', startDate: '2099-11-16', endDate: '2099-11-18', adults: 2, children: 0, rooms: 1, maxPrice: 300 };
const flight = { kind: 'flight', from: '上海', to: '成都', date: '2099-11-16', adults: 1, children: 0 };
const hotelRow = (i) => ({ hotelId: i + 1, hotelName: `fixture经济客栈${i}`, lowestPrice: 200 + i, brandName: 'fixture经济连锁', meal: '含双早', roomWindow: '有外窗', refund: '限时免费取消', facilities: ['停车场'], commentScore: 4.6 });
const flightRow = (i) => ({ flightNumber: `TEST${i}`, airlineCompany: 'fixture航空', basePrice: 200 + i, totalTax: 70, departureTime: '08:30', arrivalTime: '11:30', departureAirport: '虹桥', arrivalAirport: '天府', type: i % 2 ? '经停' : '直飞', remainingSeats: '3' });
function fixtureEngine({ failPage, bookingError, unsafePay = false, unknownPrice = false } = {}) {
  let clock = Date.now(); const calls = [], persisted = [];
  const engine = new TravelEngine({ now: () => clock, tools: async () => [], persistOrders: (rows) => persisted.push(JSON.stringify(rows)), call: async (c, domain, action, args) => {
    calls.push({ domain, action, args });
    if (action === 'search') {
      const page = args.pageNum || 1;
      if (page === failPage) throw new Error('fixture quota reached');
      const start = (page - 1) * 20;
      return domain === 'hotel' ? { hotels: [...Array.from({ length: 20 }, (_, i) => hotelRow(start + i)), hotelRow(0)], totalPageNum: 3, queryId: 'fixture-query' } : { data: Array.from({ length: 20 }, (_, i) => flightRow(start + i)), totalPageNum: 3 };
    }
    if (action === 'detail') return domain === 'hotel' ? { roomTypes: [{ roomTypeId: 'fixture-room', roomTypeName: 'fixture大床房', maxOccupancy: 2, ratePlans: [{ preBookParam: 'fixture-book-secret', rmbPrices: unknownPrice ? '2XX' : '260', mealText: '双早', cancelDesc: '免费取消' }] }] } : { cabinInfo: [{ cabinPriceId: 'fixture-cabin-secret', cabinClass: '经济舱', basePrice: 260, totalTax: 70, baggageInfo: '20kg', refundChangeRule: '收费退改' }] };
    if (action === 'requirements') return { text: 'fixture官方字段说明' };
    if (action === 'book') { if (bookingError) throw new Error('fixture timeout'); return { orderId: 'fixture-order', payUrl: unsafePay ? 'https://tuniu.com.evil.invalid/pay' : 'https://m.tuniu.com/pay/fixture' }; }
    if (action === 'cancel') return { successCode: true };
    throw new Error('unexpected fixture action');
  } });
  return { engine, calls, persisted, advance: (ms) => { clock += ms; } };
}
const guest = { roomGuests: [{ guests: [{ firstName: '测试', lastName: '虚构' }] }], contactName: '虚构测试', contactPhone: '13800000000', confirmed: true };
async function quoteOf(f, query = hotel) { const s = await f.engine.search(query, credential); const q = await f.engine.detail(s.id, s.offers[0].id, credential); return { s, q, body: { ...guest, searchId: s.id, quoteId: q.id, optionId: q.options[0].id } }; }

test('search validation: domestic budgets, empty upper bound, unstarred and children', () => {
  assert.equal(validateTravelSearch(hotel).maxPrice, 300);
  assert.equal(validateTravelSearch({ ...hotel, maxPrice: '' }).maxPrice, null);
  assert.deepEqual(validateTravelSearch({ ...hotel, children: 2, childAges: '3，8' }).childAges, [3, 8]);
  for (const change of [{ rooms: 3 }, { adults: 1.5 }, { children: 1, childAges: '' }, { endDate: hotel.startDate }, { startDate: '2000-01-01' }, { minPrice: 301 }, { endDate: '2099-02-30' }]) assert.throws(() => validateTravelSearch({ ...hotel, ...change }));
  assert.throws(() => validateTravelSearch({ ...flight, to: '上海' }));
  assert.throws(() => validateTravelSearch({ ...flight, mode: 'TIME', departureTime: '22:00-06:00' }));
});
test('redacted prices and absent flight tax stay unknown, no invented totals', () => {
  for (const value of ['2XX', '约200', '-1', null, '', NaN, '9'.repeat(400)]) assert.equal(numericPrice(value), null);
  assert.equal(numericPrice('￥1,234.50'), 1234.5);
  const h = normalizeHotels({ hotels: [hotelRow(0)] }, hotel)[0]; assert.equal(h.stars, '未标星'); assert.equal(h.price, 200);
  assert.equal(normalizeFlights({ data: [{ ...flightRow(0), totalTax: undefined }] }, flight)[0].price, null);
  assert.equal(normalizeFlights({ data: [flightRow(0)] }, flight)[0].price, 270);
});
test('hotel filters require positive evidence; no breakfast/window/parking inference', () => {
  const rows = normalizeHotels({ hotels: [hotelRow(0), { ...hotelRow(1), meal: '不含早餐', roomWindow: '封闭窗', refund: '不可取消', facilities: [{ name: '停车场', available: false }] }, { ...hotelRow(2), lowestPrice: '2XX', commentScore: undefined, meal: '', roomWindow: '', refund: '', facilities: [] }] }, hotel);
  for (const f of [{ breakfast: true }, { window: true }, { refundable: true }, { parking: true }, { minRating: 4.5 }]) assert.equal(filterTravelOffers(rows, f).length, f.minRating ? 2 : 1);
  assert.equal(filterTravelOffers(rows, { maxPrice: 300 }).length, 2);
  assert.equal(filterTravelOffers(rows, { keyword: '客栈0', brand: '经济' }).length, 1);
  assert.equal(filterTravelOffers(rows, { sort: 'priceDesc' }).at(-1).price, null);
});
test('flight filters: exact direct, airline, airports, times, numeric seat evidence', () => {
  const rows = normalizeFlights({ data: [flightRow(0), flightRow(1), { ...flightRow(2), remainingSeats: '充足', departureTime: '05:00' }] }, flight);
  assert.equal(filterTravelOffers(rows, { directOnly: true }).length, 2);
  assert.equal(filterTravelOffers(rows, { directOnly: true, minSeats: 2, departAfter: '06:00', departBefore: '10:00', departureAirport: '虹桥', arrivalAirport: '天府', airline: 'fixture航空' }).length, 1);
});
test('room/cabin filters operate on actual option values and preserve unknowns', () => {
  const rooms = [{ price: 250, bed: '大床', meal: '双早', refund: '免费取消', capacity: 2 }, { price: 350, bed: '双床', meal: '无早餐', refund: '不可取消', capacity: null }];
  assert.equal(filterTravelOptions(rooms, { maxPrice: 300, capacity: 2, breakfast: true, bed: '大床', refundable: true }).length, 1);
  const cabins = [{ name: '经济舱', price: 400, baggage: '免费托运20kg', refund: '收费退改' }, { name: '商务舱', price: 1400, baggage: '不含免费托运20kg', refund: '可退' }];
  assert.equal(filterTravelOptions(cabins, { cabin: '经济舱', baggage: true }, 'flight').length, 1);
  assert.equal(filterTravelOptions(cabins, { baggage: true }, 'flight').length, 1);
});
test('absent total page count never becomes an assertion of complete inventory', async () => {
  const engine = new TravelEngine({ tools: async () => [], call: async () => ({ hotels: [hotelRow(0)] }) });
  const result = await engine.search(hotel, credential); assert.equal(result.complete, false); assert.equal(result.totalPages, null); assert.match(result.coverage, /无法确认/);
});
test('supplier silently resolving a county to Shanghai cannot become a valid local hotel quote', async () => {
  const engine = new TravelEngine({ tools: async () => [], call: async () => ({ cityInfo: { cityName: '上海' }, totalPageNum: 2, hotels: [{ ...hotelRow(0), cityName: '上海' }] }) });
  await assert.rejects(engine.search({ ...hotel, city: '芒康' }, credential), (e) => e.code === 'CITY_MISMATCH');
  const engine2 = new TravelEngine({ tools: async () => [], call: async () => ({ totalPageNum: 1, hotels: [{ ...hotelRow(0), cityName: '上海' }] }) });
  await assert.rejects(engine2.search({ ...hotel, city: '芒康' }, credential), (e) => e.code === 'CITY_MISMATCH');
});
test('verified prefecture label does not reject a correctly resolved subordinate city', async () => {
  const engine = new TravelEngine({ tools: async () => [], call: async () => ({ cityInfo: { cityName: '香格里拉市' }, totalPageNum: 1, hotels: [{ ...hotelRow(0), cityName: '迪庆' }] }) });
  assert.equal((await engine.search({ ...hotel, city: '香格里拉' }, credential)).count, 1);
  const wrong = new TravelEngine({ tools: async () => [], call: async () => ({ cityInfo: { cityName: '上海' }, totalPageNum: 1, hotels: [{ ...hotelRow(0), cityName: '迪庆' }] }) });
  await assert.rejects(wrong.search({ ...hotel, city: '香格里拉' }, credential), (e) => e.code === 'CITY_MISMATCH');
});
test('hotel 3 pages deduplicate 60 candidates; cached searches and local filters make no upstream calls', async () => {
  const f = fixtureEngine(); const s = await f.engine.search(hotel, credential);
  assert.equal(s.complete, false); assert.equal(s.count, 20);
  const cached = await f.engine.search(hotel, credential); assert.equal(cached.cached, true); assert.equal(f.calls.length, 1);
  const all = await f.engine.next(s.id, credential, 3); assert.equal(all.count, 60); assert.equal(all.complete, true);
  assert.deepEqual(f.calls[1].args, { queryId: 'fixture-query', pageNum: 2 });
  filterTravelOffers(all.offers, { maxPrice: 250 }); assert.equal(f.calls.length, 3);
});
test('flights paginate with original route/date; partial quota failures keep completed pages', async () => {
  const f = fixtureEngine({ failPage: 3 }); const s = await f.engine.search(flight, credential); const all = await f.engine.next(s.id, credential, 3);
  assert.equal(all.count, 40); assert.equal(all.complete, false); assert.equal(all.loadedPages, 2); assert.match(all.warnings[0], /quota/);
  assert.equal(f.calls[1].args.departureCityName, '上海'); assert.equal(f.calls[1].args.departureDate, flight.date);
});
test('search ownership and option provenance cannot be supplied by a different account', async () => {
  const f = fixtureEngine(); const { s, body } = await quoteOf(f);
  await assert.rejects(f.engine.next(s.id, { type: 'apiKey', secret: 'another-user' }), /不存在/);
  await assert.rejects(f.engine.book({ ...body, optionId: 'injected' }, credential), /不属于/);
  assert.equal(f.calls.filter((c) => c.action === 'book').length, 0);
});
test('private booking parameters stripped; detail expires before creating order', async () => {
  const f = fixtureEngine(); const { q, body } = await quoteOf(f);
  assert.ok(!JSON.stringify(q).includes('fixture-book-secret')); assert.ok(!('supplierRoomId' in q.options[0]));
  f.advance(300001); await assert.rejects(f.engine.book(body, credential), (e) => e.code === 'QUOTE_EXPIRED');
  assert.deepEqual(publicTravelValue({ apiKey: 'x', nested: { accessToken: 'y', price: 200 } }), { nested: { price: 200 } });
});
test('explicit confirmation and numeric quote required before booking', async () => {
  const f = fixtureEngine(); const { body } = await quoteOf(f);
  await assert.rejects(f.engine.book({ ...body, confirmed: false }, credential), /明确确认/);
  const unknown = fixtureEngine({ unknownPrice: true }); const u = await quoteOf(unknown);
  await assert.rejects(unknown.engine.book(u.body, credential), (e) => e.code === 'UNKNOWN_PRICE');
  assert.equal(f.calls.filter((c) => c.action === 'book').length, 0);
});
test('book once; durable intent before call; no passenger PII in records', async () => {
  const f = fixtureEngine(); const { body } = await quoteOf(f);
  const result = await f.engine.book(body, credential); const repeated = await f.engine.book(body, credential);
  assert.equal(result.id, repeated.id); assert.equal(result.status, 'created_unpaid'); assert.equal(f.calls.filter((c) => c.action === 'book').length, 1);
  assert.match(f.persisted[0], /submitting/); assert.ok(!f.persisted.join('').includes('13800000000')); assert.ok(!f.persisted.join('').includes('虚构测试'));
  assert.equal(f.calls.at(-1).args.preBookParam, 'fixture-book-secret');
  assert.equal(f.engine.listOrders({ ...credential, secret: 'other' }).length, 0);
});
test('uncertain booking never auto-retries; unsafe supplier checkout is suppressed', async () => {
  const f = fixtureEngine({ bookingError: true }); const { body } = await quoteOf(f);
  await assert.rejects(f.engine.book(body, credential), /timeout/); await assert.rejects(f.engine.book(body, credential), (e) => e.code === 'ORDER_UNCERTAIN');
  assert.equal(f.calls.filter((c) => c.action === 'book').length, 1); assert.equal(f.engine.listOrders(credential)[0].status, 'unknown');
  const unsafe = fixtureEngine({ unsafePay: true }); const u = await quoteOf(unsafe); assert.equal((await unsafe.engine.book(u.body, credential)).paymentUrl, null);
});
test('flight required info, adult/child validation and unpaid cancellation are enforced', async () => {
  const f = fixtureEngine(); const { s, body } = await quoteOf(f, flight);
  const tourists = [{ name: '虚构测试', idType: '护照', idNumber: 'FIXTURE000', birthday: '2080-01-01', psptEndDate: '2100-01-01', sex: 9, type: '成人' }];
  await assert.rejects(f.engine.book({ ...body, tourists }, credential), /须知/);
  await f.engine.requirements(s.id, credential);
  const receipt = await f.engine.book({ ...body, tourists }, credential);
  await assert.rejects(f.engine.cancelOrder({ orderId: receipt.id, confirmed: false }, credential), /确认/);
  await assert.rejects(f.engine.cancelOrder({ orderId: receipt.id, confirmed: true }, { ...credential, secret: 'other' }), /不属于/);
  const cancelled = await f.engine.cancelOrder({ orderId: receipt.id, confirmed: true }, credential); assert.equal(cancelled.status, 'cancelled_unpaid');
  await assert.rejects(f.engine.cancelOrder({ orderId: receipt.id, confirmed: true }, credential));
  assert.equal(f.calls.filter((c) => c.action === 'cancel').length, 1);
});
test('passenger age, valid dates, ID checksum and expiry validated', () => {
  const p = { name: '虚构', idType: '护照', idNumber: 'FIXTURE', birthday: '2080-02-01', psptEndDate: '2100-01-01', sex: 1, type: '成人' };
  assert.equal(validateTravelPassenger(p, flight.date, '13800000000').type, '成人');
  for (const change of [{ birthday: '2098-01-01' }, { birthday: '2090-01-01' }, { psptEndDate: '2090-01-01' }, { birthday: '2080-02-30' }, { idType: '身份证', idNumber: '110101199001010000' }]) assert.throws(() => validateTravelPassenger({ ...p, ...change }, flight.date, '13800000000'));
});
test('JSON-RPC/SSE parsing skips notifications; structured JSON and plain instructions', () => {
  assert.equal(parseRpc('data: {"method":"notifications/progress"}\n\ndata: {"id":7,"result":{"ok":true}}\n\n', 7).result.ok, true);
  assert.equal(parseRpc('{"id":7,"result":123}', 7).result, 123);
  assert.throws(() => parseRpc('{"id":8}', 7));
  assert.deepEqual(unpackTool({ content: [{ type: 'text', text: '```json\n{"hotels":[]}\n```' }] }), { hotels: [] });
  assert.equal(unpackTool({ content: [{ type: 'text', text: '请提供证件' }] }).text, '请提供证件');
  assert.throws(() => unpackTool({ structuredContent: { successCode: false } }));
  assert.deepEqual(unpackTool({ structuredContent: { result: JSON.stringify({ successCode: true, data: [{ flightNumber: 'fixture' }] }) } }).data, [{ flightNumber: 'fixture' }]);
  assert.equal(unpackTool({ structuredContent: { result: '证件、旅客类型和联系人为必填' } }).text, '证件、旅客类型和联系人为必填');
  assert.throws(() => unpackTool({ structuredContent: { result: '{"successCode":false}' } }));
});
test('transport only official endpoint; rejects unknown tool/schema before network; HTTP errors redact body', async () => {
  let seen;
  await tuniuRpc(credential, 'hotel', 'tools/list', {}, { countQuota: false, fetchImpl: async (url, options) => { seen = { url, options }; const request = JSON.parse(options.body); return new Response(JSON.stringify({ id: request.id, result: { tools: [] } })); } });
  assert.equal(seen.url, 'https://openapi.tuniu.cn/mcp/hotel'); assert.equal(seen.options.headers.apiKey, credential.secret); assert.equal(seen.options.redirect, 'error');
  await assert.rejects(callTuniu(credential, 'hotel', 'search', { injected: 'x' }, [{ name: 'tuniuHotelSearch', inputSchema: { properties: { cityName: {} } } }]), (e) => e.code === 'SCHEMA_MISMATCH');
  await assert.rejects(callTuniu(credential, 'hotel', 'arbitrary', {}, []), (e) => e.code === 'MISSING_CAPABILITY');
  await assert.rejects(tuniuRpc(credential, 'flight', 'tools/list', {}, { countQuota: false, fetchImpl: async () => new Response('SECRET must never leak', { status: 401 }) }), (e) => e.status === 401 && !e.message.includes('SECRET'));
});
test('quota stops sixth request per minute without automatic retries', async () => {
  let calls = 0; const c = { type: 'apiKey', secret: randomUUID() };
  const options = { fetchImpl: async (url, options) => { calls++; return new Response(JSON.stringify({ id: JSON.parse(options.body).id, result: {} })); } };
  for (let i = 0; i < 5; i++) await tuniuRpc(c, 'hotel', 'tools/list', {}, options);
  await assert.rejects(tuniuRpc(c, 'hotel', 'tools/list', {}, options), (e) => e.status === 429 && e.retryAfter > 0); assert.equal(calls, 5);
});
test('OAuth PKCE state/cookie binding, one-use exchange, verified subject stable across token rotation', async () => {
  let verifier, authorization;
  const registration = async (url, options) => { authorization = JSON.parse(options.body); return new Response(JSON.stringify({ client_id: 'fixture-client' })); };
  const start = await startTravelOAuth('http://127.0.0.1:3012', registration); const url = new URL(start.url);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); assert.equal(authorization.token_endpoint_auth_method, 'none'); assert.match(url.searchParams.get('scope'), /openid/);
  await assert.rejects(finishTravelOAuth(start.state, 'wrong-cookie', 'fixture-code'), (e) => e.code === 'OAUTH_STATE_INVALID');
  const end = await finishTravelOAuth(start.state, start.state, 'fixture-code', async (endpoint, options) => {
    if (endpoint.endsWith('/userinfo')) return new Response(JSON.stringify({ sub: 'verified-fixture-user' }));
    verifier = new URLSearchParams(options.body).get('code_verifier'); return new Response(JSON.stringify({ access_token: 'fixture-private-token', expires_in: 3600 }));
  });
  assert.ok(verifier.length >= 43); assert.equal(end.credential.providerUserId, 'verified-fixture-user');
  assert.equal(accountOwner(end.credential), accountOwner({ ...end.credential, secret: 'rotated-fixture-token' }));
  await assert.rejects(finishTravelOAuth(start.state, start.state, 'fixture-code'), (e) => e.code === 'OAUTH_STATE_INVALID');
});
