// Real provider smoke test: discovery, searches, pagination and details ONLY.
// This script has no create-order, cancel or payment action.
import fs from 'node:fs';
import { listTuniuTools, callTuniu, quotaState } from '../lib/tuniu-transport.mjs';
import { TravelEngine } from '../lib/travel-engine.mjs';
import { filterTravelOffers } from '../lib/travel-filters.mjs';
const env = fs.readFileSync('.env.local', 'utf8');
const secret = env.match(/^TUNIU_API_KEY=(.+)$/m)?.[1]?.trim();
if (!secret) throw new Error('Configure TUNIU_API_KEY locally first');
const credential = { type: 'apiKey', secret };
const report = { startedAt: new Date().toISOString(), source: 'Tuniu official live', mode: 'read-only; no orders or payments', cases: [], tools: {}, complete: false };
const toolMap = {};
const save = () => { fs.mkdirSync('.automation', { recursive: true }); fs.writeFileSync('.automation/travel-live-report.json', JSON.stringify(report, null, 2)); };
async function readonlyCall(operation) {
  const quota = quotaState(credential);
  if (quota.retryAfter) { console.log(`Provider quota: waiting ${quota.retryAfter + 1}s; read-only action pending.`); await new Promise((r) => setTimeout(r, (quota.retryAfter + 1) * 1000)); }
  return operation();
}
for (const domain of ['hotel', 'flight']) {
  try { const tools = await readonlyCall(() => listTuniuTools(credential, domain)); toolMap[domain] = tools; report.tools[domain] = tools.map((t) => t.name); console.log(`${domain}: ${tools.length} official tools discovered`); }
  catch (e) { report.tools[domain] = { error: e.message, code: e.code }; console.log(`${domain}: ${e.message}`); }
}
const engine = new TravelEngine({ tools: async (c, domain) => toolMap[domain] || [], call: async (c, domain, action, args, tools) => {
  if (!['search', 'detail', 'requirements'].includes(action)) throw new Error('Read-only test refuses trading actions');
  return readonlyCall(() => callTuniu(c, domain, action, args, tools));
} });
const day = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + n * 86400000));
const cases = [
  { kind: 'hotel', city: '成都', startDate: day(7), endDate: day(8), adults: 2, children: 0, rooms: 1, minPrice: 200, maxPrice: 300 },
  { kind: 'flight', from: '上海', to: '成都', date: day(7), adults: 2, children: 0 },
  { kind: 'hotel', city: '丽江', startDate: day(14), endDate: day(16), adults: 2, children: 0, rooms: 1, minPrice: 200, maxPrice: 300 },
  { kind: 'hotel', city: '香格里拉', startDate: day(14), endDate: day(15), adults: 2, children: 0, rooms: 1, minPrice: 200, maxPrice: 300 },
  { kind: 'hotel', city: '芒康', startDate: day(7), endDate: day(8), adults: 2, children: 0, rooms: 1, minPrice: 200, maxPrice: 300 },
  { kind: 'flight', from: '北京', to: '上海', date: day(14), adults: 1, children: 1, mode: 'TIME', departureTime: '06:00-12:00' },
  { kind: 'flight', from: '成都', to: '拉萨', date: day(14), adults: 1, children: 0, mode: 'PRICE', minPrice: 200, maxPrice: 1000 },
];
for (const query of cases) {
  const entry = { query, status: 'pending' }; report.cases.push(entry);
  try {
    let result = await engine.search(query, credential); entry.firstPageCount = result.count; entry.totalPages = result.totalPages;
    if (result.totalPages > 1 && report.cases.length <= 2) result = await engine.next(result.id, credential, 1);
    entry.loadedPages = result.loadedPages; entry.candidateCount = result.count; entry.allDeclaredPagesLoaded = result.complete;
    entry.knownPrices = result.offers.filter((o) => o.price !== null).length;
    entry.referenceRange = result.offers.some((o) => o.price !== null) ? [Math.min(...result.offers.filter((o) => o.price !== null).map((o) => o.price)), Math.max(...result.offers.filter((o) => o.price !== null).map((o) => o.price))] : null;
    entry.filteredCount = filterTravelOffers(result.offers, query.kind === 'hotel' ? { maxPrice: 300 } : { directOnly: true }).length;
    entry.sample = result.offers.slice(0, 2).map((o) => ({ name: o.name, price: o.price, priceUnit: o.priceUnit, stars: o.stars, type: o.type }));
    if (result.offers.length && report.cases.length <= 3) {
      const detail = await engine.detail(result.id, result.offers[0].id, credential);
      entry.detail = { options: detail.options.length, knownPrices: detail.options.filter((o) => o.price !== null).length, notice: detail.priceNotice, policiesPresent: Object.keys(detail.policies || {}).length > 0 };
      if (query.kind === 'flight') entry.requirementsAvailable = Boolean((await engine.requirements(result.id, credential)).text);
    }
    entry.status = 'ok';
  } catch (e) { entry.status = 'failed'; entry.error = e.message; entry.code = e.code; }
  entry.finishedAt = new Date().toISOString(); save(); console.log(JSON.stringify(entry));
}
report.complete = true; report.finishedAt = new Date().toISOString(); report.estimatedRequests = quotaState(credential).usedToday; save();
console.log('Real read-only test finished; report: .automation/travel-live-report.json');
