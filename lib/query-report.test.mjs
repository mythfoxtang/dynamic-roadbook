import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withQueryReport,readQueryReport} from './query-report.mjs';
test('consumed request still produces persisted markdown for success and failure, omitting secrets',async()=>{
 for(const status of [200,400]){
  const request=new Request('http://localhost/api/travel/query/',{method:'POST',body:JSON.stringify({action:'search',kind:'hotel',city:'昆明',apiKey:'secret-for-test',input:'private-traveler'})});
  const response=await withQueryReport(request,async r=>{await r.json();return Response.json(status===200?{data:{offers:[]}}:{error:'城市无效'},{status});});
  const url=response.headers.get('X-Query-Report');assert.ok(url);const report=await readQueryReport(url.split('/').at(-2));
  assert.match(report,new RegExp('HTTP：'+status));assert.match(report,/昆明/);assert.doesNotMatch(report,/secret-for-test|private-traveler/);
  if(status===200)assert.match(report,/无可售候选/);else assert.match(report,/城市无效/);
 }
 assert.equal(await readQueryReport('../key'),null);
});
