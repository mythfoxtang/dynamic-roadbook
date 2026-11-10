"use client";
import { TrainQueryForm } from './travel-train';
export const travelInput = "mt-2 w-full min-w-0 rounded-xl border border-white/15 bg-black/20 px-3 py-3 text-sm text-white outline-none focus:border-accent [color-scheme:dark]";
export function TravelField({ label, name, value, onChange, type = "text", ...props }) {
  return <label className="block min-w-0 text-sm text-white/70">{label}<input aria-label={label} name={name} value={value ?? ""} onChange={(e) => onChange(name, e.target.value)} type={type} className={travelInput} {...props} /></label>;
}
export function TravelSelect({ label, value, onChange, options, disabled }) {
  return <label className="block min-w-0 text-sm text-white/70">{label}<select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={travelInput}>{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>;
}
export default function TravelQueryForm({ query, setQuery, busy, onSearch, onRefresh, hasResults }) {
  if(query.kind==='train') return <TrainQueryForm {...{query,setQuery,busy,onSearch,onRefresh,hasResults}}/>;
  const update = (field, value) => setQuery({ ...query, [field]: value });
  const hotel = query.kind === "hotel";
  return <form onSubmit={(e) => { e.preventDefault(); onSearch(); }} className="panel rounded-2xl p-5">
    <h2 className="text-xl font-semibold text-white">{hotel ? "国内住宿查询" : "国内航班查询"}</h2>
    <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {hotel ? <><TravelField label="城市或县名" name="city" value={query.city} onChange={update} required maxLength={100} /><TravelField label="入住日期" name="startDate" type="date" value={query.startDate} onChange={update} required /><TravelField label="离店日期" name="endDate" type="date" value={query.endDate} onChange={update} required /><TravelField label="房间数" name="rooms" value={query.rooms} onChange={update} type="number" min="1" max="7" required /><TravelField label="酒店或品牌关键词" name="keyword" value={query.keyword} onChange={update} placeholder="如：汉庭、如家、客栈" maxLength={100} /><TravelField label="地点周边（官方约 4 公里）" name="poi" value={query.poi} onChange={update} placeholder="景点、车站或具体地点" maxLength={100} /></>
      : <><TravelField label="出发城市" name="from" value={query.from} onChange={update} required /><TravelField label="到达城市" name="to" value={query.to} onChange={update} required /><TravelField label="出发日期" name="date" value={query.date} onChange={update} type="date" required /><TravelSelect label="查询模式" value={query.mode} onChange={(v) => update("mode", v)} options={[["LOWEST", "默认低价"], ["TIME", "起降时间范围"], ["PRICE", "票面价格区间"], ["NEAR_GO", "周边机场出发"], ["NEAR_BACK", "周边机场到达"], ["TRANSFER", "中转航班"]]} />{query.mode === "TIME" ? <><TravelField label="出发时间范围" name="departureTime" value={query.departureTime} onChange={update} placeholder="06:00-12:00" /><TravelField label="到达时间范围" name="arrivalTime" value={query.arrivalTime} onChange={update} placeholder="12:00-22:00" /></> : null}</>}
      <TravelField label="成人数" name="adults" value={query.adults} onChange={update} type="number" min="1" max="9" required /><TravelField label="儿童数" name="children" value={query.children} onChange={update} type="number" min="0" max="8" required />
      {hotel && Number(query.children) > 0 ? <TravelField label="儿童年龄（逗号分隔）" name="childAges" value={query.childAges} onChange={update} placeholder="如：5,8" required /> : null}
      <TravelField label={hotel ? "人民币起价下限" : "票面价格下限（元）"} name="minPrice" value={query.minPrice} onChange={update} type="number" min="0" max="100000" step="0.01" placeholder="不限" />
      <TravelField label={hotel ? "人民币起价上限" : "票面价格上限（元）"} name="maxPrice" value={query.maxPrice} onChange={update} type="number" min="0" max="100000" step="0.01" placeholder="留空不限" />
    </fieldset>
    <p className="mt-4 text-xs leading-6 text-white/55">{hotel ? "优先预算 200–300 元／间／晚，不按星级排除民宿或未标星住宿。搜索起价的口径以房型详情为准；总价与多晚金额必须进一步验价。" : "机票搜索先返回成人参考报价；儿童票价、多人数库存和最终费用需展开舱位并由官方确认。当前表单不含婴儿票与往返联程，可分别查询两个方向。"}</p>
    <div className="mt-4 flex flex-wrap items-center gap-3"><button disabled={busy} className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-[#181410] disabled:opacity-50">{busy ? "请求处理中…" : hotel ? "查询国内住宿" : "查询国内机票"}</button>{hasResults ? <button type="button" onClick={onRefresh} disabled={busy} className="rounded-xl border border-white/20 px-4 py-3 text-sm text-white/75 disabled:opacity-50">强制刷新价格</button> : null}<span className="text-xs text-white/50">相同条件 2 分钟内使用缓存；本地筛选不消耗供应商额度。</span></div>
  </form>;
}
