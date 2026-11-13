import assert from 'node:assert/strict';
const base=process.argv[2]||'http://localhost:3010';
async function call(action,body={},cookie=''){
 const r=await fetch(base+'/api/travel-agent/',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({action,...body})});const data=await r.json();assert.ok(r.ok,data.error);return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]||cookie};
}
const a=await call('restore'),b=await call('restore');assert.notEqual(a.cookie,b.cookie);
const plan={title:'隔离测试：仅测试访客可见',input:'隔离测试',days:[{date:'2099-12-01',city:'昆明',activity:'测试'},{date:'2099-12-02',city:'昆明',activity:'返程'}],tasks:[{kind:'hotel',title:'测试住宿',query:{city:'昆明',startDate:'2099-12-01',endDate:'2099-12-02',adults:1,rooms:1}}],assumptions:[],warnings:[]};
await call('save',{state:{plan}},a.cookie);
assert.equal((await call('restore',{},a.cookie)).data.state.plan.title,plan.title);
assert.equal((await call('restore',{},b.cookie)).data.state,null);
console.log('PASS: production shared AI config gives separate visitor cookies; A save/restore is inaccessible from B. No model, supplier or order calls.');
