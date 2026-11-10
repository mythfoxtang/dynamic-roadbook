"use client";
import { useEffect, useState } from "react";
import { BedDouble, CheckCircle2, LoaderCircle } from "lucide-react";

const fieldClass = "mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-accent [color-scheme:dark]";
const buttonClass = "rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-[#181410] disabled:opacity-50";
const empty = { offers: [], prebook: null, booking: null };
function HotelFilters({ query, onChange, disabled }) {
  function update(name, value) { onChange({ ...query, [name]: value }); }
  const selectClass = `${fieldClass} [color-scheme:dark]`;
  return <fieldset disabled={disabled} className="mt-5 space-y-4 border-t border-white/10 pt-4"><legend className="pt-4 text-sm font-semibold text-white/80">价格与住宿条件</legend>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm text-white/75">报价币种<select aria-label="报价币种" value={query.currency} onChange={(e) => update("currency", e.target.value)} className={selectClass}><option value="CNY">人民币 CNY</option><option value="USD">美元 USD</option><option value="EUR">欧元 EUR</option></select></label>
      <label className="text-sm text-white/75">每晚房价上限（{query.currency}）<input type="number" min="0.01" max="1000000" step="0.01" placeholder="留空不限" value={query.maxNightly} onChange={(e) => update("maxNightly", e.target.value)} className={fieldClass} /></label>
      <label className="text-sm text-white/75">酒店星级<select aria-label="酒店星级" value={query.maxStars} onChange={(e) => update("maxStars", e.target.value)} className={selectClass}><option value="">不限，含未标星</option><option value="2">2 星及以下</option><option value="3">3 星及以下</option><option value="4">4 星及以下</option><option value="5">5 星及以下</option></select></label>
      <label className="text-sm text-white/75">价格排序<select aria-label="价格排序" value={query.sort} onChange={(e) => update("sort", e.target.value)} className={selectClass}><option value="priceAsc">低价优先</option><option value="priceDesc">高价优先</option></select></label>
    </div>
    <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/75"><label className="flex items-center gap-2"><input type="checkbox" checked={query.refundableOnly} onChange={(e) => update("refundableOnly", e.target.checked)} />只看可退款房价</label><label className="flex items-center gap-2"><input type="checkbox" checked={query.breakfastOnly} onChange={(e) => update("breakfastOnly", e.target.checked)} />只看含早餐</label></div>
    <p className="text-xs leading-6 text-white/55">预算按整单房价 ÷ 入住晚数计算，不含另付税费。星级、早餐和退改条件会提交供应商；预算再按返回金额筛选。选择星级上限时排除未标星酒店。修改条件后需重新查询。</p>
  </fieldset>;
}
function money(amount, currency) { return `${currency || ""} ${Number.isFinite(Number(amount)) ? Number(amount).toFixed(2) : "待确认"}`; }
function Conditions({ cancellation, taxes }) {
  return <div className="mt-3 text-xs leading-6 text-white/60">
<p>退改标识：{cancellation?.refundableTag || "供应商未注明，请确认规则"}</p>{cancellation?.cancelPolicyInfos?.length ? <pre className="whitespace-pre-wrap break-words font-sans">{JSON.stringify(cancellation.cancelPolicyInfos, null, 2)}</pre> : <p>未返回具体免费取消时限，请勿默认可退。</p>}{(taxes || []).map((tax, index) => <p key={index}>{tax.description || "税费"}：{money(tax.amount, tax.currency)}（{tax.included ? "已计入报价" : "未计入报价，可能需到店另付"}）</p>)}</div>;
}
export default function HotelTrial() {
  const [query, setQuery] = useState({ city: "Paris France", startDate: "2027-01-15", endDate: "2027-01-16", currency: "CNY", maxNightly: "500", maxStars: "3", refundableOnly: false, breakfastOnly: false, sort: "priceAsc" });
  const [data, setData] = useState(empty);
  const [guest, setGuest] = useState({ firstName: "Sandbox", lastName: "Test", email: "booking-test@example.com" });
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/hotel-trial/", { cache: "no-store", signal: abort.signal }).then((r) => r.ok ? r.json() : null).then((value) => { if (value) { setData(value); if (value.query) setQuery({ ...value.query, maxNightly: value.query.maxNightly ?? "", maxStars: value.query.maxStars ?? "" }); } }).catch(() => {});
    return () => abort.abort();
  }, []);
  async function run(action, extra = {}) {
    if (busy) return;
    setBusy(action); setError("");
    try {
      const response = await fetch("/api/hotel-trial/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "供应商未完成请求");
      setData(result); setConfirmed(false);
    } catch (err) {
      setError(err.message || "网络不可用，请稍后重试");
      // Recover server state without ever retrying a potentially accepted order.
      if (action === "book") {
        try { const response = await fetch("/api/hotel-trial/", { cache: "no-store" }); if (response.ok) setData(await response.json()); } catch { /* Keep the last quote visible. */ }
      }
    } finally { setBusy(""); }
  }
  const pre = data.prebook;
  const locked = pre && ["submitting", "unknown"].includes(pre.state);
  const changed = data.query && ["city", "startDate", "endDate", "currency", "maxNightly", "maxStars", "refundableOnly", "breakfastOnly", "sort"].some((key) => String(query[key] ?? "") !== String(data.query[key] ?? ""));
  function changeQuery(next) { setQuery(next); setConfirmed(false); }
  return <div className="space-y-5">
    <header className="panel rounded-[24px] p-5 sm:p-7">
<div className="flex flex-wrap items-center justify-between gap-3">
<h1 className="flex items-center gap-3 text-2xl font-semibold text-white">
<BedDouble className="h-6 w-6 text-accent" />站内订酒店</h1>
<span className="rounded-full border border-accent/40 px-3 py-2 text-xs text-accent">LiteAPI 官方沙盒</span>
</div>
<p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">搜索房价、选房、验价、填写入住人、模拟付款和查看订单都在本站完成。每一步调用供应商测试接口。</p>
<p className="mt-3 rounded-xl border border-accent/25 bg-accent/10 p-3 text-sm leading-7 text-accent">这是试订，不扣款、不能入住。只填写虚拟测试信息。当前支持 1 间房、1 位成人，沙盒成功不代表中国酒店覆盖或正式支付已开通。</p>
<ol className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
<li>1. 查询房价</li>
<li>2. 验价与规则</li>
<li>3. 模拟付款</li>
<li>4. 订单结果</li>
</ol>
</header>
    <section className="panel rounded-[24px] p-5 sm:p-6">
<h2 className="text-lg font-semibold text-white">查询酒店</h2>
<p className="mt-2 text-xs leading-6 text-white/55">巴黎用于验证测试流程；可以改为上海等城市，无库存时会如实显示，不替换城市。</p>
<form onSubmit={(e) => { e.preventDefault(); run("search", query); }} className="mt-4">
<div className="grid gap-4 sm:grid-cols-3">
<label className="text-sm text-white/75">城市与国家<input required maxLength={100} value={query.city} disabled={Boolean(busy) || locked} onChange={(e) => changeQuery({ ...query, city: e.target.value })} className={fieldClass} />
</label>
<label className="text-sm text-white/75">入住日期<input required type="date" value={query.startDate} disabled={Boolean(busy) || locked} onChange={(e) => changeQuery({ ...query, startDate: e.target.value })} className={fieldClass} />
</label>
<label className="text-sm text-white/75">退房日期<input required type="date" value={query.endDate} disabled={Boolean(busy) || locked} onChange={(e) => changeQuery({ ...query, endDate: e.target.value })} className={fieldClass} />
</label>
</div>
<HotelFilters query={query} onChange={changeQuery} disabled={Boolean(busy) || locked} />
<button disabled={Boolean(busy) || locked} className={`${buttonClass} mt-4`}>{busy === "search" ? "供应商查询中…" : "查询沙盒房价"}</button>
{changed ? <p className="mt-3 text-sm text-accent">筛选条件已修改，请重新查询。下方仍是上次结果，暂不能选择或下单。</p> : null}
</form>
</section>
    <div aria-live="polite" aria-busy={Boolean(busy)}>{busy ? <p className="flex items-center gap-2 text-sm text-white/70">
<LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />{busy === "book" ? "正在向供应商提交模拟订单，请勿重复提交…" : "正在请求供应商接口…"}</p> : null}{error ? <p role="alert" className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm leading-7 text-warning">{error}</p> : null}{locked ? <p className="mt-3 text-sm leading-7 text-warning">订单正在处理或结果未知。已锁定重复提交；请保留页面，不要把它当成已预订。</p> : null}</div>
    {data.booking ? <section className="panel rounded-[24px] border border-accent/40 p-6" aria-label="供应商订单结果">
<h2 className="flex items-center gap-2 text-xl font-semibold text-white">
<CheckCircle2 className="h-5 w-5 text-accent" />{data.booking.status === "CONFIRMED" ? "沙盒订单已确认" : "沙盒订单已提交，待确认"}</h2>
<dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
<div>
<dt className="text-white/50">供应商订单号</dt>
<dd className="mt-1 break-all text-white" data-testid="hotel-booking-id">{data.booking.bookingId}</dd>
</div>
<div>
<dt className="text-white/50">供应商状态</dt>
<dd className="mt-1 text-white">{data.booking.status}</dd>
</div>
<div>
<dt className="text-white/50">酒店 / 确认码</dt>
<dd className="mt-1 text-white">{data.booking.hotelName} / {data.booking.hotelConfirmationCode || "尚未返回"}</dd>
</div>
<div>
<dt className="text-white/50">订单金额（测试）</dt>
<dd className="mt-1 text-white">{money(data.booking.amount, data.booking.currency)}</dd>
</div>
</dl>
<p className="mt-4 text-sm leading-7 text-accent">未扣款，不能用于入住。此结果来自供应商沙盒，不会标记为你的真实行程已预订。</p>
</section> : null}
    {pre && !data.booking ? <section className="panel rounded-[24px] p-5 sm:p-6" aria-label="确认报价与模拟付款">
<h2 className="text-xl font-semibold text-white">确认报价与模拟付款</h2>
<p className="mt-3 text-white">{pre.hotelName} · {pre.roomName}</p>
<p className="mt-2 text-sm text-white/60">{pre.query.startDate} 至 {pre.query.endDate} · 1 间房 / 1 位成人</p>
<p className="mt-3 text-2xl font-semibold text-accent">{money(pre.amount, pre.currency)}</p>
<p className="mt-1 text-xs text-white/60">供应商本次验价金额；未包含的到店税费另列。请按本次报价重新确认。</p>{pre.cancellationChanged || pre.boardChanged ? <p className="mt-3 text-warning">供应商提示退改或餐食条件发生变化，请核对后再确认。</p> : null}<Conditions cancellation={pre.cancellation} taxes={pre.taxes} />{pre.terms ? <details className="mt-3 text-sm text-white/65">
<summary className="cursor-pointer">供应商预订条款</summary>
<pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs">{pre.terms}</pre>
</details> : null}<form className="mt-5" onSubmit={(e) => { e.preventDefault(); run("book", { prebookId: pre.id, ...guest, confirmed }); }}>
<div className="grid gap-4 sm:grid-cols-3">{[["firstName", "测试入住人名"], ["lastName", "测试入住人姓"], ["email", "测试邮箱"]].map(([field, label]) => <label key={field} className="text-sm text-white/75">{label}<input required type={field === "email" ? "email" : "text"} value={guest[field]} maxLength={100} disabled={Boolean(busy) || locked} onChange={(e) => setGuest({ ...guest, [field]: e.target.value })} className={fieldClass} />
</label>)}</div>
<label className="mt-4 flex items-start gap-3 text-sm leading-7 text-white/75">
<input type="checkbox" checked={confirmed} disabled={Boolean(busy) || locked} onChange={(e) => setConfirmed(e.target.checked)} className="mt-2" />我已核对本次测试金额及退改规则，确认提交沙盒订单；不会真实付款，也不能入住。</label>
<button disabled={!confirmed || Boolean(busy) || locked || changed} className={`${buttonClass} mt-4`}>模拟付款并确认订单</button>
<p className="mt-2 text-xs leading-6 text-white/50">沙盒付款由供应商的模拟支付方法处理，不需要银行卡，也不会打开其他网站。</p>
</form>
</section> : null}
    {data.place ? <section aria-label="酒店报价列表">
<h2 className="mb-3 text-lg font-semibold text-white">{data.place} · 供应商测试报价</h2><p className="mb-4 text-xs leading-6 text-white/60">本次供应商返回 {data.candidateCount ?? "--"} 家候选，筛选后展示 {data.offers.length} 家酒店，每家保留最低的符合条件房型，最多展示 30 家。当前结果不代表全城所有酒店。{data.query?.maxNightly != null ? ` 每晚房价上限：${data.query.currency} ${data.query.maxNightly}。` : ""}{data.query?.maxStars ? ` ${data.query.maxStars} 星及以下。` : ""}</p>{!data.offers.length ? <p className="panel rounded-xl p-5 text-sm leading-7 text-white/65">当前条件下没有符合要求的沙盒房价。可提高预算、将星级设为不限，或取消早餐和退款限制，再重新查询。</p> : <div className="grid gap-4 md:grid-cols-2">{data.offers.map((offer) => <article key={offer.id} className="panel rounded-[20px] p-5">
<h3 className="font-semibold text-white">{offer.hotelName}</h3>
<p className="mt-2 text-xs text-accent">{offer.stars ? `${offer.stars} 星` : "供应商未标星"}</p>
<p className="mt-1 text-xs leading-6 text-white/50">{offer.address}</p>
<p className="mt-3 text-sm text-white/80">{offer.roomName} · {offer.board}</p>
<p className="mt-2 text-sm text-white/60">{offer.query.startDate} 至 {offer.query.endDate} · 1 房 1 成人</p>
<p className="mt-3 text-xl font-semibold text-accent">{money(offer.nightlyAmount ?? offer.amount, offer.currency)} / 晚</p>
<p className="mt-1 text-xs text-white/60">{offer.nights || 1} 晚房价合计：{money(offer.amount, offer.currency)}，另付税费见下方。</p>
<Conditions cancellation={offer.cancellation} taxes={offer.taxes} />
<button type="button" disabled={Boolean(busy) || locked || changed} onClick={() => run("prebook", { offerId: offer.id })} className={`${buttonClass} mt-4`}>选择房型并验价</button>
</article>)}</div>}</section> : null}
  </div>;
}
