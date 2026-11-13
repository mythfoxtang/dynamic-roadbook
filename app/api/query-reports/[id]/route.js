import {readQueryReport} from '@/lib/query-report.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request,{params}){
 const {id}=await params;const report=await readQueryReport(id);
 if(!report)return new Response('报告不存在',{status:404});
 return new Response('\uFEFF'+report,{headers:{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="query-report-${id}.md"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
