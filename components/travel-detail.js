"use client";
import { useEffect, useState } from "react";
import { TravelField, TravelSelect } from "./travel-query-form";
import { filterTravelOptions } from "@/lib/travel-filters.mjs";
const price = (n) => n === null || n === undefined ? "未提供数值价格" : `¥${n}`;
export default function TravelDetail({ detail, busy, requirements, onRequirements, onRefresh, onBook, onClose }) {
  const [selected, setSelected] = useState(""), [confirmed, setConfirmed] = useState(false);
  const [contact, setContact] = useState({ contactName: "", contactPhone: "" });
  const [people, setPeople] = useState([]), [now, setNow] = useState(Date.now());
  const [filters, setFilters] = useState({ maxPrice: "", bed: "", breakfast: false, refundable: false, capacity: "", cabin: "", baggage: false });
  useEffect(() => {
    setSelected(""); setConfirmed(false); setFilters({ maxPrice: "", bed: "", breakfast: false, refundable: false, capacity: "", cabin: "", baggage: false }); setContact({ contactName: "", contactPhone: "" });
    setPeople(Array.from({ length: detail.kind === "hotel" ? detail.query.rooms : detail.query.adults + detail.query.children }, (_, i) => ({ name: "", firstName: "", lastName: "", idNumber: "", idType: "身份证", birthday: "", psptEndDate: "", sex: "9", type: i < detail.query.adults ? "成人" : "儿童" })));
    const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer);
  }, [detail.id]);
  const updatePerson = (i, key, value) => setPeople((rows) => rows.map((r, index) => index === i ? { ...r, [key]: value } : r));
  const hotel = detail.kind === "hotel", expired = now >= detail.expiresAt;
  const option = detail.options.find((o) => o.id === selected);
  const options = filterTravelOptions(detail.options, filters, detail.kind);
  const updateFilter = (key, value) => { setFilters((old) => ({ ...old, [key]: value })); setSelected(""); setConfirmed(false); };
  function submit(e) {
    e.preventDefault();
    onBook({ quoteId: detail.id, optionId: selected, ...contact, confirmed, ...(hotel ? { roomGuests: people.map((p) => ({ guests: [{ firstName: p.firstName, lastName: p.lastName }] })) } : { tourists: people }) });
  }
  return <section className="panel rounded-2xl border border-accent/30 p-5 sm:p-6" aria-label="房型或舱位详情">
    <div className="flex flex-wrap items-start justify-between gap-3">
<div>
<h2 className="text-xl font-semibold text-white">{detail.title}</h2>
<p className="mt-2 text-xs text-white/55">官方详情查询于 {new Date(detail.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })} · {expired ? "报价已过期，请重新查询" : "本站将此详情保留 5 分钟用于提交前核对"}</p>
</div>
<button type="button" disabled={busy} onClick={onClose} className="text-sm text-white/65">关闭详情</button>
</div>
    <p className="mt-3 text-sm leading-7 text-accent">{detail.priceNotice}</p>
    {hotel && Object.keys(detail.policies || {}).length ? <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-black/15 p-3 font-sans text-xs leading-6 text-white/65">{JSON.stringify(detail.policies, null, 2)}</pre> : null}
    <div className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="房型舱位筛选">
<TravelField label="详情报价上限" type="number" min="0" name="maxPrice" value={filters.maxPrice} onChange={updateFilter} />
{hotel ? <><TravelSelect label="床型筛选" value={filters.bed} onChange={(v) => updateFilter("bed", v)} options={[["", "所有床型"], ...[...new Set(detail.options.map((o) => o.bed).filter(Boolean))].map((v) => [v, v])]} /><TravelField label="每房最低可住人数" type="number" min="1" name="capacity" value={filters.capacity} onChange={updateFilter} /><label className="text-sm text-white/70"><input type="checkbox" checked={filters.breakfast} onChange={(e) => updateFilter("breakfast", e.target.checked)} /> 明确含早房价</label></> : <><TravelSelect label="舱等筛选" value={filters.cabin} onChange={(v) => updateFilter("cabin", v)} options={[["", "所有舱等"], ...[...new Set(detail.options.map((o) => o.name).filter(Boolean))].map((v) => [v, v])]} /><label className="text-sm text-white/70"><input type="checkbox" checked={filters.baggage} onChange={(e) => updateFilter("baggage", e.target.checked)} /> 明确含免费重量行李</label></>}
<label className="text-sm text-white/70"><input type="checkbox" checked={filters.refundable} onChange={(e) => updateFilter("refundable", e.target.checked)} /> 明确可退／取消</label>
</div><p className="mt-3 text-xs text-white/55">房型／舱位 {options.length}/{detail.options.length} 个，按数值报价从低到高。筛选不产生额外接口请求。</p>
    <div className="mt-4 grid gap-3 md:grid-cols-2">{options.map((o) => <label key={o.id} className={`cursor-pointer rounded-xl border p-4 ${selected === o.id ? "border-accent bg-accent/10" : "border-white/15"}`}>
<div className="flex items-start gap-3">
<input type="radio" name="travel-option" value={o.id} checked={selected === o.id} disabled={busy || expired || o.price === null} onChange={() => { setSelected(o.id); setConfirmed(false); }} className="mt-1" />
<div className="min-w-0">
<p className="font-semibold text-white">{o.name} {o.code || o.plan}</p>
<p className="mt-2 text-lg text-accent">{price(o.price)}</p>{hotel ? <p className="mt-2 text-xs leading-6 text-white/65">{[o.bed, o.area ? `${o.area}㎡` : "", o.floor ? `${o.floor}层` : "", o.capacity !== null ? `最多 ${o.capacity} 人／房` : "", o.stock ? `库存 ${o.stock}` : ""].filter(Boolean).join(" · ") || "房型资料未提供"}</p> : <p className="mt-2 text-xs leading-6 text-white/65">票面 {price(o.fare)} + 税费 {price(o.tax)} · 余票 {o.seats || "未知"}</p>}<p className="mt-2 text-xs leading-6 text-white/70">餐食：{o.meal || "未知"}</p>
<p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-white/70">退改：{o.refund || "供应商未给出明确规则，需核实"}</p>{!hotel ? <>
<p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-white/70">行李：{o.baggage || "未知，不当作含免费托运"}</p>
<p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-white/55">购买条件：{o.conditions || "供应商未注明"}</p>
</> : null}</div>
</div>
</label>)}</div>
    {!detail.options.length ? <p className="mt-4 text-sm text-white/70">供应商未返回可用于预订的具体房型／舱位。不能仅凭列表起价创建订单。</p> : null}
    <button type="button" disabled={busy} onClick={onRefresh} className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm text-white/75">重新查询详情与报价</button>
    {!hotel ? <div className="mt-5">
<button type="button" onClick={onRequirements} disabled={busy} className="rounded-xl border border-accent/30 px-4 py-2 text-sm text-accent">获取官方机票预订须知</button>{requirements ? <details open className="mt-3">
<summary className="cursor-pointer text-sm text-white/70">预订必填资料与官方须知</summary>
<pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-6 text-white/60">{requirements}</pre>
</details> : null}</div> : null}
    {selected ? <form onSubmit={submit} className="mt-5 border-t border-white/10 pt-5">
<h3 className="text-lg font-semibold text-white">{hotel ? "填写入住资料" : "填写乘机人资料"}</h3>
<p className="mt-2 text-xs leading-6 text-white/55">只在你明确提交时发给途牛。本站不把姓名、手机号和证件写入浏览器存储、日志或订单记录。</p>
<fieldset disabled={busy || expired} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
<TravelField label="联系人姓名" name="contactName" required value={contact.contactName} onChange={(k, v) => setContact({ ...contact, [k]: v })} />
<TravelField label="联系人手机号" name="contactPhone" type="tel" required value={contact.contactPhone} onChange={(k, v) => setContact({ ...contact, [k]: v })} />
</div>
      {people.map((p, i) => <div key={i} className="rounded-xl border border-white/10 p-3">
<p className="mb-3 text-xs text-white/60">{hotel ? `第 ${i + 1} 间房的入住代表` : `第 ${i + 1} 位${p.type}`}</p>
<div className="grid gap-3 sm:grid-cols-2">{hotel ? <>
<TravelField label={`第 ${i + 1} 间房入住人姓`} required name="lastName" value={p.lastName} onChange={(k, v) => updatePerson(i, k, v)} />
<TravelField label={`第 ${i + 1} 间房入住人名`} required name="firstName" value={p.firstName} onChange={(k, v) => updatePerson(i, k, v)} />
</> : <>
<TravelField label={`乘机人 ${i + 1} 姓名`} required name="name" value={p.name} onChange={(k, v) => updatePerson(i, k, v)} />
<TravelSelect label={`乘机人 ${i + 1} 证件类型`} value={p.idType} onChange={(v) => updatePerson(i, "idType", v)} options={["身份证", "护照", "港澳居民居住证", "台湾居民居住证", "台胞证", "回乡证", "户口簿", "出生证明", "军人证", "外国人永久居留身份证"].map((v) => [v, v])} />
<TravelField label={`乘机人 ${i + 1} 证件号码`} required name="idNumber" value={p.idNumber} onChange={(k, v) => updatePerson(i, k, v)} maxLength={40} />
{p.idType !== "身份证" ? <>
<TravelField label={`乘机人 ${i + 1} 出生日期`} type="date" required name="birthday" value={p.birthday} onChange={(k, v) => updatePerson(i, k, v)} />
<TravelField label={`乘机人 ${i + 1} 证件有效期`} type="date" required name="psptEndDate" value={p.psptEndDate} onChange={(k, v) => updatePerson(i, k, v)} />
<TravelSelect label={`乘机人 ${i + 1} 证件性别`} value={p.sex} onChange={(v) => updatePerson(i, "sex", v)} options={[["9", "未说明"], ["1", "男"], ["0", "女"]]} />
</> : null}
</>}</div>
</div>)}
      <label className="flex items-start gap-3 text-sm leading-7 text-white/75">
<input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-2" />我已核对当前报价、人数、日期、房型／舱位和退改，已阅读官方必填资料，确认创建真实的未支付订单。最终付款将在途牛官方订单页完成。</label>
      <p className="text-xs leading-6 text-white/55">此动作可能创建真实订单。本站不自动付款，不把创建订单视为已支付、已出票或酒店已确认。婴儿票及证件相关特殊规则须另行核实。</p>
      <button disabled={!confirmed || !option || option.price === null || (!hotel && !requirements)} className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-[#181410] disabled:opacity-40">确认创建未支付订单</button>
    </fieldset>
</form> : null}
  </section>;
}
