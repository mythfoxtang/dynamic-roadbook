import { NextResponse } from 'next/server';
import { aiRequestBody } from '@/lib/ai-request';
import { carProviderStatus,searchCarRentals } from '@/lib/travel-car.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
let recent=[];
export function GET(){return NextResponse.json(carProviderStatus(),{headers});}
export async function POST(request){try{const body=await aiRequestBody(request);recent=recent.filter(n=>Date.now()-n<60000);if(recent.length>=20)return NextResponse.json({error:'租车查询过于频繁，请稍后再试'},{status:429,headers});recent.push(Date.now());return NextResponse.json(await searchCarRentals(body),{headers});}catch(e){return NextResponse.json({error:e.status?e.message:'租车服务暂不可用',code:e.code||'CAR_ERROR'},{status:e.status||502,headers});}}
