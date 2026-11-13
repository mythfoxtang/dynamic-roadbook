'use client';
import {useEffect,useState,useRef} from 'react';
import styles from './journey-agent.module.css';
import {reportedFetch} from '@/lib/query-report-client';
import JourneyMap from './journey-map';
const KEYS={idea:'roadbook-journey-draft-v1',fixed:'roadbook-fixed-draft-v1'};
const markdown=d=>`# ${d.title}\n\n${d.summary}\n\n${d.days.map(v=>`## ${v.date} · ${v.city}\n\n${v.activity}\n\n交通：${v.transport}\n\n住宿：${v.stay}`).join('\n\n')}\n\n## 景区季节参考（未实时核实）\n\n${(d.seasonality||[]).map(s=>`- ${s.place}：通常最佳时间 ${s.bestTime}；本次适配：${s.fit}；替代：${s.alternative}`).join('\n')}\n\n## 规划假设\n\n${d.assumptions.map(v=>'- '+v).join('\n')}\n\n## 出发前需核实\n\n${[...d.questions,...d.warnings].map(v=>'- '+v).join('\n')}`;
function downloadDraft(d){const content=d.selectionRequired?d.options.map(markdown).join('\n\n---\n\n'):markdown(d);const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='旅行方案.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function JourneyPlanner({onConfirm,onWorking,disabled,mode='idea',initialInput=''}){
  const key=KEYS[mode],fixed=mode==='fixed';
  const [input,setInput]=useState(fixed?initialInput:''),[draft,setDraft]=useState(null),[adjustment,setAdjustment]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState(false);
  const controller=useRef(null),resultRef=useRef(null);
  const feedbackRef=useRef(null);
  const [operation,setOperation]=useState(''),[failedAction,setFailedAction]=useState(''),[elapsed,setElapsed]=useState(0),[notice,setNotice]=useState('');
  const [history,setHistory]=useState([]);
  const [mapOption,setMapOption]=useState(null);
  useEffect(()=>{try{const s=JSON.parse(localStorage.getItem(key)||'null');if(s){setInput(s.input||'');setDraft(s.draft||null);setAdjustment(s.adjustment||'');setHistory(s.history||[]);}}catch{}setReady(true);return()=>controller.current?.abort();},[]);
  useEffect(()=>{if(ready)try{localStorage.setItem(key,JSON.stringify({input,draft,adjustment,history}));}catch{}},[input,draft,adjustment,history,ready]);
  useEffect(()=>{onWorking?.(busy);},[busy,onWorking]);
  useEffect(()=>{if(!busy||operation!=='confirm-draft')return;const started=Date.now();setElapsed(0);const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(timer);},[busy,operation]);
  useEffect(()=>{if(error&&failedAction==='confirm-draft')feedbackRef.current?.scrollIntoView({block:'center',behavior:'instant'});},[error,failedAction]);
  async function request(action){
    if(controller.current||disabled)return;
    setBusy(true);setError('');setNotice('');setFailedAction('');setOperation(action);setElapsed(0);const abort=new AbortController();controller.current=abort;
    let timedOut=false;const timer=setTimeout(()=>{timedOut=true;abort.abort();},100000);
    try{
      const response=await reportedFetch('/api/travel-agent/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,input,previousDraft:draft,adjustment,draft,mode}),signal:abort.signal});
      const data=await response.json();clearTimeout(timer);if(!response.ok)throw new Error(data.error||'规划暂时不可用');
      if(action==='draft'){setDraft(data.draft);if(adjustment.trim())setHistory(h=>[...h,{request:adjustment,response:data.draft.summary}]);else setHistory([]);setAdjustment('');requestAnimationFrame(()=>resultRef.current?.scrollIntoView({block:'start',behavior:'instant'}));}else {if(!data.plan?.tasks?.length)throw new Error('未取得可查价任务，请修改行程后重试');setOperation('');await onConfirm({...data.plan,planningMode:mode});}
    }catch(e){setFailedAction(action);if(timedOut)setError('整理查价任务超时，尚未开始查询库存。草案已保留，请重试。');else if(e.name==='AbortError')setNotice('已取消整理查价任务，草案已保留，尚未开始查询库存。');else setError(e.message);}finally{clearTimeout(timer);if(controller.current===abort)controller.current=null;setBusy(false);setOperation('');}
  }
  const locked=busy||disabled;
  return <section className={styles.planner} aria-label="先规划再预订">
    <h2>{fixed?'把已有行程整理好，再开始预订':'从目的地和时间开始，一起规划'}</h2><p>{fixed?'保留你已确定的日期和路线，补齐待确认事项。整理后可以提修改意见，也可以直接确认进入预订。':'告诉我大概框架，我来提出逐日方案。你可以多轮修改，满意后再进入预订。'}</p>
    <form onSubmit={e=>{e.preventDefault();request('draft');}} className={styles.input}>
      <label htmlFor={`journey-${mode}`}>{fixed?'把确定的行程交给 DeepSeek':'想去哪里，什么时候出发？'}</label>
      <textarea id={`journey-${mode}`} rows={3} maxLength={12000} value={input} disabled={locked} placeholder="例如：12月上旬去云南玩5天，从上海出发，两个人，想轻松一些，喜欢自然风光" onChange={e=>{setInput(e.target.value);setDraft(null);setHistory([]);}}/>
      <div><small>可补充天数、出发城市、预算和偏好。草案阶段不会查询可售库存。</small><button disabled={locked||!input.trim()}>{busy?'正在处理…':draft?'重新整理':fixed?'整理已有行程':'生成行程草案'}</button></div>
    </form>
    {error&&failedAction!=='confirm-draft'&&<p className={styles.error} role="alert">{error}</p>}
    {draft&&<div ref={resultRef} className={styles.draft} data-testid="journey-draft" tabIndex={-1}>
      <button type="button" onClick={()=>downloadDraft(draft)}>下载 Markdown 行程文档</button>
      {draft.selectionRequired&&<div><p>先在地图上比较方案，再选择方向。</p>{draft.options.map((o,i)=><button type="button" key={i} aria-pressed={mapOption===i} onClick={()=>setMapOption(i)}>查看方案 {i===0?'A':'B'} 地图</button>)}{mapOption!==null&&draft.options[mapOption]&&<JourneyMap days={draft.options[mapOption].days}/>}</div>}
      {!draft.selectionRequired&&<JourneyMap days={draft.days}/>}
      {draft.selectionRequired&&<section aria-label="选择初步方案"><h3>先选一个方向，再一起细化</h3>{draft.options.map((option,i)=><article key={i}><h4>方案 {i===0?'A':'B'}：{option.title}</h4><p>{option.summary}</p><p>{option.days.map(d=>d.city).filter((v,i,a)=>i===0||v!==a[i-1]).join(' → ')}</p>{option.questions.map(q=><p key={q}>{q}</p>)}<button type="button" disabled={locked} onClick={()=>{setDraft({...option,options:undefined,selectionRequired:false});setAdjustment('');setHistory([]);}}>选择方案 {i===0?'A':'B'}，继续完善</button></article>)}</section>}
      {!draft.selectionRequired&&<><h3>{draft.title}</h3><p>{draft.summary}</p>
      {draft.questions.length>0&&<div className={styles.notes}><b>还需要你确认</b><ul>{draft.questions.map((v,i)=><li key={i}>{v}</li>)}</ul></div>}
      <section className={styles.reviewActions} aria-label="修改行程或进入下一步"><h4>有修改意见，直接告诉我；满意就进入下一步</h4>{history.length>0&&<div className={styles.revisions} role="log" aria-label="行程修改记录">{history.slice(-6).map((item,i)=><p key={i}><b>你的修改：</b>{item.request}<br/><b>已更新：</b>{item.response}</p>)}</div>}
      <form className={styles.composer} onSubmit={e=>{e.preventDefault();request('draft');}}><label htmlFor={`draft-adjustment-${mode}`}>你想怎么修改这份行程？</label><textarea id={`draft-adjustment-${mode}`} value={adjustment} onChange={e=>setAdjustment(e.target.value)} rows={2} maxLength={3000} disabled={locked} placeholder="例如：少换一次酒店；第二天想轻松一点；预算是两个人一共6000元"/><button disabled={locked||!adjustment.trim()}>发送修改意见</button></form>
      {adjustment.trim()&&<p className={styles.muted}>你还有未发送的修改意见，请先发送并查看更新后的行程。</p>}
      {!draft.ready&&<p role="status">暂不能开始查价：{draft.questions.length?'请在修改意见中回答上方待确认问题，再点击“发送修改意见”。':'尚未形成完整逐日行程，请补充目的地与出行日期。'} 已生成的方案会保留。</p>}
      <div ref={feedbackRef}>
        {busy&&operation==='confirm-draft'&&<p className={styles.confirmProgress} role="status">正在整理查价任务，随后进入预订工作台。已等待 {elapsed} 秒；此阶段尚未查询库存。<button type="button" onClick={()=>controller.current?.abort()}>取消本次整理</button></p>}
        {error&&failedAction==='confirm-draft'&&<p className={styles.error} role="alert">未能开始查价：{error} 草案已保留，可修改后重试。</p>}
        {notice&&<p role="status">{notice}</p>}
      </div>
      <div className={styles.confirmDraft}><p>下一步：进入统一预订工作台，查询交通和住宿候选，再由你选择。</p><button disabled={locked||!draft.ready||Boolean(adjustment.trim())} onClick={()=>request('confirm-draft')}>{busy&&operation==='confirm-draft'?'正在整理查价任务…':'确认此行程，开始查价'}</button></div>
      </section>
      <ol>{draft.days.map(day=><li key={day.date}><time>{day.date}</time><div><b>{day.city}</b><p>{day.activity}</p><small>交通：{day.transport}<br/>住宿：{day.stay}</small></div></li>)}</ol>

      {[['规划假设',draft.assumptions],['出发前需核实',draft.warnings]].map(([label,values])=>values.length>0&&<details key={label} open><summary>{label}</summary><ul>{values.map((v,i)=><li key={i}>{v}</li>)}</ul></details>)}
      </>}
      {(draft.seasonality||[]).length>0&&!draft.selectionRequired&&<section aria-label="景区季节适配"><h4>景区最佳季节与本次适配</h4><p>以下为通常季节规律，花期、天气、开放与通行须在出发前核实。</p>{draft.seasonality.map((s,i)=><p key={i}><b>{s.place}</b> · 通常最佳时间：{s.bestTime}<br/>本次适配：{s.fit}<br/>替代建议：{s.alternative}</p>)}</section>}
    </div>}
  </section>;
}
