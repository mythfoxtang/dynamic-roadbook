import { TravelError, requiredText, number } from './travel-core.mjs';
import { numericPrice } from './travel-filters.mjs';
export function validateCarSearch(body, now=Date.now()) {
  const query={kind:'car',city:requiredText(body.city,'取车城市'),returnCity:requiredText(body.returnCity,'还车城市'),pickupPlace:typeof body.pickupPlace==='string'?body.pickupPlace.trim().slice(0,100):'',returnPlace:typeof body.returnPlace==='string'?body.returnPlace.trim().slice(0,100):''};
  for(const field of ['pickupAt','returnAt']) {
    const value=requiredText(body[field],field==='pickupAt'?'取车时间':'还车时间');
    const time=Date.parse(`${value}:00+08:00`);
    if(!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value)||!Number.isFinite(time)||new Date(time+8*3600000).toISOString().slice(0,16)!==value)throw new TravelError('取还车时间无效，请使用北京时间');
    query[field]=value;
  }
  const start=Date.parse(`${query.pickupAt}:00+08:00`),end=Date.parse(`${query.returnAt}:00+08:00`);
  if(start<now)throw new TravelError('取车时间已过期，请重新选择');
  if(end<=start||end-start>90*86400000)throw new TravelError('还车须晚于取车，单次租期不超过90天');
  query.hours=(end-start)/3600000;query.estimatedDays=Math.ceil(query.hours/24);query.oneWay=query.city!==query.returnCity;
  query.adults=number(body.adults,'乘车人数',1,9,2);query.driverAge=number(body.driverAge,'驾驶人年龄',18,75,25);
  if(!Number.isInteger(query.adults)||!Number.isInteger(query.driverAge))throw new TravelError('人数和年龄须为整数');
  query.maxTotal=number(body.maxTotal,'整段租期总预算',0,100000,null);query.category=typeof body.category==='string'?body.category.slice(0,40):'';
  return query;
}
export function carProviderStatus(env=process.env) {return {connected:Boolean(env.CAR_RENTAL_GATEWAY_URL&&env.CAR_RENTAL_GATEWAY_TOKEN),provider:env.CAR_RENTAL_PROVIDER_NAME||'租车合作接口',source:'unavailable'};}
const fees=['rental','basicInsurance','extraInsurance','service','oneWay','delivery','other'];
export async function searchCarRentals(body,{env=process.env,fetchImpl=fetch,now=Date.now()}={}) {
  const query=validateCarSearch(body,now),status=carProviderStatus(env);
  if(!status.connected)return {...status,query,offers:[],notice:'租车页面已可保存取还车计划；真实车型与费用需要独立租车供应商授权。途牛机票酒店 Key 不包含自驾租车货源。'};
  let url;try{url=new URL(env.CAR_RENTAL_GATEWAY_URL);}catch{throw new TravelError('租车接口配置无效',503);}
  if(url.protocol!=='https:'||url.username||url.password)throw new TravelError('租车接口须使用服务端配置的 HTTPS 地址',503);
  url.pathname=`${url.pathname.replace(/\/$/,'')}/search`;url.search='';
  let response;try{response=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.CAR_RENTAL_GATEWAY_TOKEN}`},body:JSON.stringify(query),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(35000)});}catch{throw new TravelError('租车接口连接失败，请稍后重试',502);}
  if(!response.ok)throw new TravelError(`租车供应商查询失败（${response.status}）`,502);
  const data=await response.json();
  if(!Array.isArray(data.offers)||typeof data.liveMode!=='boolean'||typeof data.provider!=='string'||!data.provider.trim())throw new TravelError('租车响应缺少来源、正式环境标识或报价列表',502);
  if(!['city','returnCity','pickupAt','returnAt'].every(k=>data.query?.[k]===query[k]))throw new TravelError('租车报价与取还车城市或时间不一致',502,'CAR_QUERY_MISMATCH');
  const offers=data.offers.slice(0,200).map(o=>{
    if(!o||typeof o.id!=='string'||!o.id||typeof o.name!=='string'||!o.name||o.currency!=='CNY'||o.priceBasis!=='rental_total'||numericPrice(o.totalAmount)===null)throw new TravelError('租车报价须提供人民币整段租期总价',502,'INVALID_CAR_PRICE');
    const charges=Object.fromEntries(fees.map(k=>[k,numericPrice(o.fees?.[k])]));
    const total=numericPrice(o.totalAmount),complete=Object.values(charges).every(v=>v!==null);
    if(complete&&Math.abs(Object.values(charges).reduce((a,b)=>a+b,0)-total)>0.02)throw new TravelError('租车费用分项与总额不一致，须向供应商重新核实',502,'CAR_TOTAL_MISMATCH');
    return {id:o.id.slice(0,160),name:o.name.slice(0,200),provider:data.provider.slice(0,100),totalAmount:total,currency:'CNY',fees:charges,deposit:numericPrice(o.deposit),category:typeof o.category==='string'?o.category.slice(0,50):'',seats:Number.isInteger(o.seats)&&o.seats>0?o.seats:null,transmission:['自动','手动'].includes(o.transmission)?o.transmission:null,unlimitedMileage:typeof o.unlimitedMileage==='boolean'?o.unlimitedMileage:null,remainingMileage:numericPrice(o.remainingMileage),store:typeof o.store==='string'?o.store.slice(0,200):'',refund:typeof o.refund==='string'?o.refund.slice(0,1500):'',conditions:typeof o.conditions==='string'?o.conditions.slice(0,2000):'',expiresAt:typeof o.expiresAt==='string'&&Number.isFinite(Date.parse(o.expiresAt))?o.expiresAt:null};
  });
  return {connected:true,source:data.liveMode?'live':'test',provider:data.provider.slice(0,100),query,offers,queriedAt:new Date(now).toISOString(),notice:data.liveMode?'费用与库存须在取车条件一致时核对，押金单列，不自动当作租金。':'测试环境报价，不能用于实际租车。'};
}
export {filterCarOffers} from "./travel-filters.mjs";
