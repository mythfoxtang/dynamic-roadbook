import { randomUUID } from 'node:crypto';
import { TravelError, validateTravelSearch } from './travel-core.mjs';
import { numericPrice } from './travel-filters.mjs';
export const TRAIN_SEATS = [ ['edz','二等座'], ['ydz','一等座'], ['swz','商务座'], ['tdz','特等座'], ['yz','硬座'], ['rz','软座'], ['yw','硬卧'], ['rw','软卧'], ['gjrw','高级软卧'], ['dw','动卧'], ['ydw','一等卧'], ['edw','二等卧'], ['wz','无座'] ];
export function validateTrainSearch(body,{allowFuturePlanning=false}={}) {
  const query = validateTravelSearch({ ...body, kind:'flight', mode:'LOWEST' });
  query.kind='train'; query.mode=String(body.mode || '3');
  if (!/^[1-6]$/.test(query.mode)) throw new TravelError('请选择有效的高铁排序方式');
  if (query.children) throw new TravelError('当前官方火车票创单仅支持成人，请使用成人查询；儿童、学生及优惠票需另行核实');
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if (!allowFuturePlanning&&(Date.parse(query.date)-Date.parse(today))/86400000 > 14) throw new TravelError('铁路当前按含当天的 15 天预售期查询，请选择更近日期');
  return query;
}
const count=(value)=>value===null||value===undefined||value===''?null:Number.isInteger(Number(value))&&Number(value)>=0?Number(value):null;
export function normalizeTrains(result,query) {
  return (Array.isArray(result.data)?result.data:[]).map(r=>{
    const seats=TRAIN_SEATS.map(([code,name])=>({code,name,price:numericPrice(r.price?.[`${code}Price`]),remaining:count(r.seatAvailable?.[`${code}Num`])})).filter(s=>s.price!==null);
    const sale=seats.filter(s=>s.remaining!==0); const prices=sale.map(s=>s.price);
    return {id:randomUUID(),kind:'train',supplierId:String(r.trainNum||''),name:String(r.trainNum||''),departureStation:String(r.departStationName||''),arrivalStation:String(r.destStationName||''),departureTime:String(r.departureTime||''),arrivalTime:String(r.arrivalTime||''),duration:String(r.duration||''),highSpeed:/^[GDC]/.test(r.trainNum||''),seats,price:prices.length?Math.min(...prices):null,currency:'CNY',query};
  }).filter(r=>r.supplierId);
}
export function normalizeTrainSeats(result,query,offer) {
  const info=result.data?.trainInfo;
  if (!info || !Array.isArray(result.data?.seatInfo)) throw new TravelError('供应商未返回可核对的车次与席别详情',502,'INVALID_TRAIN_DETAIL');
  if (String(info.trainNum)!==offer.supplierId || info.departsDate!==query.date || info.departStationName!==offer.departureStation || info.destStationName!==offer.arrivalStation) throw new TravelError('详情车次、站点或日期与所选结果不一致，已阻止预订',502,'TRAIN_DETAIL_MISMATCH');
  return result.data.seatInfo.map(s=>({id:randomUUID(),name:String(s.seatName||''),price:numericPrice(s.price),seats:count(s.leftNumber),stockText:String(s.seatStatus||''),standing:Number(s.seatId)===9,bookingParam:Number.isSafeInteger(Number(s.resId))&&Number(s.resId)>0?String(s.resId):'',departureDate:info.departsDate,query})).filter(s=>s.bookingParam);
}
export function safeTrainOrderSummary(result) {
  const d=result.data;
  if (!d || typeof d!=='object') throw new TravelError('供应商未返回订单状态',502,'INVALID_ORDER_STATUS');
  // Explicit allowlist: upstream also includes names, IDs, phone numbers and birthdays.
  return {providerStatus:typeof d.statusName==='string'?d.statusName:'待确认',providerPayStatus:typeof d.payStatusName==='string'?d.payStatusName:'待确认',providerPayCode:Number.isInteger(d.payStatus)?d.payStatus:null,totalPrice:numericPrice(d.totalPrice),payAmount:numericPrice(d.payAmount),syncedAt:new Date().toISOString()};
}
