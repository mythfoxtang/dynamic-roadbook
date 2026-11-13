import {NextResponse} from 'next/server';
import {aiRequestBody} from '@/lib/ai-request';
import {searchAmap,DiscoveryError} from '@/lib/discovery-core.mjs';
import {searchScenicCatalog,auditScenicDays} from '@/lib/scenic-catalog.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
let active=0;
const json=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request){
 let acquired=false;
 try{
  const body=await aiRequestBody(request,{maxBytes:40000});
  if(body.action==='catalog')return json(searchScenicCatalog({query:String(body.query||'').slice(0,80),region:String(body.region||'').slice(0,60),page:body.page}));
  if(body.action==='audit'){if(!Array.isArray(body.days)||body.days.length>60)return json({error:'行程日期列表无效'},400);return json({days:auditScenicDays(body.days)});}
  if(body.action!=='search')return json({error:'未知查询动作'},400);
  if(active>=4)return json({error:'地点查询较多，请稍后再试',code:'BUSY'},429);
  active++;acquired=true;return json(await searchAmap(body));
 }catch(e){return json({error:e instanceof DiscoveryError||e.status===400||e.status===403?e.message:'地点查询暂时不可用',code:e.code||'DISCOVERY_ERROR'},e.status||502);}
 finally{if(acquired)active--;}
}
