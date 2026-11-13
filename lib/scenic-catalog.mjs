import fs from 'node:fs';
import path from 'node:path';
const seed=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data/scenic/five-a.json'),'utf8'));
export const SCENIC_PROFILES=[
 {id:'sanxia-summit',name:'三峡之巅',aliases:['三峡之巅景区'],city:'奉节县',province:'重庆市',source:'https://www.cqfj.gov.cn/index/fjwl/jpjq/202209/t20220914_11109757.html',routes:[{name:'观景轻松版',sequence:['游客中心（入口需复核）','景区接驳或索道（运行需复核）','夔鼓广场','四望乐坛','返程接驳'],note:'官方介绍确认内部景点；这里是待核验游览建议，非已确认运营线路。'},{name:'徒步版',sequence:['登山入口（需复核）','登山步道','山顶观景区','按已确认出口返程'],note:'徒步入口、单程时长、路段开放和末班接驳需出发前确认。'}],checks:['入口和停车场','预约与门票','徒步路段开放','索道和景交末班','山顶天气与返程体力']},
 {id:'enshi-canyon',name:'恩施大峡谷',aliases:['七星寨','云龙地缝','恩施大峡谷景区'],city:'恩施市',province:'湖北省',source:'https://www.esdaxiagu.com/line/797.html',routes:[{name:'官方双片区参考线',sequence:['游客中心','地面缆车','索道广场','云龙地缝','索道广场','索道上行','七星寨','景交车','游客中心'],note:'来自 2021-05-01 官方路线，当前开放范围与交通运营未实时核实；时间不足时选单片区。'}],checks:['七星寨和云龙地缝开放范围','门票所含交通','索道及地缆末班','步行强度','雨天步道限制']}
];
const norm=s=>String(s||'').replace(/[\s·—\-]/g,'').replace(/旅游景区|风景名胜区|风景区|景区/g,'');
export function searchScenicCatalog({query='',region='',page=1}={}){
 const q=norm(query),r=String(region).trim();
 const curated=SCENIC_PROFILES.map(p=>({id:p.id,name:p.name,city:p.city,province:p.province,source:p.source,status:'官方资料参考',profile:p,aliases:p.aliases}));
 const all=[...curated,...seed.map(p=>({id:p.slug,name:p.name_zh,city:p.city_zh,province:p.province_zh,source:p.profile_url,status:'第三方名录候选，等级与位置待核实',aliases:[],coordinateSystem:'WGS-84'}))];
 const matches=all.filter(p=>(!q||[p.name,...p.aliases].some(n=>norm(n).includes(q)))&&(!r||[p.city,p.province].some(n=>n?.includes(r)||r.includes(n))));
 const seen=new Set(),items=matches.filter(p=>{const key=norm(p.name);if(seen.has(key))return false;seen.add(key);return true;});
 const current=Math.max(1,Math.min(100,Number(page)||1));
 return {items:items.slice((current-1)*20,current*20),total:items.length,page:current,pageSize:20,hasMore:current*20<items.length,coverage:{seedRecords:seed.length,verifiedProfiles:SCENIC_PROFILES.length,scope:'第三方5A候选与已整理官方路线；尚未覆盖全国全部景区',source:'https://github.com/tuansuwu/china-5a-scenic-areas',license:'CC BY-SA 4.0',asOf:'2026-11-13'}};
}
export function auditScenicDays(days=[]){
 return days.slice(0,60).map(day=>{
  const text=[day.activity,...(day.stops||[]).map(s=>typeof s==='string'?s:s?.name)].join(' ');
  const profiles=SCENIC_PROFILES.filter(p=>[p.name,...p.aliases].some(n=>text.includes(n)));
  return {date:day.date,city:day.city,profiles:profiles.map(p=>({...p,cityConflict:!String(day.city||'').includes(p.city.replace(/市$|县$/,'')),routeCovered: p.routes[0].sequence.filter(n=>text.includes(n)).length,routeTotal:p.routes[0].sequence.length})),notice:profiles.length?'内部路线仍需核实当前开放与接驳':'尚无已整理的官方内部路线；不代表没有景区。'};
 });
}
