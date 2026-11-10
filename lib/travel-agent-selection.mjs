// Read-only recovery for selections saved before a server restart.
export async function resolveAgentSelection({task,offer,search,request,onSearch=()=>{},onWaiting=()=>{},wait,signal}) {
  const query=async(body)=>{
    for(let attempt=0;;attempt++){
      try{return await request(body,signal);}
      catch(error){
        if(signal?.aborted||error.name==='AbortError')throw error;
        if(error instanceof TypeError&&attempt<3){
          onWaiting('服务正在恢复连接，稍后自动继续读取详情');
          await wait(2000,signal);continue;
        }
        if(error.status!==429||error.code==='DAILY_QUOTA'||attempt>=3)throw error;
        const seconds=Math.min(120,Math.max(2,error.retryAfter||62));
        onWaiting(`供应商限流，${seconds} 秒后自动继续读取最新库存`);
        await wait(seconds*1000,signal);
      }
    }
  };
  let current=offer;
  try{return {offer:current,data:(await query({action:'detail',searchId:search.id,offerId:current.id,refresh:true})).data};}
  catch(error){
    if(!(error.code==='SEARCH_NOT_FOUND'||error.status===404))throw error;
    onWaiting('正在重新查询所选候选的最新库存');
    const refreshed=(await query({...task.query,kind:task.kind,action:'search'})).data;
    onSearch(refreshed);
    // The supplier ID identifies the same hotel/flight within the original query.
    // Missing IDs never match each other, nor can a new result silently replace it.
    current=offer.supplierId&&refreshed.offers.find(candidate=>candidate.supplierId===offer.supplierId);
    if(!current)throw new Error('原候选暂未出现在最新结果中，候选列表已更新，请重新选择');
    return {offer:current,data:(await query({action:'detail',searchId:refreshed.id,offerId:current.id,refresh:true})).data};
  }
}
