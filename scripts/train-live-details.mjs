import fs from 'node:fs';
import { callTuniu } from '../lib/tuniu-transport.mjs';
const secret=fs.readFileSync('.env.local','utf8').match(/^TUNIU_API_KEY=(.+)$/m)?.[1]?.trim();
const c={type:'apiKey',secret},tools=JSON.parse(fs.readFileSync('.automation/train-tool-schema.json','utf8'));
const previous=JSON.parse(fs.readFileSync('.automation/train-actual-search.json','utf8'));
const next=await callTuniu(c,'train','search',{queryId:previous.queryId,pageNum:2},tools);
fs.writeFileSync('.automation/train-actual-page2.json',JSON.stringify(next,null,2));
console.log(JSON.stringify({page2Count:next.data?.length,queryIdPresent:!!next.queryId,totalPages:next.totalPageNum}));
const date=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
const result=await callTuniu(c,'train','search',{departureCityName:'上海',arrivalCityName:'南京',departureDate:date,searchType:'3'},tools);
fs.writeFileSync('.automation/train-actual-fast.json',JSON.stringify(result,null,2));
const row=result.data?.find(r=>/^[GDC]/.test(r.trainNum));
console.log(JSON.stringify({fastCandidates:result.data?.length,highSpeed:result.data?.filter(r=>/^[GDC]/.test(r.trainNum)).length,firstTrain:row?.trainNum}));
if(row){const detail=await callTuniu(c,'train','detail',{departureStationName:row.departStationName,arrivalStationName:row.destStationName,departureDate:date,trainNum:row.trainNum},tools);fs.writeFileSync('.automation/train-actual-detail.json',JSON.stringify(detail,null,2));console.log(JSON.stringify(detail,null,2));}
