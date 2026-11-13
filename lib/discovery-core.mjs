export class DiscoveryError extends Error {constructor(message,status=400,code='INVALID_QUERY'){super(message);this.status=status;this.code=code;}}
export function validateDiscovery(input){
 const kind=input.kind||'play',city=String(input.city||'').trim(),keyword=String(input.keyword||'').trim();
 if(!['food','play'].includes(kind))throw new DiscoveryError('请选择餐饮或游玩');
 if(!city||city.length>60)throw new DiscoveryError('请填写本次搜索的城市或区县');
 if(keyword.length>80)throw new DiscoveryError('关键词不能超过80字');
 const page=Number(input.page||1);if(!Number.isInteger(page)||page<1||page>8)throw new DiscoveryError('搜索最多支持8页，请缩小范围继续');
 let center=null;if(input.center!=null){if(!Array.isArray(input.center)||input.center.length!==2||input.center.some(n=>typeof n!=='number'||!Number.isFinite(n))||Math.abs(input.center[0])>180||Math.abs(input.center[1])>90)throw new DiscoveryError('中心坐标无效');center=input.center;}
 return {kind,city,keyword:keyword||(kind==='food'?'美食':'景点'),page,center,radius:5000,types:kind==='food'?'050000':'110000|080000|140100'};
}
export function normalizeDiscoveryPoi(p,kind){
 const location=typeof p.location==='string'?p.location:p.location?`${p.location.lng??p.location.getLng?.()},${p.location.lat??p.location.getLat?.()}`:'';
 const coord=location.split(',').map(Number),b=p.business||p.biz_ext||{};
 if(coord.length!==2||!location||coord.some(n=>!Number.isFinite(n))||Math.abs(coord[0])>180||Math.abs(coord[1])>90)return null;
 return {id:p.id||`${p.name}|${location}`,name:p.name,location,coord,kind,address:[p.pname,p.cityname,p.adname,p.address].filter(v=>typeof v==='string'&&v).join(' '),type:p.type||'',rating:b.rating||p.rating||null,cost:b.cost||p.cost||null,opentime:b.opentime_today||b.opentime_week||p.opentime||null,source:'高德地图',coordinateSystem:'GCJ-02',fetchedAt:new Date().toISOString(),reason:kind==='food'?'在指定范围内找到的餐饮候选，请结合口味与营业情况选择':'在指定范围内找到的游玩候选，请结合可用时间选择',durationMinutes:null};
}
export function validatePoiKind(p,kind){
 const type=String(p.typecode||p.type||'');
 return kind==='food'?/^05/.test(type)||/餐饮/.test(type):/^(11|08|1401)/.test(type)||/风景|体育休闲|博物馆/.test(type);
}
export function poiMatchesCity(p,city){
 const token=String(city).replace(/市$|县$|区$/,'');
 const fields=[p.pname,p.cityname,p.adname,p.district,p.address].filter(v=>typeof v==='string');
 return fields.some(v=>v.includes(token));
}
export async function searchAmap(input,{key=process.env.AMAP_WEB_SERVICE_KEY,fetchImpl=fetch}={}){
 const q=validateDiscovery(input);
 if(!key||/^your_/i.test(key))throw new DiscoveryError('服务端高德尚未配置，将尝试已有地图搜索',503,'AMAP_NOT_CONFIGURED');
 const url=new URL(q.center?'https://restapi.amap.com/v5/place/around':'https://restapi.amap.com/v5/place/text');
 const params={key,keywords:q.keyword,types:q.types,region:q.city,city_limit:'true',page_size:'25',page_num:String(q.page),show_fields:'business,navi'};
 if(q.center)Object.assign(params,{location:q.center.join(','),radius:String(q.radius)});
 url.search=new URLSearchParams(params).toString();
 let response;try{response=await fetchImpl(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw new DiscoveryError('高德连接超时或网络不可用，请重试',502,'AMAP_NETWORK');}
 if(!response.ok)throw new DiscoveryError('高德服务暂时不可用',502,'AMAP_UPSTREAM');
 const data=await response.json().catch(()=>null);
 if(data?.status!=='1'){const code=String(data?.infocode||'');throw new DiscoveryError(['10003','10004','10044','10021','40000'].includes(code)?'高德额度或频率受限，请稍后再试':'高德查询未成功，请检查服务权限',502,'AMAP_REJECTED');}
 const raw=Array.isArray(data.pois)?data.pois:[],items=raw.filter(p=>validatePoiKind(p,q.kind)&&poiMatchesCity(p,q.city)).map(p=>normalizeDiscoveryPoi(p,q.kind)).filter(Boolean);
 const count=Number(data.count)||0;
 return {items,page:q.page,hasMore:q.page<8&&raw.length===25&&count>q.page*25,source:'高德地图 Web 服务',scope:q.center?`${q.city}，指定位置周边5公里`:`限定${q.city}`,notice:'评分、人均与营业时间可能缺失；未核实到达时营业及实际绕路时间。搜索并非全量景点清单。',truncated:count>200};
}
