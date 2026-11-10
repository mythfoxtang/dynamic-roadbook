import fs from 'node:fs';
import { listTuniuTools, callTuniu } from '../lib/tuniu-transport.mjs';
const secret = fs.readFileSync('.env.local','utf8').match(/^TUNIU_API_KEY=(.+)$/m)?.[1]?.trim();
const c = { type: 'apiKey', secret };
const domain = process.argv[2] || 'flight';
const tools = await listTuniuTools(c, domain);
const schema = tools.map(({ name, inputSchema }) => ({ name, inputSchema }));
fs.writeFileSync(`.automation/${domain}-tool-schema.json`, JSON.stringify(schema, null, 2));
const date = new Date(Date.now()+7*86400000).toISOString().slice(0,10);
const args = domain === 'flight' ? { departureCityName: '上海', arrivalCityName: '成都', departureDate: date } : { cityName: process.argv[3] || '芒康', checkIn: date, checkOut: new Date(Date.now()+8*86400000).toISOString().slice(0,10), prices: '200-300' };
const result = await callTuniu(c, domain, 'search', args, tools);
// Search-only public inventory response; no credential or traveler data is included.
fs.writeFileSync(`.automation/${domain}-actual-search.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ domain, keys: Object.keys(result), shape: Object.fromEntries(Object.entries(result).map(([k,v])=>[k, Array.isArray(v)?{type:'array',length:v.length,itemKeys:Object.keys(v[0]||{})}: v && typeof v==='object'?{type:'object',keys:Object.keys(v)} : {type:typeof v,value:typeof v==='string'?v.slice(0,250):v}])) }, null, 2));
