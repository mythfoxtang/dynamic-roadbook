'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {AGENT_EXAMPLE} from '@/lib/travel-agent-example';
import styles from './journey-agent.module.css';
import {resolveAgentSelection} from '@/lib/travel-agent-selection.mjs';
const STORE='roadbook-deepseek-agent-v1';
const names={flight:'机票',hotel:'住宿',car:'租车',attraction:'门票与预约'};
async function post(url,body,signal){
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error(data.error||'请求失败'),{status:response.status,code:data.code,retryAfter:data.retryAfter||Number(response.headers.get('Retry-After'))||0});
  return data;
}
function pause(ms,signal){return new Promise((resolve,reject)=>{const aborted=()=>{clearTimeout(timer);reject(new DOMException('已停止','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',aborted);resolve();},ms);signal.addEventListener('abort',aborted,{once:true});});}
const money=o=>o.price??o.totalAmount;
export default function JourneyAgent(){
  const [input,setInput]=useState(AGENT_EXAMPLE),[plan,setPlan]=useState(null),[results,setResults]=useState({}),[choices,setChoices]=useState({}),[recommendations,setRecommendations]=useState([]),[status,setStatus]=useState('准备识别你的行程'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[detail,setDetail]=useState(null),[detailBusy,setDetailBusy]=useState(false),[restored,setRestored]=useState(false);
  const controller=useRef(null),started=useRef(false),detailController=useRef(null);
  useEffect(()=>{
    if(started.current)return;started.current=true;
    const restore=saved=>{setInput(saved.plan.input);setPlan(saved.plan);setResults(saved.results||{});setChoices(saved.choices||{});setRecommendations(saved.recommendations||[]);setStatus('已恢复上次结果；选择时自动核实房型或舱位');setRestored(true);};
    try{const saved=JSON.parse(localStorage.getItem(STORE)||'null');if(saved?.plan){restore(saved);return;}}catch{/* Storage unavailable does not prevent work. */}
    post('/api/travel-agent/',{action:'restore'}).then(data=>{if(data.state&&!controller.current)restore(data.state);}).catch(()=>{});
  },[]);
  useEffect(()=>{if(plan)try{localStorage.setItem(STORE,JSON.stringify({input:plan.input,plan,results,choices,recommendations}));}catch{/* Keep current session usable. */}},[plan,results,choices,recommendations]);
  useEffect(()=>{if(!plan||busy)return;const timer=setTimeout(()=>{post('/api/travel-agent/',{action:'save',state:{plan,results,choices,recommendations}}).catch(()=>{});},400);return ()=>clearTimeout(timer);},[plan,results,choices,recommendations,busy]);
  useEffect(()=>()=>{controller.current?.abort();detailController.current?.abort();},[]);
  async function searchTasks(p,signal){
    const output={};
    for(const task of p.tasks){
      if(signal.aborted)return;
      setStatus(`正在为你查询：${task.title}`);
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
    setBusy(true);setError('');setResults({});setChoices({});setRecommendations([]);setRestored(false);
    if(!reuse)setPlan(null);
    try{setStatus('DeepSeek 正在阅读行程、识别住宿和交通需求');const p=reuse?plan:(await post('/api/travel-agent/',{action:'plan',input},abort.signal)).plan;setPlan(p);await searchTasks(p,abort.signal);}
    catch(e){if(e.name!=='AbortError'){setError(e.message);setStatus('需要处理以下问题');}else setStatus('已停止；当前结果已保留');}
    finally{if(controller.current===abort)setBusy(false);}
  }
  async function inspect(task,offer){
    if(task.kind==='car'){setChoices(c=>({...c,[task.id]:{offer,selectedAt:new Date().toISOString()}}));return;}
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
  return <main className={styles.shell}><div className={styles.wrap}>
    <nav className={styles.nav}><Link href="/">动态路书</Link><div><Link href="/travel/">单项查询</Link><Link href="/settings/ai/">AI 设置</Link></div></nav>
    <header className={styles.hero}><div><p className={styles.eyebrow}>你的旅行，由智能体接着办</p><h1>行程确定了。<br/>接下来，只做选择。</h1><p>DeepSeek 理解你的安排，自动查询机票、住宿和租车，再帮你比较。</p></div><div className={styles.route}>{plan?plan.days.slice(0,6).map(day=><span key={day.date}>{day.date.slice(5)} · {day.city}</span>):<><span>告诉我行程</span><span>我来寻找候选</span><span>你来选择</span></>}</div></header>
    <form className={styles.input} onSubmit={e=>{e.preventDefault();run();}}><label htmlFor="agent-itinerary">把确定的行程交给 DeepSeek</label><textarea id="agent-itinerary" value={input} onChange={e=>setInput(e.target.value)} rows={4} maxLength={12000} disabled={busy}/><div><small>未说明的信息会列为查价假设，选择不会自动下单或扣款。</small><button disabled={busy||!input.trim()} type="submit">{busy?'智能体正在安排…':'交给 DeepSeek 安排'}</button></div></form>
    <div className={styles.status} aria-live="polite"><span>{status}</span>{busy&&<button onClick={()=>controller.current?.abort()}>停止查询</button>}{plan&&!busy&&<button onClick={()=>run(true)}>重新核实全部候选</button>}</div>
    {error&&<p role="alert" className={styles.error}>{error} <Link href="/settings/ai/">打开 AI 设置</Link></p>}
    {plan&&<>
      <section className={styles.overview}><div><h2>{plan.title}</h2><p>分析模型：{plan.analysis?.model} · {plan.days[0].date} 至 {plan.days.at(-1).date}</p></div><strong>已选 {selected} 项<span>共 {plan.tasks.length} 项需求</span></strong><ol>{plan.days.map(day=><li key={day.date}><time>{day.date.slice(5).replace('-','月')}日</time><b>{day.city}</b><span>{day.activity}</span></li>)}</ol></section>
      <details className={styles.notes} open><summary>查价假设与行程提醒</summary><ul>{[...plan.assumptions,...plan.warnings].map((v,i)=><li key={i}>{v}</li>)}</ul></details>
      <div className={styles.board}><section aria-label="预订候选" className={styles.tasks}>{plan.tasks.map(task=>{
        const result=results[task.id],rec=recommendations.find(r=>r.taskId===task.id),offers=[...(result?.offers||[])].sort((a,b)=>{const ar=rec?.offerIds.indexOf(a.id)??-1,br=rec?.offerIds.indexOf(b.id)??-1;return (ar<0?99:ar)-(br<0?99:br)||(money(a)??Infinity)-(money(b)??Infinity);});
        return <article className={styles.task} key={task.id} data-testid="agent-task"><div className={styles.taskTitle}><span>{names[task.kind]}</span><h3>{task.title}</h3>{choices[task.id]&&<b>已选</b>}</div><p>{task.reason}</p>{task.checks.length>0&&<p className={styles.checks}>需核实：{task.checks.join('；')}</p>}
          {rec?.reason&&<p className={styles.recommendation}>DeepSeek 建议：{rec.reason}</p>}
          {!result?<p className={styles.muted}>{busy?'智能体将自动查询这一项':'尚未查询'}</p>:<><p className={styles.muted}>{result.source==='live'?'途牛 / 供应商实时查询':result.source==='test'||result.source==='fixture'?'测试数据，不可用于预订':'暂未取得可售数据'}{result.queriedAt&&` · ${new Date(result.queriedAt).toLocaleString('zh-CN')}`}</p>{result.notice&&<p className={styles.error}>{result.notice}</p>}{result.coverage&&<p className={styles.muted}>{result.coverage}</p>}{result.state==='empty'&&<p>本次条件没有返回候选，不能据此判定全天无库存。</p>}
          {offers.slice(0,3).map(offer=><div key={offer.id} className={styles.offer} data-testid="agent-offer"><div><b>{offer.name}</b>{task.kind==='flight'&&<p>{offer.departureTime} {offer.departureAirport} — {offer.arrivalTime} {offer.arrivalAirport} · {offer.type||'直飞情况待核实'}</p>}{task.kind==='hotel'&&<p>{offer.address||'具体地址待核实'} {offer.distance}</p>}<small>{offer.priceUnit||(task.kind==='car'?'整段租期报价，押金另计':'供应商参考报价')}</small></div><div className={styles.price}><strong>{money(offer)==null?'价格待核实':`¥${money(offer)}`}</strong><button disabled={busy||detailBusy} aria-label={`选择 ${offer.name}`} onClick={()=>inspect(task,offer)}>{choices[task.id]?.offer.id===offer.id?'查看已选':'选择此项'}</button></div></div>)}
          {offers.length>3&&<details className={styles.more}><summary>查看其余 {offers.length-3} 个已返回候选</summary>{offers.slice(3).map(offer=><div className={styles.offer} key={offer.id}><span>{offer.name} · {offer.departureTime||offer.address} · {money(offer)==null?'价格待核实':`¥${money(offer)}`}</span><button disabled={busy||detailBusy} onClick={()=>inspect(task,offer)}>选择 {offer.name}</button></div>)}</details>}
          {restored&&offers.length>0&&<p className={styles.muted}>这是上次快照，选择时自动读取最新详情。</p>}</>}
        </article>;
      })}</section><aside className={styles.selection} aria-label="我的选择"><h2>我的选择</h2><p>保存在当前浏览器。尚未预订。</p>{!selected&&<p className={styles.muted}>选好机票、房型和车型，它们会汇集在这里。</p>}{plan.tasks.filter(t=>choices[t.id]).map(t=><div key={t.id}><small>{t.title}</small><b>{choices[t.id].offer.name}</b><p>{choices[t.id].option?.name} {choices[t.id].option?.plan}</p>{t.kind==='hotel'&&<small>{t.query.startDate} → {t.query.endDate}</small>}<button onClick={()=>setChoices(c=>{const next={...c};delete next[t.id];return next;})}>移除</button></div>)}<p className={styles.muted}>不同报价口径不合并为总价。正式预订前仍需验价、旅客资料及你确认。</p></aside></div>
    </>}
    {detail&&<section className={styles.modal} role="dialog" aria-modal="true" aria-label="选择房型或舱位"><div><button autoFocus className={styles.close} onClick={()=>{detailController.current?.abort();setDetailBusy(false);setDetail(null);}}>关闭</button><h2>{detail.offer.name}</h2>{detailBusy&&<p aria-live="polite">{detail.waiting || "正在获取实际房型 / 舱位…"}</p>}{detail.error&&<p role="alert">{detail.error}，请重新核实候选。</p>}{detail.data&&<><p>选择具体房型或舱位，保存到「我的选择」。价格和库存以正式验价为准。</p>{(detail.data.options||[]).map(option=><div className={styles.option} key={option.id}><div><b>{option.name} {option.plan}</b><p>{option.bed} {option.meal} {option.baggage}</p><small>{option.refund||'退改规则待核实'} {option.priceUnit}</small></div><button onClick={()=>{setChoices(c=>({...c,[detail.task.id]:{offer:detail.offer,option,selectedAt:new Date().toISOString()}}));setDetail(null);}}>{option.price==null?'价格待核实':`¥${option.price}`} · 选这个</button></div>)}{!detail.data.options?.length&&<p>没有返回可选房型或舱位，请选择其他候选。</p>}</>}</div></section>}
    <footer className={styles.footer}>智能体负责分析与推荐；价格与库存来自接入的供应商。缺少的货源会直接说明。</footer>
  </div></main>;
}
