import {validateDiscovery,normalizeDiscoveryPoi,validatePoiKind,poiMatchesCity} from './discovery-core.mjs';
export async function discoveryRequest(body,signal){
 const response=await fetch('/api/discovery/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
 const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'地点查询失败'),{code:data.code});return data;
}
export async function searchDiscovery(body,signal){
 try{return await discoveryRequest({...body,action:'search'},signal);}catch(error){if(error.code!=='AMAP_NOT_CONFIGURED')throw error;}
 const q=validateDiscovery(body),key=process.env.NEXT_PUBLIC_AMAP_KEY;
 if(!key)throw new Error('高德地图尚未配置；仍可查询景区名录与官方路线');
 window._AMapSecurityConfig=process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE?{securityJsCode:process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE}:window._AMapSecurityConfig||{};
 const {default:loader}=await import('@amap/amap-jsapi-loader');
 const AMap=await loader.load({key,version:'2.0',plugins:['AMap.PlaceSearch','AMap.Geocoder']});
 if(signal?.aborted)throw new DOMException('已取消','AbortError');
 return new Promise((resolve,reject)=>{
  let settled=false;const finish=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);err?reject(err):resolve(value);};
  const abort=()=>finish(new DOMException('已取消','AbortError'));
  const timer=setTimeout(()=>finish(new Error('高德地图搜索超时，请稍后重试')),35000);signal?.addEventListener('abort',abort,{once:true});
  const search=new AMap.PlaceSearch({city:q.city,citylimit:true,type:q.kind==='food'?'餐饮服务':'风景名胜|体育休闲服务|博物馆',pageSize:25,pageIndex:q.page,extensions:'all'});
  const callback=(status,result)=>{
   if(status==='no_data')return finish(null,{items:[],page:q.page,hasMore:false,scope:q.city,notice:'指定范围内暂无匹配地点，请调整关键词。'});
   if(status!=='complete')return finish(new Error('高德地图查询未成功，请检查网络或地图权限'));
   const raw=result?.poiList?.pois||[],count=Number(result?.poiList?.count)||0;
   const items=raw.filter(p=>validatePoiKind(p,q.kind)&&poiMatchesCity(p,q.city)).map(p=>normalizeDiscoveryPoi(p,q.kind)).filter(Boolean);
   finish(null,{items,page:q.page,hasMore:q.page<8&&raw.length===25&&count>q.page*25,scope:q.center?`${q.city}，指定位置周边5公里`:`限定${q.city}`,source:'高德地图',truncated:count>200,notice:'评分、人均与营业时间可能缺失；营业状态与绕路时间未实时核实。搜索并非全量景点清单。'});
  };
  if(q.center)search.searchNearBy(q.keyword,q.center,q.radius,callback);else search.search(q.keyword,callback);
 });
}
