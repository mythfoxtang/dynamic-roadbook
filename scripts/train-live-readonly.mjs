import fs from 'node:fs';
import { listTuniuTools, callTuniu } from '../lib/tuniu-transport.mjs';
const secret = fs.readFileSync('.env.local','utf8').match(/^TUNIU_API_KEY=(.+)$/m)?.[1]?.trim();
const c = { type:'apiKey', secret };
const tools = await listTuniuTools(c, 'train');
fs.writeFileSync('.automation/train-tool-schema.json', JSON.stringify(tools,null,2));
console.log(JSON.stringify(tools.map(t=>({ name:t.name, properties:Object.keys(t.inputSchema?.properties||{}) })),null,2));
const date = new Date(Date.now()+3*86400000).toISOString().slice(0,10);
const result = await callTuniu(c,'train','search',{ departureCityName:'上海', arrivalCityName:'南京', departureDate:date },tools);
fs.writeFileSync('.automation/train-actual-search.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({ date, keys:Object.keys(result), dataType:Array.isArray(result.data)?'array':typeof result.data, count:result.data?.length, totalPages:result.totalPageNum, sample:result.data?.slice?.(0,1) },null,2));
const row = result.data?.find((r)=>/^[GDC]/.test(r.trainNum));
if (row) {
  const detail=await callTuniu(c,'train','detail',{departureStationName:row.departStationName,arrivalStationName:row.destStationName,departureDate:date,trainNum:row.trainNum},tools);
  fs.writeFileSync('.automation/train-actual-detail.json',JSON.stringify(detail,null,2));
  console.log(JSON.stringify({detailKeys:Object.keys(detail),dataKeys:Object.keys(detail.data||{}),seatCount:detail.data?.seatInfo?.length},null,2));
}
