"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ANCHOR_DECISION_RULES, ANCHOR_PROMPT_TEMPLATE, ANCHOR_WORKFLOW_STEPS } from "@/lib/anchor-planning-workflow";
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Compass,
  ExternalLink,
  Hotel,
  Lightbulb,
  LoaderCircle,
  MapPinned,
  Plane,
  Route,
  Sparkles,
  Target,
  Telescope,
  Users2
} from "lucide-react";

const USER_TYPES = [
  {
    id: "semifinished",
    kicker: "PRIORITY 01",
    title: "锚点明确，未成完整行程",
    summary: "适合先锁定必去点，再做方向、区域簇、住宿落点和机票可达性判断。",
    icon: Users2,
    accent: "from-[#f0d2a7] via-[#c38a54] to-[#51311e]",
    prompts: ["哪些锚点必须保留？", "主约束是花期、雪山、预约还是高反？", "起终点能不能反过来？", "哪些酒店必须可退？"]
  },
  {
    id: "detailed",
    kicker: "PRIORITY 02",
    title: "已有详细计划，需要落地执行",
    summary: "适合把已有计划拆成住宿、机票和路线补齐任务。",
    icon: ClipboardList,
    accent: "from-[#e9c692] via-[#ce9052] to-[#6a4022]",
    prompts: ["现有计划是什么形式？", "哪几项已经订好？", "哪些内容不能动？", "优先补齐什么？"]
  },
  {
    id: "poi-only",
    kicker: "PRIORITY 03",
    title: "只确定想去的地方",
    summary: "适合围绕一个核心目的地，先确定住宿锚点和串联方式。",
    icon: Target,
    accent: "from-[#bfd7c1] via-[#6f9579] to-[#254032]",
    prompts: ["最想去的地方是哪里？", "大概有几天时间？", "接受周边串联吗？", "更在意风景还是轻松度？"]
  },
  {
    id: "desire-only",
    kicker: "PRIORITY 04",
    title: "只有旅行需求，未定目的地",
    summary: "适合先做方向推荐，不强行跑真实查询。",
    icon: Telescope,
    accent: "from-[#d9d2c5] via-[#8d7a63] to-[#43352b]",
    prompts: ["从哪里出发？", "预算和天数是多少？", "同行人是谁？", "更偏风景还是城市？"]
  }
];

const COMMON_FIELDS = ["出发地", "出行日期", "天数", "同行人", "预算", "交通偏好", "旅行节奏", "特殊约束"];

const PRODUCT_IDEAS = [
  "酒店价格和机票价格都应该前置参与路线决策。",
  "查询结果先结构化，再生成解释和建议。",
  "后面可以继续补火车票、门票和租车探针。"
];

const INITIAL_FORM = {
  departureCity: "",
  startDate: "",
  tripDays: "",
  travelers: "",
  budget: "",
  transportPreference: "",
  pace: "",
  constraints: "",
  plannedPlaces: "",
  mustVisit: "",
  optionalPlaces: "",
  hotelFlexibility: "",
  sourceFormat: "",
  sourceContent: "",
  bookedItems: "",
  lockedItems: "",
  helpNeeded: ""
};

function inputClassName(multiline = false) {
  return `w-full rounded-[20px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#e3b56e]/40 focus:bg-white/8 ${
    multiline ? "min-h-[120px] resize-y leading-7" : ""
  }`;
}

function SectionHeader({ kicker, title, icon: Icon }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.24em] text-white/48">{kicker}</div>
        <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
      </div>
      <div className="rounded-2xl border border-white/12 bg-white/8 p-3 text-white/78">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function FormField({ label, placeholder, value, onChange, multiline = false }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm text-white/74">{label}</div>
      {multiline ? (
        <textarea className={inputClassName(true)} placeholder={placeholder} value={value} onChange={onChange} />
      ) : (
        <input className={inputClassName(false)} placeholder={placeholder} value={value} onChange={onChange} />
      )}
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm text-white/74">{label}</div>
      <select className={inputClassName(false)} value={value} onChange={onChange}>
        <option value="">请选择</option>
        {options.map((option) => (
          <option key={option} value={option} className="bg-[#1a1511]">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildDraftSummary(type, form) {
  if (type === "semifinished") {
    return [
      { label: "目的地骨架", value: form.plannedPlaces || "待填写目的地列表" },
      { label: "旅行节奏", value: form.pace || "待选择节奏" },
      { label: "特殊约束", value: form.constraints || "待补充约束" }
    ];
  }

  if (type === "detailed") {
    return [
      { label: "现有计划形式", value: form.sourceFormat || "待选择导入形式" },
      { label: "不可改动项", value: form.lockedItems || "待补充固定项" },
      { label: "系统补齐重点", value: form.helpNeeded || "待选择重点" }
    ];
  }

  return [
    { label: "出发地", value: form.departureCity || "待填写" },
    { label: "天数", value: form.tripDays || "待填写" },
    { label: "预算", value: form.budget || "待填写" }
  ];
}

function QueryLink({ portal }) {
  if (!portal?.href) return null;

  return (
    <a
      href={portal.href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2.5 text-sm text-white/82 transition hover:bg-white/12"
    >
      {portal.label || "打开查询"}
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}

function PriceCard({ label, value }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/12 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">{label}</div>
      <div className="mt-2 text-lg text-white">{value}</div>
    </div>
  );
}

function PlannerAssistantResult({ data, progressMessage }) {
  const hotelSignals = data?.hotelSignals || [];
  const flightQueries = data?.flightQueries || [];
  const flightSignals = data?.flightSignals || [];

  return (
    <section className="mt-5 grid gap-5 xl:grid-cols-[1.02fr,0.98fr]">
      <article className="panel rounded-[28px] p-5 sm:p-6">
        <SectionHeader kicker="规划结果" title="第一版路线与决策建议" icon={Sparkles} />

        <div className="mt-5 rounded-[24px] border border-[#e3b56e]/18 bg-[#e3b56e]/6 p-4 text-sm leading-7 text-white/78">
          {data?.analysis?.summary || progressMessage || "先提交一版规划信息，我会边探酒店、边探机票、边汇总结果。"}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/44">路线建议</div>
            <div className="mt-3 space-y-2">
              {(data?.analysis?.routeSuggestions || []).length ? (
                data.analysis.routeSuggestions.map((item) => (
                  <div key={item} className="planner-chip rounded-[18px] px-4 py-3 text-sm leading-6 text-white/76">
                    {item}
                  </div>
                ))
              ) : (
                <div className="text-sm text-white/58">等待汇总建议...</div>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/44">下一步动作</div>
            <div className="mt-3 space-y-2">
              {(data?.analysis?.nextActions || []).length ? (
                data.analysis.nextActions.map((item) => (
                  <div key={item} className="planner-chip rounded-[18px] px-4 py-3 text-sm leading-6 text-white/76">
                    {item}
                  </div>
                ))
              ) : (
                <div className="text-sm text-white/58">等待生成执行建议...</div>
              )}
            </div>
          </div>
        </div>
      </article>

      <div className="space-y-5">
        <article className="panel rounded-[28px] p-5 sm:p-6">
          <SectionHeader kicker="酒店查询" title="住宿价格信号" icon={Hotel} />
          <div className="mt-5 space-y-3">
            {hotelSignals.length ? (
              hotelSignals.map((item) => (
                <div key={`${item.city}-${item.checkIn}`} className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-base font-semibold text-white">{item.keyword || item.city}</div>
                      <div className="mt-1 text-sm text-white/58">{`${item.checkIn || "--"} -> ${item.checkOut || "--"}`}</div>
                    </div>
                    <div className={`rounded-full border px-3 py-1.5 text-xs ${
                      item.risk === "高"
                        ? "border-warning/35 bg-warning/10 text-warning"
                        : item.risk === "中"
                          ? "border-accent/30 bg-accent/10 text-accent"
                          : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                    }`}>
                      {`风险 ${item.risk || "--"}`}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <PriceCard label="最低价" value={item.minPrice ? `¥${item.minPrice}` : "--"} />
                    <PriceCard label="参考价" value={item.referencePrice ? `¥${item.referencePrice}` : "--"} />
                    <PriceCard label="样本量" value={item.sampleCount || 0} />
                  </div>

                  <div className="mt-4 text-sm leading-7 text-white/72">{item.reason || item.rationale}</div>
                  <div className="mt-4">
                    <QueryLink portal={item.portal} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/12 bg-white/5 p-4 text-sm leading-7 text-white/68">
                暂无酒店信号。提交规划后，这里会实时长出探针结果。
              </div>
            )}
          </div>
        </article>

        <article className="panel rounded-[28px] p-5 sm:p-6">
          <SectionHeader kicker="机票查询" title="机票价格信号" icon={Plane} />
          <div className="mt-5 space-y-3">
            {flightQueries.length ? (
              flightQueries.map((item) => {
                const signal = flightSignals.find((candidate) => candidate.id === item.id && candidate.date === item.date) || null;

                return (
                  <div key={`${item.id}-${item.date}`} className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-base font-semibold text-white">{`${item.from} -> ${item.to}`}</div>
                        <div className="mt-1 text-sm text-white/58">{item.date || "--"}</div>
                      </div>
                      {signal ? (
                        <div className={`rounded-full border px-3 py-1.5 text-xs ${
                          signal.risk === "高"
                            ? "border-warning/35 bg-warning/10 text-warning"
                            : signal.risk === "中"
                              ? "border-accent/30 bg-accent/10 text-accent"
                              : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                        }`}>
                          {`风险 ${signal.risk || "--"}`}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <PriceCard label="最低价" value={signal?.minPrice ? `¥${signal.minPrice}` : "--"} />
                      <PriceCard label="参考价" value={signal?.referencePrice ? `¥${signal.referencePrice}` : "--"} />
                      <PriceCard label="样本量" value={signal?.sampleCount || 0} />
                    </div>

                    <div className="mt-4 text-sm leading-7 text-white/72">{signal?.reason || item.rationale}</div>
                    <div className="mt-4">
                      <QueryLink portal={item.portal} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/12 bg-white/5 p-4 text-sm leading-7 text-white/68">
                暂无机票查询任务。补充出发地和日期后会自动生成。
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function renderSseEvents(buffer, onEvent) {
  const chunks = buffer.split("\n\n");
  const remainder = chunks.pop() || "";

  for (const chunk of chunks) {
    const line = chunk
      .split("\n")
      .find((item) => item.startsWith("data: "));
    if (!line) continue;
    try {
      onEvent(JSON.parse(line.slice(6)));
    } catch {}
  }

  return remainder;
}

export default function TripPlannerWorkspace() {
  const [activeType, setActiveType] = useState("semifinished");
  const [form, setForm] = useState(INITIAL_FORM);
  const [assistantState, setAssistantState] = useState({
    loading: false,
    data: null,
    error: "",
    progressMessage: ""
  });

  const currentType = useMemo(
    () => USER_TYPES.find((item) => item.id === activeType) || USER_TYPES[0],
    [activeType]
  );

  const summaryItems = useMemo(() => buildDraftSummary(activeType, form), [activeType, form]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function runPlannerAssistant() {
    try {
      setAssistantState({
        loading: true,
        data: null,
        error: "",
        progressMessage: "准备开始..."
      });

      const response = await fetch("/api/planner-assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeType, form })
      });

      if (!response.ok || !response.body) {
        const maybeJson = await response.json().catch(() => ({}));
        throw new Error(maybeJson?.error || "规划助手执行失败");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let latestContext = null;
      let latestHotelSignals = [];
      let latestFlightSignals = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        buffer = renderSseEvents(buffer, (event) => {
          if (event.type === "stage") {
            if (event.context) latestContext = event.context;
            setAssistantState((current) => ({
              ...current,
              progressMessage: event.message || current.progressMessage,
              data:
                current.data ||
                (latestContext
                  ? {
                      context: latestContext,
                      hotelSignals: latestHotelSignals,
                      flightQueries: latestContext.flightQueries || [],
                      flightSignals: latestFlightSignals
                    }
                  : current.data)
            }));
            return;
          }

          if (event.type === "hotel_signal") {
            latestHotelSignals = event.hotelSignals || latestHotelSignals;
            setAssistantState((current) => ({
              ...current,
              data: {
                ...(current.data || {}),
                context: latestContext || current.data?.context || null,
                hotelSignals: latestHotelSignals,
                flightQueries: latestContext?.flightQueries || current.data?.flightQueries || [],
                flightSignals: latestFlightSignals
              }
            }));
            return;
          }

          if (event.type === "flight_signal") {
            latestFlightSignals = event.flightSignals || latestFlightSignals;
            setAssistantState((current) => ({
              ...current,
              data: {
                ...(current.data || {}),
                context: latestContext || current.data?.context || null,
                hotelSignals: latestHotelSignals,
                flightQueries: latestContext?.flightQueries || current.data?.flightQueries || [],
                flightSignals: latestFlightSignals
              }
            }));
            return;
          }

          if (event.type === "result") {
            setAssistantState({
              loading: false,
              data: event.data,
              error: "",
              progressMessage: "已生成完成。"
            });
            return;
          }

          if (event.type === "error") {
            setAssistantState({
              loading: false,
              data: null,
              error: event.error || "规划助手执行失败",
              progressMessage: ""
            });
          }
        });
      }

      setAssistantState((current) => ({
        ...current,
        loading: false
      }));
    } catch (error) {
      setAssistantState({
        loading: false,
        data: null,
        error: error?.message || "规划助手执行失败",
        progressMessage: ""
      });
    }
  }

  function saveDraftTemplate() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "dynamic-roadbook-planner-draft-v1",
      JSON.stringify({
        activeType,
        form,
        savedAt: new Date().toISOString()
      })
    );
  }

  function renderPriorityForm() {
    if (activeType === "semifinished") {
      return (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="出发地" placeholder="例如：上海" value={form.departureCity} onChange={(event) => updateField("departureCity", event.target.value)} />
            <FormField label="出行日期" placeholder="例如：2026-05-01" value={form.startDate} onChange={(event) => updateField("startDate", event.target.value)} />
            <FormField label="天数" placeholder="例如：5 天" value={form.tripDays} onChange={(event) => updateField("tripDays", event.target.value)} />
            <SelectField label="旅行节奏" value={form.pace} onChange={(event) => updateField("pace", event.target.value)} options={["轻松", "均衡", "高密度"]} />
            <FormField label="同行人类型" placeholder="例如：夫妻 + 1 位长者" value={form.travelers} onChange={(event) => updateField("travelers", event.target.value)} />
            <FormField label="预算区间" placeholder="例如：人均 5000 - 7000" value={form.budget} onChange={(event) => updateField("budget", event.target.value)} />
            <SelectField label="交通偏好" value={form.transportPreference} onChange={(event) => updateField("transportPreference", event.target.value)} options={["自驾", "公共交通", "包车", "还没确定"]} />
            <SelectField label="是否接受换酒店" value={form.hotelFlexibility} onChange={(event) => updateField("hotelFlexibility", event.target.value)} options={["尽量不换", "最多换 1 次", "可以灵活换"]} />
          </div>
          <FormField label="已确定目的地列表" placeholder="例如：丽江、泸沽湖、香格里拉" value={form.plannedPlaces} onChange={(event) => updateField("plannedPlaces", event.target.value)} />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="必去点" placeholder="例如：玉龙雪山、白沙古镇" value={form.mustVisit} onChange={(event) => updateField("mustVisit", event.target.value)} multiline />
            <FormField label="可舍弃点" placeholder="例如：如果太赶，可以放弃某个远点" value={form.optionalPlaces} onChange={(event) => updateField("optionalPlaces", event.target.value)} multiline />
          </div>
          <FormField label="特殊约束" placeholder="例如：带老人，不想早起，不想赶路" value={form.constraints} onChange={(event) => updateField("constraints", event.target.value)} multiline />
        </div>
      );
    }

    if (activeType === "detailed") {
      return (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="出发地" placeholder="例如：杭州" value={form.departureCity} onChange={(event) => updateField("departureCity", event.target.value)} />
            <FormField label="出行日期" placeholder="例如：2026-06-10" value={form.startDate} onChange={(event) => updateField("startDate", event.target.value)} />
            <FormField label="天数" placeholder="例如：6 天" value={form.tripDays} onChange={(event) => updateField("tripDays", event.target.value)} />
            <FormField label="同行人类型" placeholder="例如：两大一小" value={form.travelers} onChange={(event) => updateField("travelers", event.target.value)} />
            <SelectField label="现有计划形式" value={form.sourceFormat} onChange={(event) => updateField("sourceFormat", event.target.value)} options={["文字", "表格", "聊天记录", "图片/截图"]} />
            <SelectField label="希望系统补齐什么" value={form.helpNeeded} onChange={(event) => updateField("helpNeeded", event.target.value)} options={["时间安排", "路线优化", "住宿与机票查询", "全部都要"]} />
          </div>
          <FormField label="已有行程内容" placeholder="把已有计划贴进来，后续可以继续扩为真实查询任务" value={form.sourceContent} onChange={(event) => updateField("sourceContent", event.target.value)} multiline />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="已订酒店 / 交通" placeholder="例如：某日已订酒店、某日高铁不可改" value={form.bookedItems} onChange={(event) => updateField("bookedItems", event.target.value)} multiline />
            <FormField label="不可改动项" placeholder="例如：必须去某景点、必须某天到达" value={form.lockedItems} onChange={(event) => updateField("lockedItems", event.target.value)} multiline />
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="出发地" placeholder="例如：上海" value={form.departureCity} onChange={(event) => updateField("departureCity", event.target.value)} />
          <FormField label="出行日期" placeholder="例如：2026-07-01" value={form.startDate} onChange={(event) => updateField("startDate", event.target.value)} />
          <FormField label="天数" placeholder="例如：4 天" value={form.tripDays} onChange={(event) => updateField("tripDays", event.target.value)} />
          <FormField label="预算" placeholder="例如：总预算 8000" value={form.budget} onChange={(event) => updateField("budget", event.target.value)} />
        </div>
        <FormField label="想去的地方 / 关键词" placeholder="例如：阿勒泰、草原、亲子、凉快一点" value={form.mustVisit} onChange={(event) => updateField("mustVisit", event.target.value)} multiline />
        <FormField label="补充说明" placeholder="例如：不想频繁换酒店，希望首尾有飞机" value={form.constraints} onChange={(event) => updateField("constraints", event.target.value)} multiline />
      </div>
    );
  }

  return (
    <main className="planner-shell min-h-screen">
      <div className="mx-auto max-w-[1540px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <section className="planner-hero overflow-hidden rounded-[32px] border border-white/10 px-5 py-6 sm:px-7 lg:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/70">
                <Sparkles className="h-4 w-4 text-[#f3c985]" />
                Trip Planning
              </div>
              <h1 className="mt-5 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
                先分用户入口
                <span className="block text-white/55">再进入不同的规划与查询流程</span>
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70 sm:text-base">
                现在酒店和机票都会先跑一版真实探针，再告诉你路线是否成立，不再只是给搜索链接。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/roadbook" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm text-white/78 transition hover:bg-white/12">
                去看动态路书
                <Route className="h-4 w-4" />
              </Link>
              <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-[#e3b56e]/30 bg-[#e3b56e]/10 px-5 py-3 text-sm text-[#f0cb96] transition hover:bg-[#e3b56e]/14">
                返回模块首页
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.82fr,1.18fr]">
          <article className="panel rounded-[28px] p-5 sm:p-6">
            <SectionHeader kicker="入口选择" title="先选你属于哪一类用户" icon={Compass} />

            <div className="mt-5 space-y-3">
              {USER_TYPES.map((userType) => {
                const Icon = userType.icon;
                const active = userType.id === activeType;

                return (
                  <button
                    key={userType.id}
                    type="button"
                    onClick={() => setActiveType(userType.id)}
                    className={`w-full rounded-[24px] border p-[1px] text-left transition ${
                      active ? "border-[#e3b56e]/40 shadow-[0_18px_48px_rgba(0,0,0,0.22)]" : "border-white/10"
                    }`}
                  >
                    <div className={`rounded-[23px] bg-gradient-to-br ${userType.accent} p-[1px]`}>
                      <div className={`rounded-[22px] px-4 py-4 ${active ? "bg-[#120f0cf0]" : "bg-[#171310eb]"}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.22em] text-white/44">{userType.kicker}</div>
                            <div className="mt-2 text-lg font-semibold text-white">{userType.title}</div>
                            <div className="mt-2 text-sm leading-6 text-white/70">{userType.summary}</div>
                          </div>
                          <div className="rounded-2xl border border-white/12 bg-white/8 p-3 text-white/78">
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-[24px] border border-dashed border-[#e3b56e]/28 bg-[#e3b56e]/6 p-4">
              <div className="text-sm font-medium text-[#f0cb96]">通用基础字段</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {COMMON_FIELDS.map((field) => (
                  <span key={field} className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-xs text-white/72">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </article>

          <article className="panel rounded-[28px] p-5 sm:p-6">
            <SectionHeader kicker="当前流程" title={currentType.title} icon={currentType.icon} />

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
              <div className="space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/44">首轮提问</div>
                  <div className="mt-3 space-y-2">
                    {currentType.prompts.map((prompt) => (
                      <div key={prompt} className="planner-chip rounded-[18px] px-4 py-3 text-sm leading-6 text-white/76">
                        {prompt}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#e3b56e]/18 bg-[#e3b56e]/6 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#f0cb96]">实时摘要</div>
                  <div className="mt-3 space-y-2">
                    {summaryItems.map((item) => (
                      <div key={item.label} className="rounded-[18px] border border-white/10 bg-black/12 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">{item.label}</div>
                        <div className="mt-2 text-sm leading-6 text-white/78">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/44">真实表单</div>
                    <div className="mt-2 text-lg font-semibold text-white">已接通酒店和机票探针</div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">
                    <CheckCircle2 className="h-4 w-4" />
                    可执行
                  </div>
                </div>

                <div className="mt-5">{renderPriorityForm()}</div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={runPlannerAssistant}
                    disabled={assistantState.loading}
                    className="inline-flex items-center gap-2 rounded-full border border-[#e3b56e]/32 bg-[#e3b56e]/12 px-5 py-3 text-sm text-[#f0cb96] transition hover:bg-[#e3b56e]/16 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {assistantState.loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {assistantState.loading ? "正在生成结果" : "生成第一版结果"}
                  </button>
                  <button
                    type="button"
                    onClick={saveDraftTemplate}
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm text-white/78 transition hover:bg-white/10"
                  >
                    保存为草稿模板
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {assistantState.loading ? (
                  <div className="mt-4 rounded-[18px] border border-accent/20 bg-accent/10 px-4 py-4 text-sm leading-7 text-white/80">
                    <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />
                    {assistantState.progressMessage || "正在处理中..."}
                  </div>
                ) : null}

                {assistantState.error ? (
                  <div className="mt-4 rounded-[18px] border border-warning/30 bg-warning/10 px-4 py-4 text-sm leading-7 text-warning">
                    {assistantState.error}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        </section>

        <PlannerAssistantResult data={assistantState.data} progressMessage={assistantState.progressMessage} />

        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr,0.94fr]">
          <article className="panel rounded-[28px] p-5 sm:p-6">
            <SectionHeader kicker="流程设计" title="规划与查询怎么串起来" icon={MapPinned} />
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {ANCHOR_WORKFLOW_STEPS.map((step, index) => (
                <div key={step.title} className="draft-day rounded-[24px] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#f0cb96]/82">{`STEP 0${index + 1}`}</div>
                  <div className="mt-2 text-lg font-semibold text-white">{step.title}</div>
                  <p className="mt-3 text-sm leading-7 text-white/68">{step.text}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="panel rounded-[28px] p-5 sm:p-6">
            <SectionHeader kicker="产品想法" title="下一步值得加的东西" icon={Lightbulb} />
            <div className="mt-5 space-y-3">
              {PRODUCT_IDEAS.map((idea) => (
                <div key={idea} className="planner-chip rounded-[22px] p-4 text-sm leading-7 text-white/76">
                  {idea}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[24px] border border-[#e3b56e]/18 bg-[#e3b56e]/6 p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#f0cb96]">锚点型决策规则</div>
              <div className="mt-3 space-y-2">
                {ANCHOR_DECISION_RULES.slice(0, 4).map((rule) => (
                  <div key={rule} className="rounded-[18px] border border-white/10 bg-black/12 px-4 py-3 text-sm leading-6 text-white/74">
                    {rule}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-[24px] border border-white/10 bg-black/12 p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/44">给大模型的 Prompt 骨架</div>
              <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap text-xs leading-6 text-white/62">{ANCHOR_PROMPT_TEMPLATE}</pre>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
