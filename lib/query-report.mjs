import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
const directory=()=>path.join(process.cwd(),'.automation','query-reports');
export async function withQueryReport(request,handler){
 const start=Date.now();
 const copy=request.clone();
 const response=await handler(request);
 try{
  const body=await copy.json().catch(()=>({}));
  if(!['weather','draft','confirm-draft','plan','chat','recommend','search','next','detail'].includes(body.action))return response;
  const result=await response.clone().json();
  const id=randomBytes(24).toString('hex');
  const conditions=Object.fromEntries(['kind','city','from','to','date','startDate','endDate','adults','children','rooms'].filter(k=>typeof body[k]==='string'||typeof body[k]==='number').map(k=>[k,String(body[k]).slice(0,100)]));
  const offers=result.data?.offers||result.offers;
  const count=Array.isArray(offers)?offers.length:null;
  const status=!response.ok?'失败':count===0?'请求成功，无可售候选':'请求成功';
  const error=String(result.error||'无').replace(/(?:sk-[\w-]+|Bearer\s+\S+)/gi,'[已隐藏]').slice(0,600);
  const report=`# 查询测试情况\n\n- 编号：${id}\n- 时间（北京时间）：${new Date(start).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}\n- 接口：${new URL(request.url).pathname}\n- 动作：${body.action}\n- 状态：${status}\n- HTTP：${response.status}\n- 耗时：${Date.now()-start} ms\n- 错误：${error}\n- 错误码：${result.code||'无'}\n- 候选数量：${count??'不适用'}\n- 查价任务数：${result.plan?.tasks?.length??'不适用'}\n- 初选方案数：${result.draft?.options?.length??'不适用'}\n\n## 查询条件\n\n\`\`\`json\n${JSON.stringify(conditions,null,2)}\n\`\`\`\n\n## 验证边界\n\n此报告记录本次实际接口执行结果。HTTP 成功不等于库存充足、供应商全覆盖或订单已成交；未执行下单测试。不保存原始对话、密钥、Cookie 或旅客身份信息。\n\n## 排查建议\n\n${response.ok?(count===0?'检查日期、城市、筛选条件与供应商覆盖。':'如页面展示仍有问题，请附此报告编号与操作步骤反馈。'):'先根据错误信息修正参数、授权或配额，再重试；行程草案应保留。'}\n`;
  await fs.mkdir(directory(),{recursive:true});await fs.writeFile(path.join(directory(),id+'.md'),report,'utf8');
  response.headers.set('X-Query-Report',`/api/query-reports/${id}/`);
 }catch{response.headers.set('X-Query-Report-Error','unavailable');}
 return response;
}
export async function readQueryReport(id){
 if(!/^[a-f0-9]{48}$/.test(id))return null;
 try{return await fs.readFile(path.join(directory(),id+'.md'),'utf8');}catch{return null;}
}
