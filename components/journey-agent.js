'use client';
import Link from 'next/link';
import QueryReports from './query-reports';
import JourneyMap from './journey-map';
import {reportedFetch} from '@/lib/query-report-client';
import {useEffect,useRef,useState} from 'react';
import {AGENT_EXAMPLE} from '@/lib/travel-agent-example';
import styles from './journey-agent.module.css';
import {resolveAgentSelection} from '@/lib/travel-agent-selection.mjs';
import {expandAgentTask,readWithRetry} from '@/lib/travel-agent-tools.mjs';
import {filterTravelOffers} from '@/lib/travel-filters.mjs';
import {checkTaskLocation,quarantineLocationResults} from '@/lib/travel-locations.mjs';
import JourneyPlanner from './journey-planner';
import {deferredRailwayTask} from '@/lib/travel-availability.mjs';
const STORE='roadbook-deepseek-agent-v1';
const names={flight:'机票',hotel:'住宿',train:'高铁／火车',car:'租车',attraction:'门票与预约'};
const auditedPlan=p=>({...p,tasks:p.tasks.map(t=>({...t,locationConflict:checkTaskLocation(t)||undefined}))});
const scope=q=>JSON.stringify([q?.kind,q?.city,q?.from,q?.to,q?.date,q?.startDate,q?.endDate,q?.adults,q?.children,q?.rooms,q?.pickupAt,q?.returnAt]);
async function post(url,body,signal){
  const response=await reportedFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error(data.error||'请求失败'),{status:response.status,code:data.code,retryAfter:data.retryAfter||Number(response.headers.get('Retry-After'))||0});
  return data;
}
function pause(ms,signal){return new Promise((resolve,reject)=>{const aborted=()=>{clearTimeout(timer);reject(new DOMException('已停止','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',aborted);resolve();},ms);signal.addEventListener('abort',aborted,{once:true});});}
const money=o=>o.price??o.totalAmount;
export default function JourneyAgent(){
  const [input,setInput]=useState(AGENT_EXAMPLE),[plan,setPlan]=useState(null),[results,setResults]=useState({}),[choices,setChoices]=useState({}),[recommendations,setRecommendations]=useState([]),[status,setStatus]=useState('准备识别你的行程'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[detail,setDetail]=useState(null),[detailBusy,setDetailBusy]=useState(false),[restored,setRestored]=useState(false);
  const [mode,setMode]=useState('idea'),[showSetup,setShowSetup]=useState(true);
  const [planningBusy,setPlanningBusy]=useState(false);
  const bookingRef=useRef(null);
  const controller=useRef(null),started=useRef(false),detailController=useRef(null);
  const conversationLog=useRef(null);
  const [messages,setMessages]=useState([]),[preferences,setPreferences]=useState({}),[followup,setFollowup]=useState(''),[sources,setSources]=useState([]);
  const [hydrated,setHydrated]=useState(false);const snapshotRevision=useRef(0);
  useEffect(()=>{if(conversationLog.current)conversationLog.current.scrollTop=conversationLog.current.scrollHeight;},[messages]);
  useEffect(()=>{
    if(started.current)return;started.current=true;
    try{const savedMode=localStorage.getItem('roadbook-agent-mode');if(['fixed','idea'].includes(savedMode))setMode(savedMode);}catch{}
    const restore=saved=>{const p=auditedPlan(saved.plan);setInput(p.input);setPlan(p);setResults(quarantineLocationResults(p,saved.results));setChoices(saved.choices||{});setRecommendations(saved.recommendations||[]);setMessages(saved.messages||[]);setPreferences(saved.preferences||{});setStatus('已恢复行程与选择，可以继续和 DeepSeek 商量');setRestored(true);setShowSetup(false);};
    post('/api/travel-agent/',{action:'capabilities'}).then(data=>setSources(data.sources||[])).catch(()=>{});
    let local;try{local=JSON.parse(localStorage.getItem(STORE)||'null');if(local?.plan)restore(local);}catch{/* Storage unavailable does not prevent work. */}
    post('/api/travel-agent/',{action:'restore'}).then(data=>{setSources(data.sources||[]);if(data.state&&!controller.current&&!local?.unsynced)restore(data.state);}).catch(()=>{}).finally(()=>setHydrated(true));
  },[]);
  useEffect(()=>{
    if(!plan||!hydrated)return;
    const revision=++snapshotRevision.current,state={input:plan.input,plan,results,choices,recommendations,messages,preferences,updatedAt:Date.now(),unsynced:true};
    try{localStorage.setItem(STORE,JSON.stringify(state));}catch{}
    if(busy)return;
    const timer=setTimeout(()=>{post('/api/travel-agent/',{action:'save',state}).then(()=>{if(snapshotRevision.current===revision)try{localStorage.setItem(STORE,JSON.stringify({...state,unsynced:false}));}catch{}}).catch(()=>{});},400);
    return ()=>clearTimeout(timer);
  },[plan,results,choices,recommendations,messages,preferences,busy,hydrated]);
  useEffect(()=>()=>{controller.current?.abort();detailController.current?.abort();},[]);
  async function searchOne(task,signal){
    const deferred=deferredRailwayTask(task);if(deferred)return deferred;
    const conflict=checkTaskLocation(task);if(conflict)return {state:'blocked',offers:[],notice:conflict.message};
    if(task.kind==='attraction')return {state:'gap',offers:[],notice:'已识别预约需求；实时门票和预约货源尚未接入。'};
    const car=task.kind==='car';
    const response=await readWithRetry(()=>post(car?'/api/travel/cars/':'/api/travel/query/',{...task.query,kind:task.kind,action:'search'},signal),{signal,wait:pause,onWaiting:setStatus});
    const result=car?response:response.data;return {...result,state:result.source==='unavailable'?'gap':result.offers?.length?'ready':'empty'};
  }
  async function reviewTasks(p,data,taskIds,signal,filters=preferences){
    const reviewed=await post('/api/travel-agent/',{action:'recommend',plan:p,results:data,taskIds,preferences:filters},signal);
    setRecommendations(previous=>[...previous.filter(r=>!taskIds.includes(r.taskId)),...reviewed.recommendations]);
  }
  async function more(task){
    if(busy)return;const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setStatus(`继续为你查找：${task.title}`);
    try{const result=await expandAgentTask({task,result:results[task.id],request:(body,signal)=>post('/api/travel/query/',body,signal),signal:abort.signal,wait:pause,onWaiting:setStatus});const data={...results,[task.id]:{...result,state:result.offers?.length?'ready':'empty'}};setResults(data);setStatus(`已加载 ${result.offers?.length||0} 个候选、${result.loadedPages||1} 页`);try{await reviewTasks(plan,data,[task.id],abort.signal);}catch(e){if(e.name==='AbortError')throw e;setStatus('更多候选已加载，智能体推荐暂未更新');}}
    catch(e){if(e.name!=='AbortError')setError(e.message);}
    finally{if(controller.current===abort)setBusy(false);}
  }
  async function sendMessage(value=followup){
    const content=value.trim();if(!content||busy||!plan)return;
    const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setFollowup('');setStatus('DeepSeek 正在理解你的调整要求');
    const userMessage={id:crypto.randomUUID(),role:'user',content,at:new Date().toISOString()};setMessages(m=>[...m,userMessage]);
    try{
      const response=await post('/api/travel-agent/',{action:'chat',message:content,messages,plan,results,choices,preferences},abort.signal);
      const nextPlan=auditedPlan(response.plan),assistantId=crypto.randomUUID(),logs=[],changed=[];let data={...results},nextPreferences={...preferences},nextChoices={...choices};
      setPlan(nextPlan);setMessages(m=>[...m,{id:assistantId,role:'assistant',content:response.reply,at:new Date().toISOString(),tools:[]}]);
      for(const action of response.actions){
        const task=nextPlan.tasks.find(t=>t.id===action.taskId);setStatus(action.reason||`正在处理：${task.title}`);
        try{
          if(action.type==='filter'){nextPreferences[task.id]={...nextPreferences[task.id],...action.filters};setPreferences({...nextPreferences});logs.push(`${task.title}：已筛选当前 ${data[task.id]?.offers?.length||0} 个候选，不消耗查价额度`);}
          else if(task.locationConflict){data[task.id]={state:'blocked',offers:[],notice:task.locationConflict.message};logs.push(task.locationConflict.message);}
          else {
            const previousTask=plan.tasks.find(t=>t.id===task.id);
            if(action.type==='search'&&scope(previousTask?.query)!==scope(task.query))delete nextChoices[task.id];
            const result=action.type==='more'?await expandAgentTask({task,result:data[task.id],pages:action.pages,request:(body,signal)=>post('/api/travel/query/',body,signal),signal:abort.signal,wait:pause,onWaiting:setStatus}):await searchOne(task,abort.signal);
            data[task.id]={...result,state:result.state||(result.offers?.length?'ready':'empty')};changed.push(task.id);logs.push(`${task.title}：已加载 ${result.offers?.length||0} 个候选${result.loadedPages?`、${result.loadedPages} 页`:''}${result.notice?`；${result.notice}`:''}`);
          }
        }catch(e){if(e.name==='AbortError')throw e;logs.push(`${task.title}：${e.message}`);if(action.type==='search'||action.type==='add')data[task.id]={state:'error',offers:[],notice:e.message};}
        setResults({...data});setChoices({...nextChoices});setMessages(m=>m.map(item=>item.id===assistantId?{...item,tools:[...logs]}:item));
      }
      if(changed.length){setStatus('DeepSeek 正在比较补查到的候选');try{await reviewTasks(nextPlan,data,changed,abort.signal,nextPreferences);}catch(e){if(e.name==='AbortError')throw e;logs.push('候选已加载，推荐排序暂未更新');setMessages(m=>m.map(item=>item.id===assistantId?{...item,tools:[...logs]}:item));}}
      setStatus('已按这轮要求更新，原有未受影响的选择已保留');
    }catch(e){if(e.name!=='AbortError')setError(e.message);else setStatus('已停止，已有结果和选择保留');}
    finally{if(controller.current===abort)setBusy(false);}
  }
  function choose(task,offer,option){setChoices(previous=>{const next={...previous},group=task.alternativeTo||task.id;for(const other of plan.tasks)if((other.alternativeTo||other.id)===group)delete next[other.id];return {...next,[task.id]:{offer,...(option?{option}:{}),selectedAt:new Date().toISOString()}};});}
  async function searchTasks(p,signal){
    const output={};
    for(const task of p.tasks){
      if(signal.aborted)return;
      const deferred=deferredRailwayTask(task);if(deferred){output[task.id]=deferred;setResults({...output});continue;}
      setStatus(`正在为你查询：${task.title}`);
      const conflict=checkTaskLocation(task);if(conflict){output[task.id]={state:'blocked',offers:[],notice:conflict.message};setResults({...output});continue;}
      if(task.kind==='attraction'){output[task.id]={state:'gap',offers:[],notice:'已识别预约与门票需求；目前没有接入此景区实时门票或预约接口。'};setResults({...output});continue;}
      for(let attempt=0;attempt<3;attempt++){
        try{
          const car=task.kind==='car';
          const data=await post(car?'/api/travel/cars/':'/api/travel/query/',{...task.query,kind:task.kind,action:'search'},signal),result=car?data:data.data;
          output[task.id]={...result,state:result.source==='unavailable'?'gap':result.offers?.length?'ready':'empty'};break;
        }catch(e){
          if(e.name==='AbortError')throw e;
          if(e.status===429&&e.code!=='DAILY_QUOTA'&&attempt<2){const seconds=Math.min(120,Math.max(2,e.retryAfter||62));setStatus(`供应商限流，${seconds} 秒后自动继续：${task.title}`);await pause(seconds*1000,signal);continue;}
          output[task.id]={state:'error',offers:[],notice:e.message};break;
        }
      }
      setResults({...output});
    }
    setStatus('DeepSeek 正在比较实际候选与行程衔接');
    try{const reviewed=await post('/api/travel-agent/',{action:'recommend',plan:p,results:output},signal);setRecommendations(reviewed.recommendations);setStatus('候选已整理好，请选择你喜欢的方案');}
    catch(e){if(e.name==='AbortError')throw e;setStatus('查价已结束；DeepSeek 推荐未完成');setError(e.message);}
  }
  async function run(reuse=false){
    controller.current?.abort();detailController.current?.abort();setDetail(null);const abort=new AbortController();controller.current=abort;
    setBusy(true);setError('');setResults({});setRecommendations([]);setRestored(false);
    if(!reuse){setChoices({});setMessages([]);setPreferences({});}
    if(!reuse)setPlan(null);
    try{setStatus('DeepSeek 正在阅读行程、识别住宿和交通需求');const p=reuse?plan:(await post('/api/travel-agent/',{action:'plan',input},abort.signal)).plan;setPlan(p);await searchTasks(p,abort.signal);}
    catch(e){if(e.name!=='AbortError'){setError(e.message);setStatus('需要处理以下问题');}else setStatus('已停止；当前结果已保留');}
    finally{if(controller.current===abort)setBusy(false);}
  }
  function switchMode(value){setMode(value);try{localStorage.setItem('roadbook-agent-mode',value);}catch{}}
  async function confirmDraft(p){
    setShowSetup(false);requestAnimationFrame(()=>bookingRef.current?.scrollIntoView({block:'start',behavior:'instant'}));
    controller.current?.abort();detailController.current?.abort();const abort=new AbortController();controller.current=abort;
    setBusy(true);setError('');setDetail(null);setInput(p.input);setPlan(p);setResults({});setChoices({});setRecommendations([]);setMessages([]);setPreferences({});setRestored(false);
    try{await searchTasks(p,abort.signal);}catch(e){if(e.name!=='AbortError')setError(e.message);else setStatus('已停止；当前结果已保留');}finally{if(controller.current===abort)setBusy(false);}
  }
  async function inspect(task,offer){
    const conflict=checkTaskLocation(task);if(conflict){setError(conflict.message);return;}
    if(task.kind==='car'){choose(task,offer);return;}
    detailController.current?.abort();const abort=new AbortController();detailController.current=abort;
    setDetail({task,offer});setDetailBusy(true);
    try{
      const selected=await resolveAgentSelection({task,offer,search:results[task.id],signal:abort.signal,wait:pause,
        request:(body,signal)=>post('/api/travel/query/',body,signal),
        onWaiting:waiting=>setDetail({task,offer,waiting}),
        onSearch:search=>{setResults(r=>({...r,[task.id]:{...search,state:search.offers?.length?'ready':'empty'}}));setRecommendations(r=>r.filter(item=>item.taskId!==task.id));}
      });
      if(!abort.signal.aborted)setDetail({task,...selected});
    }
    catch(e){if(e.name!=='AbortError')setDetail({task,offer,error:e.message});}
    finally{if(detailController.current===abort)setDetailBusy(false);}
  }
  const selected=Object.keys(choices).length;
  return <main className={styles.shell} data-has-plan={Boolean(plan)}><div className={styles.wrap}>
    <QueryReports/>
    <nav className={styles.nav}><Link href="/">动态路书</Link><div><Link href="/travel/">单项查询</Link><Link href="/settings/ai/">AI 设置</Link></div></nav>
    <header className={styles.hero}><div><p className={styles.eyebrow}>从一个想法，到一趟旅行</p><h1>先聊想去哪。<br/>一起把行程定下来。</h1><p>DeepSeek 帮你规划每日路线、交通和住宿区域。你确认行程后，再查询预订候选。</p></div><div className={styles.route}>{plan?plan.days.slice(0,6).map(day=><span key={day.date}>{day.date.slice(5)} · {day.city}</span>):<><span>说说目的地与时间</span><span>商量并确认行程</span><span>查价与选择预订</span></>}</div></header>
    <ol className={styles.steps} aria-label="旅行安排步骤"><li>1. 提供行程或想法</li><li aria-current={showSetup?'step':undefined}>2. 讨论并确认行程</li><li aria-current={!showSetup?'step':undefined}>3. 统一预订工作台</li></ol>
    {plan&&<div className={styles.bookingGuide}><p>{showSetup?'修改后的行程确认前，原预订候选与选择会保留。确认新行程后重新查价。':'行程已确认，现在可以挑选交通和住宿，也可以继续提出预订偏好。'}</p><button disabled={busy||planningBusy} onClick={()=>setShowSetup(v=>!v)}>{showSetup?'返回当前预订工作台':'返回行程修改'}</button></div>}
    <div hidden={!showSetup}>
      <div className={styles.modeTabs} role="tablist" aria-label="选择行程模式">
        <button role="tab" id="mode-fixed" aria-controls="panel-fixed" aria-selected={mode==='fixed'} disabled={busy||planningBusy} onClick={()=>switchMode('fixed')}>模式1：已有具体行程<span>整理安排，确认后预订</span></button>
        <button role="tab" id="mode-idea" aria-controls="panel-idea" aria-selected={mode==='idea'} disabled={busy||planningBusy} onClick={()=>switchMode('idea')}>模式2：只有大概框架<span>先规划和修改，再确认预订</span></button>
      </div>
      <div role="tabpanel" id="panel-fixed" aria-labelledby="mode-fixed" hidden={mode!=='fixed'}><JourneyPlanner mode="fixed" initialInput={input} onConfirm={confirmDraft} onWorking={setPlanningBusy} disabled={busy}/></div>
      <div role="tabpanel" id="panel-idea" aria-labelledby="mode-idea" hidden={mode!=='idea'}><JourneyPlanner mode="idea" onConfirm={confirmDraft} onWorking={setPlanningBusy} disabled={busy}/></div>
    </div>
    <div className={styles.status} aria-live="polite"><span>{status}</span>{busy&&<button onClick={()=>controller.current?.abort()}>停止查询</button>}{plan&&!busy&&<button onClick={()=>run(true)}>重新核实全部候选</button>}</div>
    {error&&<p role="alert" className={styles.error}>{error} <Link href="/settings/ai/">打开 AI 设置</Link></p>}
    {plan&&<section ref={bookingRef} hidden={showSetup} aria-label="统一预订工作台" className={styles.bookingWorkspace}><h2>统一预订工作台</h2>
      {!showSetup&&<JourneyMap days={plan.days}/>}
      <section className={styles.dialogue} aria-label="与 DeepSeek 的对话"><div className={styles.dialogueHeader}><div><h2>继续和 DeepSeek 商量</h2><p>补充偏好、要求更多候选，或比较其他交通方式。已选内容会保留。</p></div><span>{Object.keys(choices).length} 项已选</span></div>
        {messages.length>0&&<div ref={conversationLog} className={styles.messages} role="log" aria-live="polite">{messages.map(message=><article key={message.id} className={message.role==='user'?styles.userMessage:styles.agentMessage}><b>{message.role==='user'?'你':'DeepSeek'}</b><p>{message.content}</p>{message.tools?.length>0&&<ul aria-label="本轮执行结果">{message.tools.map((tool,i)=><li key={i}>{tool}</li>)}</ul>}</article>)}</div>}
        <div className={styles.suggestions}>{['多给我一些酒店选项','查上海到宜昌的高铁备选','酒店300元以内，优先能停车','核实三峡之巅的地点并重查住宿'].map(value=><button key={value} disabled={busy} onClick={()=>sendMessage(value)}>{value}</button>)}</div>
        <form onSubmit={e=>{e.preventDefault();sendMessage();}} className={styles.composer}><label htmlFor="agent-followup">这轮想怎么调整？</label><textarea id="agent-followup" rows={2} maxLength={3000} value={followup} onChange={e=>setFollowup(e.target.value)} disabled={busy} placeholder="例如：北京酒店靠近地铁，再多找一些；恩施飞北京没结果，比较一下高铁"/><button type="submit" disabled={busy||!followup.trim()}>{busy?'正在处理…':'发给 DeepSeek'}</button></form>
      </section>
      {sources.length>0&&<details className={styles.sources}><summary>查询能力与货源状态</summary><div>{sources.map(source=><p key={source.id}><b>{source.name}</b><span>{source.state==='configured'?'已配置':source.state==='sandbox'?'沙盒试订':'待接入'}</span><small>{source.notice}</small>{source.href&&<Link href={source.href}>打开独立入口</Link>}</p>)}</div><p>候选来自当前已授权货源；未接入的平台不会被当作已搜索。</p></details>}
      <section className={styles.overview}><div><h2>{plan.title}</h2><p>分析模型：{plan.analysis?.model} · {plan.days[0].date} 至 {plan.days.at(-1).date}</p></div><strong>已选 {selected} 项<span>共 {plan.tasks.length} 项需求</span></strong><ol>{plan.days.map(day=><li key={day.date}><time>{day.date.slice(5).replace('-','月')}日</time><b>{day.city}</b><span>{day.activity}</span></li>)}</ol></section>
      <details className={styles.notes} open><summary>查价假设与行程提醒</summary><ul>{[...plan.assumptions,...plan.warnings].map((v,i)=><li key={i}>{v}</li>)}</ul></details>
      <div className={styles.board}><section aria-label="预订候选" className={styles.tasks}>{plan.tasks.map(task=>{
        const result=results[task.id],rec=task.locationConflict?null:recommendations.find(r=>r.taskId===task.id),allOffers=task.locationConflict?[]:result?.offers||[],filtered=filterTravelOffers(allOffers,preferences[task.id]||{}),offers=preferences[task.id]?.sort?filtered:[...filtered].sort((a,b)=>{const ar=rec?.offerIds.indexOf(a.id)??-1,br=rec?.offerIds.indexOf(b.id)??-1;return (ar<0?99:ar)-(br<0?99:br)||(money(a)??Infinity)-(money(b)??Infinity);});
        return <article className={styles.task} key={task.id} data-testid="agent-task"><div className={styles.taskTitle}><span>{names[task.kind]}</span><h3>{task.title}</h3>{choices[task.id]&&<b>已选</b>}</div><p>{task.reason}</p>{task.checks.length>0&&<p className={styles.checks}>需核实：{task.checks.join('；')}</p>}
          {task.alternativeTo&&<p className={styles.checks}>这是原任务的备选；最终选择此项时，才会替换同组原选择。</p>}
          {task.locationConflict&&<p className={styles.error}>{task.locationConflict.message} <a href={task.locationConflict.source} target="_blank" rel="noreferrer">核对地点来源</a></p>}
          {rec?.reason&&<p className={styles.recommendation}>DeepSeek 建议：{rec.reason}</p>}
          {!result?<p className={styles.muted}>{busy?'智能体将自动查询这一项':'尚未查询'}</p>:<><p className={styles.muted}>{result.source==='live'?'途牛 / 供应商实时查询':result.source==='test'||result.source==='fixture'?'测试数据，不可用于预订':'暂未取得可售数据'}{result.queriedAt&&` · ${new Date(result.queriedAt).toLocaleString('zh-CN')}`}</p>{result.notice&&!task.locationConflict&&<p className={styles.error}>{result.notice}</p>}{result.coverage&&<p className={styles.muted}>{result.coverage}</p>}{result.state==='empty'&&<p>本次条件没有返回候选，不能据此判定全天无库存。</p>}
          {(allOffers.length>0||result.totalPages>result.loadedPages)&&<div className={styles.taskControls}><span>已加载 {allOffers.length} 个 · 筛选后 {offers.length} 个{result.loadedPages?` · 已读 ${result.loadedPages}/${result.totalPages??'?'} 页`:''}</span><div>{Object.values(preferences[task.id]||{}).some(v=>v!==false&&v!==''&&v!=null)&&<button onClick={()=>setPreferences(p=>({...p,[task.id]:{}}))}>清空筛选</button>}{result.totalPages>result.loadedPages&&<button disabled={busy||Boolean(task.locationConflict)} onClick={()=>more(task)}>继续查更多</button>}</div></div>}
          {allOffers.length>0&&!offers.length&&<p>已加载结果里没有满足这轮条件的候选。可以清空筛选、继续翻页，或让 DeepSeek 调整查询范围。</p>}
          {offers.slice(0,6).map(offer=><div key={offer.id} className={styles.offer} data-testid="agent-offer"><div><b>{offer.name}</b>{task.kind==='flight'&&<p>{offer.departureTime} {offer.departureAirport} — {offer.arrivalTime} {offer.arrivalAirport} · {offer.type||'直飞情况待核实'}</p>}{task.kind==='train'&&<p>{offer.departureTime} {offer.departureStation} — {offer.arrivalTime} {offer.arrivalStation} · {offer.duration}</p>}{task.kind==='hotel'&&<p>{offer.address||'具体地址待核实'} {offer.distance}</p>}<small>{offer.priceUnit||(task.kind==='car'?'整段租期报价，押金另计':'供应商参考报价')}</small></div><div className={styles.price}><strong>{money(offer)==null?'价格待核实':`¥${money(offer)}`}</strong><button disabled={busy||detailBusy} aria-label={`选择 ${offer.name}`} onClick={()=>inspect(task,offer)}>{choices[task.id]?.offer.id===offer.id?'查看已选':'选择此项'}</button></div></div>)}
          {offers.length>6&&<details className={styles.more}><summary>查看其余 {offers.length-6} 个已加载候选</summary>{offers.slice(6).map(offer=><div className={styles.offer} key={offer.id}><span>{offer.name} · {offer.departureTime||offer.address} · {money(offer)==null?'价格待核实':`¥${money(offer)}`}</span><button disabled={busy||detailBusy} onClick={()=>inspect(task,offer)}>选择 {offer.name}</button></div>)}</details>}
          {restored&&offers.length>0&&<p className={styles.muted}>这是上次快照，选择时自动读取最新详情。</p>}</>}
        </article>;
      })}</section><aside className={styles.selection} aria-label="我的选择"><h2>我的选择</h2><p>保存在当前浏览器。尚未预订。</p>{!selected&&<p className={styles.muted}>选好机票、房型和车型，它们会汇集在这里。</p>}{plan.tasks.filter(t=>choices[t.id]).map(t=><div key={t.id}><small>{t.title}</small><b>{choices[t.id].offer.name}</b><p>{choices[t.id].option?.name} {choices[t.id].option?.plan}</p>{t.kind==='hotel'&&<small>{t.query.startDate} → {t.query.endDate}</small>}<button onClick={()=>setChoices(c=>{const next={...c};delete next[t.id];return next;})}>移除</button></div>)}<p className={styles.muted}>不同报价口径不合并为总价。正式预订前仍需验价、旅客资料及你确认。</p></aside></div>
    </section>}
    {detail&&<section className={styles.modal} role="dialog" aria-modal="true" aria-label="选择房型或舱位"><div><button autoFocus className={styles.close} onClick={()=>{detailController.current?.abort();setDetailBusy(false);setDetail(null);}}>关闭</button><h2>{detail.offer.name}</h2>{detailBusy&&<p aria-live="polite">{detail.waiting || "正在获取实际房型 / 舱位…"}</p>}{detail.error&&<p role="alert">{detail.error}，请重新核实候选。</p>}{detail.data&&<><p>选择具体房型或舱位，保存到「我的选择」。价格和库存以正式验价为准。</p>{(detail.data.options||[]).map(option=><div className={styles.option} key={option.id}><div><b>{option.name} {option.plan}</b><p>{option.bed} {option.meal} {option.baggage}</p><small>{option.refund||'退改规则待核实'} {option.priceUnit}</small></div><button onClick={()=>{choose(detail.task,detail.offer,option);setDetail(null);}}>{option.price==null?'价格待核实':`¥${option.price}`} · 选这个</button></div>)}{!detail.data.options?.length&&<p>没有返回可选房型或舱位，请选择其他候选。</p>}</>}</div></section>}
    <footer className={styles.footer}>智能体负责分析与推荐；价格与库存来自接入的供应商。缺少的货源会直接说明。</footer>
  </div></main>;
}
