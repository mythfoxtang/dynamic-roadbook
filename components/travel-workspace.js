"use client";
import { useEffect, useMemo, useState } from "react";
import TravelAccount from "./travel-account";
import TravelQueryForm from "./travel-query-form";
import TravelFilters, { initialTravelFilters } from "./travel-filters";
import TravelDetail from "./travel-detail";
import { filterTravelOffers } from "@/lib/travel-filters.mjs";
import { TrainOfferCard, TrainDetail } from './travel-train';
import TravelCar from './travel-car';

function day(offset) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + offset * 86400000)); }
const price = (n) => n === null || n === undefined ? "价格待确认" : `¥${Number(n).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
function OfferCard({ offer: o, checked, busy, onCompare, onDetail }) {
  if(o.kind==='train') return <TrainOfferCard offer={o} {...{checked,busy,onCompare,onDetail}}/>;
  const hotel = o.kind === "hotel";
  return <article className="panel rounded-2xl p-4 sm:p-5" data-testid="travel-offer">
<div className="flex flex-wrap items-start justify-between gap-4">
<div className="min-w-0">
<h3 className="break-words text-lg font-semibold text-white">{o.name}</h3>{hotel ? <>
<p className="mt-2 text-xs text-accent">{[o.stars, o.brand, o.rating !== null ? `评分 ${o.rating}` : "评分未知"].filter(Boolean).join(" · ")}</p>
<p className="mt-2 text-sm leading-6 text-white/60">{[o.area, o.address, o.distance].filter(Boolean).join(" · ") || "位置资料未提供"}</p>
</> : <>
<p className="mt-2 text-sm text-white/85">{o.departureTime} → {o.arrivalTime}</p>
<p className="mt-2 text-sm leading-6 text-white/60">{o.departureAirport} {o.departureTerminal} → {o.arrivalAirport} {o.arrivalTerminal} · {o.type || "直飞情况未知"} · {o.duration || "时长未知"}</p>{o.shared ? <p className="mt-1 text-xs text-white/55">共享航班：{o.shared}</p> : null}</>}</div>
<div className="shrink-0 text-right">
<p className="text-2xl font-semibold text-accent">{price(o.price)}</p>
<p className="mt-1 max-w-56 text-xs leading-6 text-white/50">{hotel ? "供应商起价，展开后核对房型总额" : `票面 ${price(o.fare)} + 税费 ${price(o.tax)}`}</p>
</div>
</div>
    <div className="mt-4 grid gap-2 text-xs leading-6 text-white/65 sm:grid-cols-2">{hotel ? <>
<p>房型：{o.roomName || "待查详情"} · {o.roomArea || "面积未知"}</p>
<p>窗户：{o.window || "未知"}</p>
<p>餐食：{o.meal || "未知"}</p>
<p>退改：{o.refund || "未知，不能默认为可退"}</p>
<p className="sm:col-span-2">设施：{o.facilities.length ? o.facilities.join("、") : "列表未提供独卫、停车等设施，需查详情确认"}</p>
</> : <>
<p>舱等：{o.cabin || "待查详情"} · 余票：{o.seats || "未知"}</p>
<p>行李、购买限制与退改请展开具体舱位。</p>
</>}</div>
    <div className="mt-4 flex flex-wrap items-center gap-4">
<button type="button" disabled={busy} onClick={onDetail} className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-[#181410] disabled:opacity-40">{hotel ? "查看房型与报价" : "查看舱位、行李与退改"}</button>
<label className="flex items-center gap-2 text-sm text-white/65">
<input type="checkbox" checked={checked} onChange={onCompare} />加入比较</label>
</div>
  </article>;
}
function Comparison({ offers, onClear }) {
  if (!offers.length) return null;
  const hotel = offers[0].kind === "hotel";
  const rows = offers[0].kind==='train' ? [["每成人参考价",o=>price(o.price)],["出发/到达站",o=>`${o.departureStation} → ${o.arrivalStation}`],["发车时间",o=>o.departureTime],["运行时长",o=>o.duration],["席别",o=>o.seats.map(s=>`${s.name} ${price(s.price)} ${s.remaining===0?'无票':''}`).join('；')]] : hotel ? [["参考起价", (o) => price(o.price)], ["品牌与星级", (o) => `${o.brand || "未注明品牌"} / ${o.stars}`], ["位置", (o) => o.address || "未知"], ["房型 / 窗户", (o) => `${o.roomName || "未知"} / ${o.window || "未知"}`], ["餐食", (o) => o.meal || "未知"], ["退改", (o) => o.refund || "未知"]]
    : [["每位成人含税参考", (o) => price(o.price)], ["票面 / 税费", (o) => `${price(o.fare)} / ${price(o.tax)}`], ["起降时间", (o) => `${o.departureTime} → ${o.arrivalTime}`], ["机场", (o) => `${o.departureAirport} → ${o.arrivalAirport}`], ["航班类型 / 余票", (o) => `${o.type || "未知"} / ${o.seats || "未知"}`]];
  return <section className="panel rounded-2xl p-5" aria-label="候选比较">
<div className="flex items-center justify-between">
<h2 className="text-lg font-semibold text-white">候选比较（最多 3 个）</h2>
<button type="button" onClick={onClear} className="text-sm text-accent">清空比较</button>
</div>
<div className="mt-4 overflow-x-auto">
<table className="w-full min-w-[560px] border-collapse text-left text-sm">
<thead>
<tr>
<th className="border-b border-white/10 p-3 text-white/50">项目</th>{offers.map((o) => <th key={o.id} className="border-b border-white/10 p-3 text-white">{o.name}</th>)}</tr>
</thead>
<tbody>{rows.map(([label, value]) => <tr key={label}>
<th className="border-b border-white/10 p-3 text-white/50">{label}</th>{offers.map((o) => <td key={o.id} className="max-w-72 border-b border-white/10 p-3 text-white/75">{value(o)}</td>)}</tr>)}</tbody>
</table>
</div>
<p className="mt-3 text-xs leading-6 text-white/50">只比较当前加载的官方参考值。住宿须进一步核对人数、日期、房型和退改；机票须展开具体舱位，不能仅凭最低票价决定。</p>
</section>;
}
const STATUS = { submitting: "正在创单，勿重复提交", unknown: "创单结果未知，需向官方核实", created_unpaid: "已返回订单号，尚未确认支付或履约", cancelled_unpaid: "供应商已取消未支付机票订单", cancellation_submitting: "正在申请取消", cancellation_pending: "取消待确认", cancellation_unknown: "取消结果未知，需向官方核实" };
export default function TravelWorkspace({initialKind='hotel'}) {
  const [kind, setKind] = useState(initialKind), [connection, setConnection] = useState(null);
  const [queries, setQueries] = useState(() => ({ hotel: { kind: "hotel", city: "成都", startDate: day(7), endDate: day(8), adults: 2, children: 0, rooms: 1, childAges: "", keyword: "", poi: "", minPrice: "", maxPrice: "300" }, flight: { kind: "flight", from: "上海", to: "成都", date: day(7), adults: 2, children: 0, mode: "LOWEST", departureTime: "", arrivalTime: "", minPrice: "", maxPrice: "" },train:{kind:'train',from:'上海',to:'南京',date:day(3),adults:2,children:0,mode:'3',departureTime:'',arrivalTime:'',minPrice:'',maxPrice:''} }));
  const [results, setResults] = useState({}), [filters, setFilters] = useState({ ...initialTravelFilters });
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [detail, setDetail] = useState(null), [requirements, setRequirements] = useState("");
  const [compareIds, setCompareIds] = useState([]), [orders, setOrders] = useState([]), [cancelId, setCancelId] = useState("");
  const result = results[kind], query = queries[kind];
  useEffect(() => {
    const params = new URLSearchParams(window.location.search), presetKind = params.get("kind");
    if (!["hotel", "flight", "train", "car"].includes(presetKind)) return;
    if(presetKind==='car'){setKind('car');return;}
    const allowed = presetKind === "hotel" ? ["city", "startDate", "endDate", "adults", "children", "rooms", "keyword", "poi", "minPrice", "maxPrice"] : ["from", "to", "date", "adults", "children", "mode", "minPrice", "maxPrice"];
    const preset = Object.fromEntries(allowed.filter((k) => params.has(k)).map((k) => [k, params.get(k).slice(0, 100)]));
    setQueries((old) => ({ ...old, [presetKind]: { ...old[presetKind], ...preset } })); setKind(presetKind);
  }, []);
  const queryChanged = Boolean(result && result.uiSnapshot !== JSON.stringify(query));
  const visible = useMemo(() => filterTravelOffers(result?.offers || [], filters), [result, filters]);
  const compared = (result?.offers || []).filter((o) => compareIds.includes(o.id));
  async function request(body) {
    const response = await fetch("/api/travel/query/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => { throw new Error("服务器未返回有效数据，请稍后重试"); });
    if (!response.ok) throw new Error(data.error || "请求失败");
    if (data.connection) setConnection(data.connection);
    return data.data;
  }
  async function run(action, extra = {}) {
    if (busy) return;
    setBusy(action); setError("");
    try {
      if (action === "search") {
        const data = await request({ ...query, action, ...extra }); setResults((old) => ({ ...old, [kind]: { ...data, uiSnapshot: JSON.stringify(query) } })); setDetail(null); setRequirements(""); setCompareIds([]); setFilters({ ...initialTravelFilters, minPrice: query.minPrice ?? "", maxPrice: query.maxPrice ?? "" });
        if(kind==='train')setFilters({...initialTravelFilters,highSpeedOnly:true,availableOnly:false,seat:'',maxPrice:query.maxPrice||'',minSeats:String(query.adults)});
      } else if (action === "next") { const data = await request({ action, searchId: result.id, ...extra }); setResults((old) => ({ ...old, [kind]: { ...data, uiSnapshot: result.uiSnapshot } })); }
      else if (action === "detail") { const data = await request({ action, searchId: result.id, ...extra }); setDetail(data); setRequirements(""); document.getElementById("travel-detail")?.scrollIntoView({ block: "start", behavior: "instant" }); }
      else if (action === "requirements") { const data = await request({ action, searchId: result.id }); setRequirements(data.text || "供应商未返回文字要求"); }
      else if (action === "book") { const data = await request({ action, searchId: result.id, ...extra }); setOrders((old) => [data, ...old.filter((o) => o.id !== data.id)]); setDetail(null); setCancelId(""); }
      else if (action === "orders") setOrders(await request({ action }));
      else if (action === "cancel") { const data = await request({ action, ...extra }); setOrders((old) => old.map((o) => o.id === data.id ? data : o)); setCancelId(""); }
      else if (action === "sync") { const data=await request({action,...extra});setOrders(old=>old.map(o=>o.id===data.id?data:o)); }
    } catch (e) {
      setError(e.message || "网络不可用，请稍后再试");
      if (action === "book" || action === "cancel") { try { setOrders(await request({ action: "orders" })); } catch {} }
    } finally { setBusy(""); }
  }
  function toggleCompare(id) { setError(""); if (compareIds.includes(id)) setCompareIds(compareIds.filter((v) => v !== id)); else if (compareIds.length < 3) setCompareIds([...compareIds, id]); else setError("最多同时比较 3 个候选，请先取消其中一个。"); }
  return <div className="space-y-5">
<header>
<h1 className="text-3xl font-semibold text-white">把行程，逐项落实</h1>
<p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">机票、高铁、住宿和自驾租车，在一个地方核对日期、预算与预订条件。查价后再选具体席别、房型或车型，清楚掌握每一笔费用。</p>
</header>
    <details open={!connection?.connected} className="rounded-2xl border border-white/10"><summary className="cursor-pointer px-5 py-4 text-sm text-white/70">{connection?.connected?'途牛账号已连接 · 管理机票、酒店和高铁权限':'连接机票、酒店与高铁货源'}</summary><TravelAccount onStatus={setConnection} liveStatus={connection}/></details>
    <div className="flex flex-wrap gap-3" role="group" aria-label="旅游查询类型">{[["hotel", "国内住宿"], ["flight", "国内机票"],['train','高铁火车'],['car','自驾租车']].map(([type, label]) => <button key={type} type="button" disabled={Boolean(busy)} aria-pressed={kind === type} onClick={() => { setKind(type); setDetail(null); setRequirements(""); setFilters({ ...initialTravelFilters,...(type==='train'?{highSpeedOnly:true}: {}) }); setCompareIds([]); setError("");window.history.replaceState(null,'',`${window.location.pathname}?kind=${type}`); }} className={`rounded-xl border px-5 py-3 text-sm ${kind === type ? "border-accent/50 bg-accent/10 text-accent" : "border-white/15 text-white/65"}`}>{label}</button>)}<button type="button" onClick={() => run("orders")} disabled={Boolean(busy)} className="ml-auto rounded-xl border border-white/15 px-4 py-3 text-sm text-white/65">读取本项目订单记录</button>
</div>
    {kind==='car'?<TravelCar/>:<>
    <TravelQueryForm query={query} setQuery={(q) => setQueries({ ...queries, [kind]: q })} busy={Boolean(busy)} onSearch={() => run("search")} onRefresh={() => run("search", { refresh: true })} hasResults={Boolean(result)} />
    <div aria-live="polite">{queryChanged ? <p role="status" className="text-sm text-warning">查询条件已修改。下方仍是上一次查询结果，请重新查询后再查看详情或下单。</p> : null}{busy ? <p role="status" className="text-sm text-white/70">正在{busy === "book" ? "提交真实未支付订单，请勿重复操作" : busy === "next" ? "读取供应商下一页" : "请求官方接口"}…</p> : null}{error ? <p role="alert" className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm leading-7 text-warning">{error}</p> : null}</div>
    {orders.length ? <section className="panel rounded-2xl p-5" aria-label="本项目订单记录">
<h2 className="text-lg font-semibold text-white">本项目订单记录</h2>
<p className="mt-2 text-xs leading-6 text-white/50">本站不把创建订单当作支付成功。当前状态不自动同步支付、出票或酒店确认，请核对官方订单。</p>
<div className="mt-3 space-y-3">{orders.map((o) => <article key={o.id} className="rounded-xl border border-white/15 p-4">
<h3 className="text-white">{o.title}</h3>
<p className="mt-2 text-sm text-accent">{o.providerStatus || STATUS[o.status] || o.status}{o.providerPayStatus?` · ${o.providerPayStatus}`:''}</p>
<p className="mt-1 text-sm text-white/70">官方订单号：{o.supplierOrderId || "尚未返回，需核实"}</p>
<p className="mt-2 text-xs leading-6 text-white/55">{o.notice}</p>
<div className="mt-3 flex flex-wrap gap-3">{o.kind==='train'?<button type="button" disabled={Boolean(busy)} onClick={()=>run('sync',{orderId:o.id})} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/75">同步高铁官方订单状态</button>:null}{o.paymentUrl ? <a href={o.paymentUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-accent/40 px-4 py-2 text-sm text-accent">在途牛核对订单与付款</a> : null}{["flight","train"].includes(o.kind) && o.status === "created_unpaid" ? cancelId === o.id ? <button type="button" disabled={Boolean(busy)} onClick={() => run("cancel", { orderId: o.id, confirmed: true })} className="rounded-xl border border-warning/40 px-4 py-2 text-sm text-warning">确认申请取消此未支付订单</button> : <button type="button" onClick={() => setCancelId(o.id)} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/65">{o.kind==='train'?'申请取消未支付车票订单':'申请取消未支付机票订单'}</button> : null}</div>
</article>)}</div>
</section> : null}
    <div id="travel-detail" className="scroll-mt-4">{detail && !queryChanged ? detail.kind==='train'?<TrainDetail detail={detail} busy={Boolean(busy)} onRefresh={()=>run('detail',{offerId:detail.offerId,refresh:true})} onBook={body=>run('book',body)} onClose={()=>setDetail(null)}/>:<TravelDetail detail={detail} busy={Boolean(busy)} requirements={requirements} onRequirements={() => run("requirements")} onRefresh={() => run("detail", { offerId: detail.offerId, refresh: true })} onBook={(body) => run("book", body)} onClose={() => setDetail(null)} /> : null}</div>
    <Comparison offers={compared} onClear={() => setCompareIds([])} />
    {result ? <>
<section className="border-y border-white/10 py-4">
<h2 className="text-lg font-semibold text-white">已加载 {result.count} 个候选 · 当前筛选保留 {visible.length} 个</h2>
<p className="mt-2 text-sm leading-7 text-white/65">{result.coverage}。{result.cached ? "本次使用缓存。" : ""}查询时间：{new Date(result.queriedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}。</p>
<p className="mt-1 text-xs text-white/50">当前本地估算剩余额度 {connection?.quota?.remainingToday ?? "--"}/50 次；不含同账号其他 Key 或设备已用额度。</p>{result.warnings?.map((w, i) => <p key={i} className="mt-2 text-xs text-warning">{w}</p>)}</section>
<div className="grid items-start gap-5 lg:grid-cols-[260px,minmax(0,1fr)]">
<TravelFilters kind={kind} offers={result.offers} filters={filters} setFilters={setFilters} />
<div className="min-w-0 space-y-4">{visible.map((offer) => <OfferCard key={offer.id} offer={offer} checked={compareIds.includes(offer.id)} busy={Boolean(busy) || queryChanged} onCompare={() => toggleCompare(offer.id)} onDetail={() => run("detail", { offerId: offer.id })} />)}{!visible.length ? <p className="panel rounded-xl p-5 text-sm leading-7 text-white/65">{result.count ? "当前已加载结果没有符合筛选条件的候选。可以清空本地筛选或继续读取后续页，不自动扩大预算。" : "供应商本次没有返回可用候选。请调整日期、城市或条件；不会拿其他城市或测试数据替代。"}</p> : null}{!result.complete && result.totalPages !== null ? <div className="flex flex-wrap gap-3">
<button disabled={Boolean(busy)} onClick={() => run("next", { count: 1 })} className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-[#181410] disabled:opacity-40">加载下一页（{result.loadedPages}/{result.totalPages}）</button>
<button disabled={Boolean(busy)} onClick={() => run("next", { count: 3 })} className="rounded-xl border border-white/20 px-4 py-3 text-sm text-white/75 disabled:opacity-40">继续加载最多 3 页</button>
</div> : <p className="py-3 text-xs text-white/50">{result.complete ? "供应商本次声明的分页已读取完毕。仍不代表全平台或全市场库存。" : "供应商没有给出有效总页数，当前无法判断库存覆盖范围。"}</p>}</div>
</div>
</> : <section className="panel rounded-2xl p-5 text-sm leading-7 text-white/60">连接账号后开始查询。不会用默认海外酒店、虚构价格或本地测试数据填充正式结果。</section>}
  </>}
  </div>;
}
