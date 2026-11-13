'use client';
import {useEffect,useMemo,useState} from 'react';
import {AmapRouteOverview} from './full-route-overview';
import styles from './journey-map.module.css';
import JourneyWeather from './journey-weather';
import DiscoveryPanel from './discovery-panel';
const cache=new Map();
function locateOnce(AMap,city,name){
 const key=city+'|'+name;if(cache.has(key))return Promise.resolve(cache.get(key));
 return new Promise(resolve=>{
  let finished=false;const done=value=>{if(finished)return;finished=true;clearTimeout(timer);if(value)cache.set(key,value);resolve(value);};
  const timer=setTimeout(()=>done(null),9000);
  if(name===city)new AMap.Geocoder({city}).getLocation(city,(status,result)=>{const p=result?.geocodes?.[0]?.location;done(status==='complete'&&p?{name:city,coord:[p.lng,p.lat]}:null);});
  else new AMap.PlaceSearch({city,citylimit:true,pageSize:1}).search(name,(status,result)=>{const p=result?.poiList?.pois?.[0];done(status==='complete'&&p?.location?{name:p.name,coord:[p.location.lng,p.location.lat]}:null);});
 });
}
async function locate(AMap,city,name){return await locateOnce(AMap,city,name)||await locateOnce(AMap,city,name);}
export default function JourneyMap({days=[]}){
 const [selected,setSelected]=useState('all'),[resolved,setResolved]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const signature=JSON.stringify(days.map(d=>({date:d.date,city:d.city,stops:d.stops||[]})));
 useEffect(()=>{
  let cancelled=false;setResolved([]);setSelected('all');setError('');
  if(!days.length)return;
  if(!process.env.NEXT_PUBLIC_AMAP_KEY){setError('尚未配置高德地图，仍可查看下方逐日地点。');return;}
  setLoading(true);
  window._AMapSecurityConfig=process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE?{securityJsCode:process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE}:window._AMapSecurityConfig||{};
  (async()=>{
   const {default:loader}=await import('@amap/amap-jsapi-loader');const AMap=await loader.load({key:process.env.NEXT_PUBLIC_AMAP_KEY,version:'2.0',plugins:['AMap.Geocoder','AMap.PlaceSearch','AMap.Scale','AMap.ToolBar']});
   const next=[];
   for(const day of days){
    if(cancelled)return;
    const names=Array.isArray(day.stops)&&day.stops.length?day.stops.slice(0,8):[day.city];
    const points=[],missing=[];
    for(const name of names){if(cancelled)return;const p=await locate(AMap,day.city,name);if(p)points.push(p);else missing.push(name);}
    next.push({...day,points,missing});
   }
   if(!cancelled)setResolved(next);
  })().catch(()=>{if(!cancelled)setError('地图地点检索未成功，请刷新重试。下方地点列表可继续查看。');}).finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;};
 },[signature,retry]);
 const visible=selected==='all'?resolved:resolved.filter(d=>d.date===selected);
 const route=useMemo(()=>{
  const points=visible.flatMap(d=>d.points).filter((p,i,a)=>i===0||p.coord.join()!==a[i-1].coord.join());
  const segments=visible.map((d,i)=>({id:'planning-'+d.date,day:i+1,stops:d.points,points:d.points,transport:'overview'}));
  if(selected==='all'&&points.length>1)segments.unshift({id:'planning-overview',day:'全程',stops:points,points,transport:'overview'});
  return {points,segments,planning:true,anchors:points.map((p,index)=>({...p,index}))};
 },[resolved,selected]);
 if(!days.length)return null;
 return <section className={styles.map} aria-label="规划行程地图"><header><h3>在地图上看行程</h3><p>复用动态路书地图。连线仅表示游览顺序，非导航路线；只有城市信息时显示城市位置。</p></header>
 <div className={styles.tabs} role="group" aria-label="地图日期"><button type="button" aria-pressed={selected==='all'} onClick={()=>setSelected('all')}>全程</button>{days.map((d,i)=><button type="button" key={d.date} aria-pressed={selected===d.date} onClick={()=>setSelected(d.date)}>第{i+1}天 · {d.date.slice(5)} {d.city}</button>)}</div>
 {(error||resolved.some(d=>d.missing.length))&&!loading&&<button type="button" onClick={()=>setRetry(v=>v+1)}>重新检索未定位地点</button>}
 {loading&&<p role="status">正在检索行程地点…</p>}{error&&<p role="alert">{error}</p>}
 {!loading&&route.points.length>0&&<AmapRouteOverview route={route}/>}
 {!loading&&!error&&resolved.length>0&&route.points.length===0&&<p role="status">未找到可标注的地点，请核对城市与景区名称。</p>}
 <div className={styles.locations}>{(resolved.length?visible:days).map(d=><p key={d.date}><b>{d.date} · {d.city}</b><br/>{d.points?.map(p=>p.name).join(' → ')||d.stops?.join(' → ')||d.city}{d.missing?.length>0&&<span> · 未定位：{d.missing.join('、')}（未在地图连线中标注）</span>}</p>)}</div>
 <JourneyWeather days={days}/><DiscoveryPanel days={days}/></section>;
}
