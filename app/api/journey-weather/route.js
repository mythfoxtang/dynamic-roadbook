import {NextResponse} from 'next/server';
import {aiRequestBody} from '@/lib/ai-request';
import {journeyWeather} from '@/lib/journey-weather.mjs';
import {withQueryReport} from '@/lib/query-report.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const POST=request=>withQueryReport(request,async request=>{
 try{const body=await aiRequestBody(request);return NextResponse.json(await journeyWeather(body.days),{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'天气查询未完成，请核对城市、日期后重试'},{status:400});}
});
