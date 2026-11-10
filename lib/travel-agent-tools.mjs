export async function readWithRetry(request,{signal,wait,onWaiting=()=>{}}){
 for(let attempt=0;;attempt++){
  try{return await request();}catch(error){
   if(signal?.aborted||error.name==='AbortError'||attempt>=3)throw error;
   if(error.status===429&&error.code!=='DAILY_QUOTA'){const seconds=Math.min(120,Math.max(2,error.retryAfter||62));onWaiting(`供应商限流，${seconds} 秒后自动继续`);await wait(seconds*1000,signal);continue;}
   if(error instanceof TypeError){onWaiting('服务正在恢复连接，稍后自动继续');await wait(2000,signal);continue;}
   throw error;
  }
 }
}
export async function expandAgentTask({task,result,pages=1,request,...options}){
 let current=result;
 const call=body=>readWithRetry(()=>request(body,options.signal),options);
 if(!current?.id)current=(await call({...task.query,kind:task.kind,action:'search'})).data;
 try{
  if(!current.totalPages||current.loadedPages>=current.totalPages)return current;
  return (await call({action:'next',searchId:current.id,count:Math.min(2,Math.max(1,pages))})).data;
 }catch(error){
  if(!['SEARCH_NOT_FOUND','PROVIDER_BUSINESS_ERROR'].includes(error.code)&&error.status!==404)throw error;
  current=(await call({...task.query,kind:task.kind,action:'search'})).data;
  if(!current.totalPages||current.loadedPages>=current.totalPages)return current;
  return (await call({action:'next',searchId:current.id,count:Math.min(2,Math.max(1,pages))})).data;
 }
}
