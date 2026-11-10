// Curated geographic evidence is a tool reference, never an itinerary template.
export const VERIFIED_PLACES=[{name:'三峡之巅',city:'奉节县',acceptedCities:['奉节','奉节县'],source:'https://www.cqfj.gov.cn/index/fjwl/jpjq/202209/t20220914_11109757.html'}];
export function checkTaskLocation(task){
 const query=task.query||{};
 if(!['hotel','attraction'].includes(task.kind))return null;
 const scope=[task.title,query.poi,query.name].filter(Boolean).join(' ');
 const place=VERIFIED_PLACES.find(p=>scope.includes(p.name));
 if(!place||place.acceptedCities.includes(query.city))return null;
 return {message:`${place.name}位于${place.city}，当前城市“${query.city}”与已核对地点不符；已停止展示此项报价，请让智能体修正地点后重查。`,expectedCity:place.city,source:place.source};
}
export function quarantineLocationResults(plan,results){return Object.fromEntries(Object.entries(results||{}).map(([id,result])=>{const task=plan.tasks.find(t=>t.id===id),conflict=task&&checkTaskLocation(task);return [id,conflict?{state:'blocked',offers:[],notice:conflict.message,locationConflict:conflict}:result];}));}
