"use client";

import { useEffect, useRef, useState } from "react";
import { BedDouble, CarFront, ExternalLink, LoaderCircle, Plane, Search } from "lucide-react";

const TYPES = [{ kind: "flight", label: "机票", icon: Plane }, { kind: "hotel", label: "酒店", icon: BedDouble }, { kind: "car", label: "租车", icon: CarFront }];
const PORTALS = { flight: "https://flights.ctrip.com/", hotel: "https://hotels.ctrip.com/hotels", car: "https://car.ctrip.com/zijia" };
const inputClass = "w-full rounded-xl border border-white/15 bg-black/25 px-3 py-3 text-sm text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent [color-scheme:dark]";

function Field({ label, name, value, onChange, type = "text", ...props }) {
  return <label className="block"><span className="mb-2 block text-sm text-white/70">{label}</span><input required name={name} type={type} value={value} onChange={(event) => onChange(name, event.target.value)} className={inputClass} {...props} /></label>;
}

export default function BookingSearch({ initialQuery = {} }) {
  const [form, setForm] = useState({ kind: "flight", from: "", to: "", date: "", city: "", returnCity: "", startDate: "", endDate: "", adults: 1, ...initialQuery });
  const [providers, setProviders] = useState(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [shortlist, setShortlist] = useState([]);
  const [now, setNow] = useState(Date.now());
  const controller = useRef(null);
  const sequence = useRef(0);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("dynamic-roadbook-shortlist-v1") || "[]");
      if (Array.isArray(stored)) setShortlist(stored.filter((item) => item && typeof item.id === "string" && typeof item.title === "string" && Number.isFinite(item.amount) && typeof item.currency === "string" && typeof item.provider === "string").slice(0, 50));
    } catch { /* A damaged local shortlist must not prevent searching. */ }
    const abort = new AbortController();
    fetch("/api/bookings/providers", { cache: "no-store", signal: abort.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!Array.isArray(data.providers)) throw new Error();
      setProviders(data.providers);
    }).catch(() => { if (!abort.signal.aborted) setAvailabilityError("暂时无法检查报价接口。请确认网站以服务端模式运行，也可先前往携程预订。"); });
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => { abort.abort(); controller.current?.abort(); window.clearInterval(timer); };
  }, []);

  function change(name, value) {
    sequence.current += 1;
    controller.current?.abort();
    setLoading(false); setResult(null); setError(""); setSaved("");
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function search(event) {
    event.preventDefault();
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const id = ++sequence.current;
    setLoading(true); setError(""); setResult(null); setSaved("");
    try {
      const response = await fetch("/api/bookings/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form), signal: abort.signal });
      const data = await response.json().catch(() => { throw new Error("查询接口未返回有效数据，请确认网站以服务端模式运行"); });
      if (!response.ok) throw new Error(data.error || "查询失败，请稍后重试");
      if (id === sequence.current) setResult(data);
    } catch (err) { if (id === sequence.current && !abort.signal.aborted) setError(err.message || "网络连接失败，请稍后重试"); }
    finally { if (id === sequence.current) setLoading(false); }
  }

  function saveOffer(offer) {
    try {
      const key = "dynamic-roadbook-shortlist-v1";
      const previous = shortlist;
      const entry = { ...offer, kind: result.kind, query: result.query, provider: result.provider, liveMode: result.liveMode, searchedAt: result.searchedAt, status: "selected" };
      const next = [entry, ...previous.filter((item) => item && (item.id !== offer.id || item.provider !== result.provider))].slice(0, 50);
      localStorage.setItem(key, JSON.stringify(next));
      setShortlist(next);
      setSaved(`已保存候选：${offer.title}。候选不代表已预订，可在下方任务中手动记录订单。`);
    } catch { setSaved("浏览器无法保存候选，请检查存储权限。"); }
  }

  function removeOffer(id, providerName) {
    const next = shortlist.filter((item) => item.id !== id || item.provider !== providerName);
    try { localStorage.setItem("dynamic-roadbook-shortlist-v1", JSON.stringify(next)); setShortlist(next); }
    catch { setSaved("浏览器无法更新候选，请检查存储权限。"); }
  }

  const provider = providers?.find((item) => item.kind === form.kind);
  return (
    <section id="booking-search" aria-label="机票酒店租车查询" className="panel rounded-[24px] p-4 sm:p-6 scroll-mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-2xl font-semibold text-white">把行程变成预订</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-white/65">带入行程，确认日期与人数，查询机票、住宿和用车。付款与预订结果以平台确认为准。</p></div>
        <span className="rounded-full border border-white/15 px-3 py-2 text-xs text-white/65">{provider?.configured ? `${provider.provider} · 已配置，待查询验证` : providers ? "当前使用平台跳转预订" : "检查报价接口中"}</span>
      </div>
      <div className="mt-5 flex gap-2" role="group" aria-label="查询类型">{TYPES.map(({ kind, label, icon: Icon }) => <button key={kind} type="button" aria-pressed={form.kind === kind} onClick={() => change("kind", kind)} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${form.kind === kind ? "border-accent/40 bg-accent/15 text-accent" : "border-white/10 text-white/65"}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
      <form onSubmit={search} className="mt-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {form.kind === "flight" ? <>
            <Field label="出发城市 / IATA 代码" name="from" value={form.from} onChange={change} placeholder="上海 / SHA" maxLength={100} />
            <Field label="到达城市 / IATA 代码" name="to" value={form.to} onChange={change} placeholder="昆明 / KMG" maxLength={100} />
            <Field label="出发日期" name="date" value={form.date} onChange={change} type="date" />
          </> : <>
            <Field label={form.kind === "hotel" ? "住宿城市 / 地点" : "取车城市"} name="city" value={form.city} onChange={change} placeholder="成都" maxLength={100} />
            {form.kind === "car" ? <Field label="还车城市" name="returnCity" value={form.returnCity} onChange={change} placeholder="成都" maxLength={100} /> : null}
            <Field label={form.kind === "hotel" ? "入住日期" : "取车日期"} name="startDate" value={form.startDate} onChange={change} type="date" />
            <Field label={form.kind === "hotel" ? "离店日期" : "还车日期"} name="endDate" value={form.endDate} onChange={change} type="date" />
          </>}
          <Field label="成人数" name="adults" value={form.adults} onChange={change} type="number" min="1" max="9" step="1" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-[#181410] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">{loading ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Search className="h-4 w-4" />}{loading ? "查询中…" : "查询报价"}</button>
          <a href={PORTALS[form.kind]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm text-white/85">去携程预订<ExternalLink className="h-4 w-4" /></a>
          <span className="text-xs leading-6 text-white/50">携程入口需在平台内核对并填写搜索条件。</span>
        </div>
      </form>
      {availabilityError || (providers && !provider?.configured) ? <p className="mt-4 text-sm leading-7 text-[#f0cb96]">{availabilityError || "此类报价接口尚未开通。可以先在携程完成预订，回来手动记录订单确认号。"}</p> : null}
      <div aria-live="polite" aria-busy={loading}>
        {error ? <p role="alert" className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">{error}</p> : null}
        {result ? <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-sm text-white/75">来源：{result.provider} · {result.liveMode ? "正式环境" : "测试环境"} · 查询时间：{new Date(result.searchedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p>
          <p className="mt-2 text-sm text-white/55">{result.notice}</p>
          {!result.offers.length ? <p className="py-6 text-sm text-white/70">此条件下未返回报价。请调整日期、机场或地点，也可以前往携程继续查询。</p> : null}
          <div className="mt-4 space-y-3">{result.offers.map((offer) => {
            const expired = offer.expiresAt && Date.parse(offer.expiresAt) <= now;
            return <article key={offer.id} className="flex flex-col justify-between gap-4 rounded-xl border border-white/12 bg-white/5 p-4 sm:flex-row">
              <div className="min-w-0"><h3 className="font-semibold text-white break-words">{offer.title}</h3><p className="mt-2 max-w-2xl break-words text-sm leading-7 text-white/65">{offer.description}</p><p className="mt-2 text-xs text-white/50">{offer.priceBasis}{offer.expiresAt ? ` · ${expired ? "报价已过期，请重新查询" : `有效至 ${new Date(offer.expiresAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`}` : " · 有效期请向供应商确认"}</p></div>
              <div className="shrink-0 sm:text-right"><p className="text-xl font-semibold text-accent">{offer.currency} {Number(offer.amount).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={Boolean(expired)} onClick={() => saveOffer(offer)} className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80 disabled:opacity-40">保存候选</button>{offer.checkoutUrl && !expired && result.liveMode ? <a href={offer.checkoutUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-[#181410]">前往供应商确认预订</a> : <span className="self-center text-xs text-white/50">{expired ? "需要重新查询" : "暂不支持此报价在线下单"}</span>}</div></div>
            </article>;
          })}</div>
        </div> : null}
        {saved ? <p className="mt-4 text-sm leading-7 text-white/75">{saved}</p> : null}
      </div>
      {shortlist.length ? <details className="mt-6 border-t border-white/10 pt-4"><summary className="cursor-pointer text-sm text-white/80">已保存候选（{shortlist.length}）</summary><p className="mt-2 text-xs leading-6 text-white/50">保存在当前浏览器，候选价格可能已变化。重新查询后再确认预订。</p><ul className="mt-3 space-y-3">{shortlist.map((item) => <li key={`${item.provider}-${item.id}`} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 p-3"><div className="min-w-0 text-sm text-white/75"><p className="break-words">{item.title}</p><p className="mt-1 text-xs text-white/50">{item.provider} · {item.liveMode ? "正式环境" : "测试环境"} · {item.currency} {item.amount}</p></div><button type="button" onClick={() => removeOffer(item.id, item.provider)} className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70">移除候选</button></li>)}</ul></details> : null}
    </section>
  );
}
