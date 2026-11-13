import { NextResponse } from 'next/server';
import {withQueryReport} from '@/lib/query-report.mjs';
import { aiRequestBody,requestAiConfig,safeAiError } from '@/lib/ai-request';
import { analyzeJourney,recommendJourney,validateAgentPlan,requireDeepSeek } from '@/lib/travel-agent.mjs';
import { AI_COOKIE } from '@/lib/ai-config.mjs';
import {readAgentState,saveAgentState} from '@/lib/travel-agent-state.mjs';
import {converseJourney,sanitizeConversation,validateAgentFilters} from '@/lib/travel-agent-dialogue.mjs';
import {quarantineLocationResults} from '@/lib/travel-locations.mjs';
import {travelSourceCatalog} from '@/lib/travel-source-catalog.mjs';
import {TravelError} from '@/lib/travel-core.mjs';
import {proposeJourney,draftItinerary} from '@/lib/journey-draft.mjs';
import {VISITOR_COOKIE,agentVisitor} from '@/lib/agent-visitor.mjs';
import {requestUsesHttps} from '@/lib/request-origin.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
let active=0;
export const POST=request=>withQueryReport(request,handlePost);
async function handlePost(request){
  let acquired=false;
  const visitor=agentVisitor(request.cookies.get(VISITOR_COOKIE)?.value);
  const json=(data,options={})=>{const response=NextResponse.json(data,{headers,...options});response.cookies.set(VISITOR_COOKIE,visitor,{httpOnly:true,sameSite:'strict',secure:requestUsesHttps(request),path:'/',maxAge:30*86400});return response;};
  try{
    const body=await aiRequestBody(request,{maxBytes:1000000}),config=requestAiConfig(request);
    requireDeepSeek(config);
    const sessionId=request.cookies.get(AI_COOKIE)?.value||visitor;
    const sources=travelSourceCatalog();
    if(body.action==='capabilities')return json({sources},{headers});
    if(body.action==='restore'){
      const saved=readAgentState(sessionId,config);
      if(!saved)return json({state:null,sources},{headers});
      const plan={...saved.plan,...validateAgentPlan(saved.plan)};
      return json({state:{...saved,plan,results:quarantineLocationResults(plan,saved.results)},sources},{headers});
    }
    if(body.action==='save'){
      const state=body.state;
      if(!state?.plan)return json({error:'缺少行程状态'},{status:400,headers});
      const plan={...state.plan,...validateAgentPlan(state.plan)};
      const preferences=Object.fromEntries(Object.entries(state.preferences||{}).filter(([id])=>plan.tasks.some(t=>t.id===id)).map(([id,value])=>[id,validateAgentFilters(value)]));
      saveAgentState(sessionId,config,{plan,input:plan.input,results:quarantineLocationResults(plan,state.results),choices:state.choices||{},recommendations:state.recommendations||[],preferences,messages:sanitizeConversation(state.messages),updatedAt:Date.now()});
      return json({saved:true},{headers});
    }
    if(active>=3)return json({error:'智能体正在处理其他行程，请稍后重试'},{status:429,headers});
    active++;acquired=true;
    if(body.action==='draft')return json({draft:await proposeJourney(body,config)},{headers});
    if(body.action==='confirm-draft')return json({plan:await analyzeJourney(draftItinerary(body.draft),config)},{headers});
    if(body.action==='plan')return json({plan:await analyzeJourney(body.input,config)},{headers});
    if(body.action==='chat'){
      const plan={...body.plan,...validateAgentPlan(body.plan)};
      return json(await converseJourney({...body,plan,sources,results:quarantineLocationResults(plan,body.results)},config),{headers});
    }
    if(body.action==='recommend'){
      const plan={...validateAgentPlan(body.plan),input:String(body.plan.input||'').slice(0,12000)};
      const selected=Array.isArray(body.taskIds)?plan.tasks.filter(t=>body.taskIds.includes(t.id)):plan.tasks;
      const preferences=Object.fromEntries(Object.entries(body.preferences||{}).map(([id,value])=>[id,validateAgentFilters(value)]));
      return json(await recommendJourney({...plan,tasks:selected},quarantineLocationResults(plan,body.results),config,{preferences}),{headers});
    }
    return json({error:'未知智能体动作'},{status:400,headers});
  }catch(e){const error=e instanceof TravelError?{error:e.message,status:e.status}:safeAiError(e);return json({error:error.error},{status:error.status,headers});}
  finally{if(acquired)active--;}
}
