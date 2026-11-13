// Planning is allowed outside a supplier's live query window.
export function deferredRailwayTask(task,now=Date.now()){
  if(task?.kind!=='train')return null;
  const departure=Date.parse(task.query?.date);
  if(!Number.isFinite(departure))return null;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  const availableFrom=new Date(departure-14*86400000).toISOString().slice(0,10);
  if(availableFrom<=today)return null;
  return {state:'deferred',source:'deferred',offers:[],availableFrom,notice:`铁路尚未进入含当天15天的预售期，按当前规则预计可从 ${availableFrom} 查询；具体起售时刻以铁路公布为准。其他项目继续查价。`};
}
