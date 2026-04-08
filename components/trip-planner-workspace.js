"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Compass,
  LoaderCircle,
  Hotel,
  Lightbulb,
  MapPinned,
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
    title: "已有想法，未成行程",
    summary: "知道想去哪几个地方、玩几天，也有偏好和限制，但还没有排出完整路线。",
    cta: "一起生成草案",
    fit: "最核心、最值得优先上线的人群",
    icon: Users2,
    accent: "from-[#f0d2a7] via-[#c38a54] to-[#51311e]",
    prompts: [
      "你已经确定想去哪些地方？",
      "一共计划玩几天？",
      "这次更偏轻松、均衡还是高密度？",
      "有没有特殊约束，比如老人、小孩、不自驾、少换酒店？"
    ],
    fields: ["已确定目的地列表", "必去点", "可舍弃点", "是否接受换酒店"],
    outcome: "系统先定骨架，再给逐日 V1 草案，用户对局部反馈后继续重排。"
  },
  {
    id: "detailed",
    kicker: "PRIORITY 02",
    title: "已有详细计划",
    summary: "已经整理了城市、日期、酒店或景点顺序，只差落成真正可执行的时间轴和路书。",
    cta: "导入我的计划",
    fit: "适合已经做完大部分规划的人",
    icon: ClipboardList,
    accent: "from-[#e9c692] via-[#ce9052] to-[#6a4022]",
    prompts: [
      "你的行程现在是什么形式：文字、表格、聊天记录还是图片？",
      "这次旅行一共几天，出发日期是什么？",
      "你最希望系统补齐什么：时间安排、路线优化还是执行路书？"
    ],
    fields: ["已有行程内容", "已订酒店/交通", "不可改动项", "希望系统补齐的内容"],
    outcome: "导入内容后，系统自动识别日期、地点和住宿，再补时间轴并生成动态路书。"
  },
  {
    id: "poi-only",
    kicker: "PRIORITY 03",
    title: "只确定想去的地方",
    summary: "只锁定了一个景点或目的地，还不知道玩几天、住哪里、是否需要串联周边。",
    cta: "围绕目的地规划",
    fit: "适合单点兴趣非常强的人",
    icon: Target,
    accent: "from-[#bfd7c1] via-[#6f9579] to-[#254032]",
    prompts: [
      "你最想去的地方是哪里？",
      "这次大概有几天时间？",
      "你想深度玩一个地方，还是顺带串联周边？",
      "你更在意风景、人文、美食还是轻松度？"
    ],
    fields: ["核心目的地", "是否接受周边联动", "希望玩法类型", "可接受移动强度"],
    outcome: "系统先给 2 到 3 种玩法方向，再把选中的方向展开成具体行程。"
  },
  {
    id: "desire-only",
    kicker: "PRIORITY 04",
    title: "只有旅行需求，未定目的地",
    summary: "只有预算、天数和旅行愿望，比如想休息、想带爸妈出去，但还没决定去哪。",
    cta: "帮我推荐方向",
    fit: "最前置，也最需要推荐能力的人群",
    icon: Telescope,
    accent: "from-[#d9d2c5] via-[#8d7a63] to-[#43352b]",
    prompts: [
      "你从哪里出发，什么时候出行？",
      "预算大概多少，计划几天？",
      "同行人是谁：情侣、家庭、亲子还是带长者？",
      "你更想要休息放松、风景体验、城市漫游还是深度旅行？"
    ],
    fields: ["旅行动机", "气候偏好", "是否出境", "风格偏好"],
    outcome: "系统先做目的地匹配，再把用户带进后续的行程骨架生成流程。"
  }
];

const COMMON_FIELDS = ["出发地", "出行日期", "天数", "同行人类型", "预算区间", "交通偏好", "旅行节奏", "特殊约束"];

const PRODUCT_IDEAS = [
  "先按规划成熟度分流，再进入对应表单，不要让所有人都填同一张表。",
  "酒店价格不是纯执行问题，而是路线是否成立的决策变量。",
  "行程规划阶段先做住宿价格感知，路书阶段再做正式预订执行。",
  "先做区域级价格带和风险提示，后面再接真实酒店比价接口。"
];

const FLOW_STEPS = [
  {
    title: "先选入口类型",
    text: "让用户先告诉系统自己处在哪个规划阶段，减少无效提问。"
  },
  {
    title: "进入对应表单",
    text: "优先级 1 和 2 直接给真实表单，先收集能够驱动生成的核心字段。"
  },
  {
    title: "加价格感知",
    text: "在路线还没完全落地前，让住宿价格先参与决策，避免方案生成后才发现根本住不起。"
  }
];

const HOTEL_SIGNAL_CARDS = [
  {
    anchor: "丽江古城",
    band: "￥500 - 800 / 晚",
    risk: "中",
    note: "景观和氛围强，但旺季和节假日容易上浮。"
  },
  {
    anchor: "束河",
    band: "￥350 - 600 / 晚",
    risk: "低",
    note: "更安静，停车更方便，适合自驾和带长者。"
  },
  {
    anchor: "白沙",
    band: "￥600 - 1000 / 晚",
    risk: "高",
    note: "风格强但库存少，容易因为可订性影响路线。"
  }
];

const HOTEL_IMPACT_RULES = [
  "如果某住宿锚点价格显著偏高，系统应自动提示替代片区，而不是等用户自己发现。",
  "如果某地库存紧张，系统应提醒用户尽快锁定，或者建议减少停留晚数。",
  "如果某片区价格便宜但次日出发效率更高，它应该优先进入骨架方案。"
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
      { label: "行程节奏", value: form.pace || "待选择节奏" },
      { label: "关键约束", value: form.constraints || "待补充约束条件" }
    ];
  }

  if (type === "detailed") {
    return [
      { label: "现有计划形式", value: form.sourceFormat || "待选择导入形式" },
      { label: "不可改动项", value: form.lockedItems || "待补充固定项" },
      { label: "系统重点任务", value: form.helpNeeded || "待选择系统补齐方向" }
    ];
  }

  return [];
}

function HotelCostAwarenessPanel() {
  const [probeState, setProbeState] = useState({
    loading: false,
    data: null,
    error: ""
  });

  async function runProbe() {
    try {
      setProbeState({ loading: true, data: null, error: "" });
      const response = await fetch("/api/hotel-price-probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: "丽江",
          keyword: "丽江古城",
          checkIn: "2026-06-28",
          checkOut: "2026-06-29"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "探针失败");
      }

      setProbeState({ loading: false, data, error: "" });
    } catch (error) {
      setProbeState({ loading: false, data: null, error: error?.message || "探针失败" });
    }
  }

  return (
    <section className="panel rounded-[28px] p-5 sm:p-6">
      <SectionHeader kicker="住宿成本感知" title="让酒店价格先参与路线决策" icon={Hotel} />

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/44">为什么要放在规划里</div>
            <div className="mt-3 text-sm leading-7 text-white/72">
              很多时候用户不是先定路线、后看酒店，而是酒店价格和满意度本身就决定某个锚点值不值得住。系统如果不在规划阶段感知价格，生成的方案就会缺少一个关键约束。
            </div>
          </div>

          <div className="rounded-[24px] border border-dashed border-[#e3b56e]/28 bg-[#e3b56e]/6 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#f0cb96]">真实探针</div>
            <div className="mt-2 text-sm leading-7 text-white/72">
              这里已经接上本地酒店价格探针。点击后会调用本机 Playwright 自动搜索携程酒店，并回传价格摘要。
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={runProbe}
                disabled={probeState.loading}
                className="inline-flex items-center gap-2 rounded-full border border-[#e3b56e]/32 bg-[#e3b56e]/12 px-5 py-3 text-sm text-[#f0cb96] transition hover:bg-[#e3b56e]/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {probeState.loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                试跑丽江古城酒店探针
              </button>
            </div>

            {probeState.error ? (
              <div className="mt-4 rounded-[18px] border border-warning/30 bg-warning/10 px-4 py-4 text-sm leading-7 text-warning">
                {probeState.error}
              </div>
            ) : null}

            {probeState.data ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[18px] border border-white/10 bg-black/12 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">最低价</div>
                  <div className="mt-2 text-lg text-white">{probeState.data.minPrice ? `￥${probeState.data.minPrice}` : "--"}</div>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-black/12 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">参考价</div>
                  <div className="mt-2 text-lg text-white">{probeState.data.referencePrice ? `￥${probeState.data.referencePrice}` : "--"}</div>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-black/12 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">样本量</div>
                  <div className="mt-2 text-lg text-white">{probeState.data.sampleCount || 0}</div>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-black/12 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">风险</div>
                  <div className="mt-2 text-lg text-white">{probeState.data.risk || "--"}</div>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-black/12 px-4 py-3 md:col-span-2">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">探针结论</div>
                  <div className="mt-2 text-sm leading-7 text-white/78">{probeState.data.reason || "--"}</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/44">原型输出</div>
            <div className="mt-3 space-y-3">
              {HOTEL_SIGNAL_CARDS.map((item) => (
                <div key={item.anchor} className="draft-day rounded-[22px] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-base font-semibold text-white">{item.anchor}</div>
                      <div className="mt-1 text-sm text-white/58">{item.note}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs text-white/72">{item.band}</span>
                      <span className={`rounded-full border px-3 py-1.5 text-xs ${item.risk === "高" ? "border-warning/35 bg-warning/10 text-warning" : item.risk === "中" ? "border-accent/30 bg-accent/10 text-accent" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"}`}>
                        {`风险 ${item.risk}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/44">对路线的影响</div>
            <div className="mt-3 space-y-2">
              {HOTEL_IMPACT_RULES.map((rule) => (
                <div key={rule} className="planner-chip rounded-[18px] px-4 py-3 text-sm leading-6 text-white/76">
                  {rule}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-dashed border-[#e3b56e]/28 bg-[#e3b56e]/6 p-4">
            <div className="text-sm font-medium text-[#f0cb96]">后续接法</div>
            <p className="mt-2 text-sm leading-7 text-white/68">
              第一阶段先做区域级价格带、风险等级和替代片区建议。第二阶段再接真实酒店搜索和价格接口，让酒店价格真正参与行程骨架打分。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function TripPlannerWorkspace() {
  const [activeType, setActiveType] = useState("semifinished");
  const [form, setForm] = useState(INITIAL_FORM);

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

  function renderPriorityForm() {
    if (activeType === "semifinished") {
      return (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="出发地" placeholder="例如：上海" value={form.departureCity} onChange={(event) => updateField("departureCity", event.target.value)} />
            <FormField label="出行日期" placeholder="例如：2026-05-01" value={form.startDate} onChange={(event) => updateField("startDate", event.target.value)} />
            <FormField label="天数" placeholder="例如：6 天 5 晚" value={form.tripDays} onChange={(event) => updateField("tripDays", event.target.value)} />
            <SelectField label="旅行节奏" value={form.pace} onChange={(event) => updateField("pace", event.target.value)} options={["轻松", "均衡", "高密度"]} />
            <FormField label="同行人类型" placeholder="例如：夫妻 + 1 位长者" value={form.travelers} onChange={(event) => updateField("travelers", event.target.value)} />
            <FormField label="预算区间" placeholder="例如：人均 5000 - 7000" value={form.budget} onChange={(event) => updateField("budget", event.target.value)} />
            <SelectField label="交通偏好" value={form.transportPreference} onChange={(event) => updateField("transportPreference", event.target.value)} options={["自驾", "公共交通", "包车", "还没确定"]} />
            <SelectField label="是否接受换酒店" value={form.hotelFlexibility} onChange={(event) => updateField("hotelFlexibility", event.target.value)} options={["尽量不换", "最多换 1 次", "可以灵活换"]} />
          </div>

          <FormField label="已确定目的地列表" placeholder="例如：丽江、泸沽湖、香格里拉" value={form.plannedPlaces} onChange={(event) => updateField("plannedPlaces", event.target.value)} />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="必去点" placeholder="例如：玉龙雪山、白沙古镇" value={form.mustVisit} onChange={(event) => updateField("mustVisit", event.target.value)} multiline />
            <FormField label="可舍弃点" placeholder="例如：如果太赶，可以不去虎跳峡" value={form.optionalPlaces} onChange={(event) => updateField("optionalPlaces", event.target.value)} multiline />
          </div>
          <FormField label="特殊约束" placeholder="例如：带老人，不早起，不自驾，不想赶路" value={form.constraints} onChange={(event) => updateField("constraints", event.target.value)} multiline />
        </div>
      );
    }

    if (activeType === "detailed") {
      return (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="出发地" placeholder="例如：杭州" value={form.departureCity} onChange={(event) => updateField("departureCity", event.target.value)} />
            <FormField label="出行日期" placeholder="例如：2026-06-10" value={form.startDate} onChange={(event) => updateField("startDate", event.target.value)} />
            <FormField label="天数" placeholder="例如：8 天" value={form.tripDays} onChange={(event) => updateField("tripDays", event.target.value)} />
            <FormField label="同行人类型" placeholder="例如：两大一小" value={form.travelers} onChange={(event) => updateField("travelers", event.target.value)} />
            <SelectField label="现有计划形式" value={form.sourceFormat} onChange={(event) => updateField("sourceFormat", event.target.value)} options={["文字", "表格", "聊天记录", "图片/截图"]} />
            <SelectField label="希望系统补齐什么" value={form.helpNeeded} onChange={(event) => updateField("helpNeeded", event.target.value)} options={["时间安排", "路线优化", "执行路书", "全部都要"]} />
          </div>

          <FormField label="已有行程内容" placeholder="把已有的计划贴进来，后续可以接粘贴解析或文件导入" value={form.sourceContent} onChange={(event) => updateField("sourceContent", event.target.value)} multiline />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="已订酒店 / 交通" placeholder="例如：6 月 10 日入住松赞，6 月 12 日高铁不可改" value={form.bookedItems} onChange={(event) => updateField("bookedItems", event.target.value)} multiline />
            <FormField label="不可改动项" placeholder="例如：必须去某景点，必须在某天抵达" value={form.lockedItems} onChange={(event) => updateField("lockedItems", event.target.value)} multiline />
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-[24px] border border-dashed border-white/12 bg-white/5 p-5 text-sm leading-7 text-white/68">
        这两类先保留结构展示，等优先级 1 和 2 跑通后，再继续做真实表单和结果页。
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
                <span className="block text-white/55">再进入不同的规划流程</span>
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70 sm:text-base">
                这一版把“住宿成本感知”正式加到行程规划阶段。目的不是在这里完成下单，而是让酒店价格、库存和片区选择先参与路线决策。
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

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="text-sm text-[#f0cb96]">{userType.fit}</div>
                          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs ${active ? "bg-[#e3b56e]/14 text-[#f0cb96]" : "bg-white/8 text-white/72"}`}>
                            {userType.cta}
                            <ChevronRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-[24px] border border-dashed border-[#e3b56e]/28 bg-[#e3b56e]/6 p-4">
              <div className="text-sm font-medium text-[#f0cb96]">当前优先顺序</div>
              <p className="mt-2 text-sm leading-7 text-white/68">
                先做 `已有想法，未成行程`，再做 `已有详细计划`。这两条链路离动态路书最近，也最容易形成从规划到执行的闭环。
              </p>
            </div>

            <div className="mt-5">
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/48">通用基础字段</div>
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
            <SectionHeader kicker="当前子流程" title={currentType.title} icon={currentType.icon} />

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

                <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/44">补充字段</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {currentType.fields.map((field) => (
                      <span key={field} className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs text-white/72">
                        {field}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 rounded-[18px] border border-dashed border-white/12 bg-black/12 px-4 py-4 text-sm leading-7 text-white/68">
                    {currentType.outcome}
                  </div>
                </div>

                {summaryItems.length ? (
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
                ) : null}
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/44">真实表单</div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {activeType === "semifinished" || activeType === "detailed" ? "已接可填写字段" : "后续待接"}
                    </div>
                  </div>
                  {(activeType === "semifinished" || activeType === "detailed") && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">
                      <CheckCircle2 className="h-4 w-4" />
                      已做表单
                    </div>
                  )}
                </div>

                <div className="mt-5">{renderPriorityForm()}</div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" className="inline-flex items-center gap-2 rounded-full border border-[#e3b56e]/32 bg-[#e3b56e]/12 px-5 py-3 text-sm text-[#f0cb96] transition hover:bg-[#e3b56e]/16">
                    生成第一版结果
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button type="button" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm text-white/78 transition hover:bg-white/10">
                    保存为草稿模板
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>

        <div className="mt-5">
          <HotelCostAwarenessPanel />
        </div>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr,0.94fr]">
          <article className="panel rounded-[28px] p-5 sm:p-6">
            <SectionHeader kicker="流程设计" title="产品流程怎么继续往下接" icon={MapPinned} />

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {FLOW_STEPS.map((step, index) => (
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

            <div className="mt-5 rounded-[24px] border border-dashed border-[#e3b56e]/28 bg-[#e3b56e]/6 p-4">
              <div className="text-sm font-medium text-[#f0cb96]">最顺手的下一步</div>
              <p className="mt-2 text-sm leading-7 text-white/68">
                下一步可以把“住宿成本感知”接成真实接口前的假数据结果页，再逐步替换成酒店价格查询能力，让酒店价格真正参与行程打分和锚点选择。
              </p>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
