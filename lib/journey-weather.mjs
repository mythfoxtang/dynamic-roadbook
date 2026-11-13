const cache=new Map();
const dateInChina=now=>new Date(now+8*3600000).toISOString().slice(0,10);
const cityName=s=>s.replace(/市$|县$/g,'');
async function json(url,fetchImpl){const r=await fetchImpl(url,{signal:AbortSignal.timeout(12000),cache:'no-store'});if(!r.ok)throw Error('天气数据暂不可用');return r.json();}
async function cached(key,load,now){const old=cache.get(key);if(old&&now-old.time<3600000)return old.value;const value=await load();if(cache.size>300)cache.clear();cache.set(key,{value,time:now});return value;}
export function clothingFor({min,max,rain}){
 const advice=[];
 advice.push(min<=5?'建议厚外套或羽绒服，早晚加保暖内层。':min<=12?'建议毛衣或抓绒搭配防风外套，早晚穿长裤。':min<=20?'建议长袖配轻薄外套，白天可按体感减衣。':'建议轻薄透气衣物，室内空调环境备薄外套。');
 if(max-min>=10)advice.push('昼夜温差较大，采用方便增减的分层穿搭。');
 if(max>=28)advice.push('白天注意遮阳、补水，减少午后长时间暴晒。');
 if(min<=0)advice.push('注意保暖及结冰路面防滑。');
 if(typeof rain==='number'&&rain>=50)advice.push('降水概率较高，带雨具和防滑鞋，给户外活动准备室内替代。');
 advice.push('城市气温不能代表山顶或峡谷，登山前另查景区天气与风力。');return advice;
}
export async function journeyWeather(days,{fetchImpl=fetch,now=Date.now()}={}){
 if(!Array.isArray(days)||!days.length||days.length>31)throw Error('请提供1至31天行程');
 for(const d of days)if(typeof d.city!=='string'||!d.city.trim()||d.city.length>80||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date)throw Error('天气查询城市或日期无效');
 const today=dateInChina(now),end=dateInChina(now+15*86400000);
 const cities=[...new Set(days.map(d=>d.city))];const locations=new Map();
 await Promise.all(cities.map(async city=>{try{
  const geo=await cached('geo:'+city,()=>json('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:cityName(city),count:'10',language:'zh',countryCode:'CN'}),fetchImpl),now);
  const matches=(geo.results||[]).filter(p=>p.country_code==='CN'&&cityName(p.name)===cityName(city)&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude));
  const preferred=matches.filter(p=>['PPLC','PPLA','PPLA2','PPLA3'].includes(p.feature_code));const p=preferred.length===1?preferred[0]:matches.length===1?matches[0]:null;
  if(p)locations.set(city,p);
 }catch{}}));
 const pending=new Map();
 const rows=await Promise.all(days.map(async d=>{
  const base={date:d.date,city:d.city};const p=locations.get(d.city);
  if(!p)return {...base,type:'unavailable',notice:'未能唯一定位城市，当前天气查询支持中国城市；请补充明确行政城市名。'};
  try{
   const forecast=d.date>=today&&d.date<=end;
   if(d.date<today)return {...base,type:'unavailable',notice:'行程日期已过，不提供未来天气预报。'};
   const year=Number(today.slice(0,4))-1,month=d.date.slice(5,7),first=`${year}-${month}-01`,last=`${year}-${month}-${new Date(Date.UTC(year,Number(month),0)).getUTCDate()}`;
   const key=(forecast?'forecast:':'history:'+year+month+':')+p.latitude+','+p.longitude;
   if(!pending.has(key))pending.set(key,cached(key,()=>json((forecast?'https://api.open-meteo.com/v1/forecast?':'https://archive-api.open-meteo.com/v1/archive?')+new URLSearchParams({latitude:String(p.latitude),longitude:String(p.longitude),daily:forecast?'temperature_2m_max,temperature_2m_min,precipitation_probability_max':'temperature_2m_max,temperature_2m_min',timezone:'Asia/Shanghai',...(forecast?{forecast_days:'16'}:{start_date:first,end_date:last})}),fetchImpl),now));
   const data=await pending.get(key),daily=data.daily;
   let min,max,rain;
   if(forecast){const i=daily?.time?.indexOf(d.date);if(i==null||i<0)throw Error();min=daily.temperature_2m_min?.[i];max=daily.temperature_2m_max?.[i];rain=daily.precipitation_probability_max?.[i];}
   else{const avg=values=>{const nums=(values||[]).filter(Number.isFinite);if(nums.length<20)throw Error();return nums.reduce((a,b)=>a+b,0)/nums.length;};min=avg(daily?.temperature_2m_min);max=avg(daily?.temperature_2m_max);}
   if(!Number.isFinite(min)||!Number.isFinite(max))throw Error();
   return {...base,type:forecast?'forecast':'historical',min:Math.round(min),max:Math.round(max),rain:forecast&&Number.isFinite(rain)?rain:null,reference:forecast?null:`${year}年${Number(month)}月日最低/最高温的月平均`,notice:forecast?'天气预报可能变化，临出发请复查。':'超出未来16天预报范围；以下为去年同月历史参考，不是本次行程预报，也不是多年气候平均。',advice:clothingFor({min,max,rain:forecast?rain:null})};
  }catch{return {...base,type:'unavailable',notice:'天气服务暂未返回可用温度，请稍后刷新；未使用模型编造温度。'};}
 }));
 return {source:'Open-Meteo',sourceUrl:'https://open-meteo.com/',updatedAt:new Date(now).toISOString(),rows};
}
