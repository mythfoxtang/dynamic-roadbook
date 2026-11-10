import { NextResponse } from 'next/server';
import { aiRequestBody,requestAiConfig,safeAiError } from '@/lib/ai-request';
import { analyzeJourney,recommendJourney,validateAgentPlan,requireDeepSeek } from '@/lib/travel-agent.mjs';
import { AI_COOKIE } from '@/lib/ai-config.mjs';
import {readAgentState,saveAgentState} from '@/lib/travel-agent-state.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
let active=0;
export async function POST(request){
  let acquired=false;
  try{
    const body=await aiRequestBody(request),config=requestAiConfig(request);
    requireDeepSeek(config);
    const sessionId=request.cookies.get(AI_COOKIE)?.value;
    if(body.action==='restore')return NextResponse.json({state:readAgentState(sessionId,config)},{headers});
    if(body.action==='save'){
      const state=body.state;
      if(!state?.plan)return NextResponse.json({error:'缺少行程状态'},{status:400,headers});
      validateAgentPlan(state.plan);
      saveAgentState(sessionId,config,{plan:state.plan,input:state.plan.input,results:state.results||{},choices:state.choices||{},recommendations:state.recommendations||[]});
      return NextResponse.json({saved:true},{headers});
    }
    if(active>=3)return NextResponse.json({error:'智能体正在处理其他行程，请稍后重试'},{status:429,headers});
    active++;acquired=true;
    if(body.action==='plan')return NextResponse.json({plan:await analyzeJourney(body.input,config)},{headers});
    if(body.action==='recommend'){
      const plan={...validateAgentPlan(body.plan),input:String(body.plan.input||'').slice(0,12000)};
      return NextResponse.json(await recommendJourney(plan,body.results||{},config),{headers});
    }
    return NextResponse.json({error:'未知智能体动作'},{status:400,headers});
  }catch(e){const error=safeAiError(e);return NextResponse.json({error:error.error},{status:error.status,headers});}
  finally{if(acquired)active--;}
}
