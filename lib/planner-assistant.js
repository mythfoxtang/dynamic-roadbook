import { FLIGHT_PORTAL, HOTEL_PORTAL, buildUrl } from "@/lib/travel-portals";
import { ANCHOR_PROMPT_TEMPLATE, buildAnchorPlanningProfile } from "@/lib/anchor-planning-workflow";

const DEFAULT_HOTEL_KEYWORD_MAP = {
  丽江: "丽江古城",
  香格里拉: "独克宗古城",
  德钦: "飞来寺",
  芒康: "芒康县城",
  类乌齐: "类乌齐县城",
  丁青: "丁青县城",
  比如: "比如县城",
  班戈: "班戈县城",
  文布南村: "文布南村",
  措勤: "措勤县城",
  日喀则: "日喀则市区",
  定日: "定日县城",
  乃夏村: "吉隆县乃夏村",
  帕羊: "帕羊镇",
  冈仁波齐: "塔尔钦",
  狮泉河: "狮泉河镇",
  三十里营房: "三十里营房镇",
  喀什: "喀什古城",
  塔县: "塔什库尔干县城",
  库车: "库车市区",
  新源: "那拉提镇",
  特克斯: "特克斯八卦城",
  昭苏: "昭苏县城",
  博乐: "博乐市区",
  乌鲁木齐: "乌鲁木齐市区"
};

function splitList(value) {
  return String(value || "")
    .split(/[、，,\n/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTripDays(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function addDays(dateString, offset) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeKeyword(city) {
  return DEFAULT_HOTEL_KEYWORD_MAP[city] || city;
}

function inferPlanningMode(type) {
  if (type === "semifinished") return "semi_finished";
  if (type === "detailed") return "detailed";
  if (type === "poi-only") return "poi_only";
  return "desire_only";
}

function buildDestinationCandidates(form, activeType) {
  const explicitPlaces = splitList(form.plannedPlaces);
  const mustVisit = splitList(form.mustVisit);
  const optional = splitList(form.optionalPlaces);

  if (explicitPlaces.length) return explicitPlaces;
  if (activeType === "poi-only" && mustVisit.length) return mustVisit;
  if (mustVisit.length) return mustVisit.slice(0, 2);
  if (optional.length) return optional.slice(0, 2);
  return [];
}

function buildHotelQueries({ destinations, startDate, tripDays }) {
  if (!destinations.length || !startDate || tripDays < 1) return [];

  const nights = Math.max(1, tripDays - 1);
  return destinations.slice(0, 2).map((city, index) => {
    const checkIn = addDays(startDate, index === 0 ? 0 : Math.min(index * 2, nights - 1));
    const checkOut = addDays(checkIn, 1);
    const keyword = normalizeKeyword(city);

    return {
      city,
      keyword,
      checkIn,
      checkOut,
      rationale:
        index === 0
          ? "优先探测首个落脚点，判断整条线路的住宿价格带。"
          : "补探第二个候选落脚点，帮助判断是否值得换酒店或改落点。",
      portal: {
        ...HOTEL_PORTAL,
        href: buildUrl(HOTEL_PORTAL.href, {
          cityName: city,
          city,
          checkIn,
          checkOut,
          keyword,
          districtName: keyword
        })
      }
    };
  });
}

function buildFlightQueries({ form, destinations, startDate, tripDays }) {
  if (!form.departureCity || !destinations.length || !startDate) return [];

  const firstDestination = destinations[0];
  const lastDestination = destinations[destinations.length - 1];
  const endDate = addDays(startDate, Math.max(0, tripDays - 1));
  const queries = [
    {
      id: "outbound",
      from: form.departureCity,
      to: firstDestination,
      date: startDate,
      rationale: "去程先锁定出发城到首个落点的可达性和价格带。"
    }
  ];

  if (lastDestination && endDate) {
    queries.push({
      id: "return",
      from: lastDestination,
      to: form.departureCity,
      date: endDate,
      rationale: "返程用于校验整条线路的闭环成本和回程时间。"
    });
  }

  if (destinations.length > 1 && firstDestination !== lastDestination) {
    queries.push(
      {
        id: "reverse_outbound",
        from: form.departureCity,
        to: lastDestination,
        date: startDate,
        rationale: "反向路线去程：用来比较是否应该把路线倒过来走。"
      },
      {
        id: "reverse_return",
        from: firstDestination,
        to: form.departureCity,
        date: endDate,
        rationale: "反向路线返程：和正向返程一起比较总成本与时间。"
      }
    );
  }

  return queries.map((item) => ({
    ...item,
    portal: {
      ...FLIGHT_PORTAL,
      href: buildUrl(FLIGHT_PORTAL.href, {
        dcity: item.from,
        acity: item.to,
        date: item.date,
        tripType: "OW"
      })
    }
  }));
}

function buildConstraints(form) {
  return [
    form.travelers && `同行人：${form.travelers}`,
    form.budget && `预算：${form.budget}`,
    form.transportPreference && `交通偏好：${form.transportPreference}`,
    form.pace && `节奏：${form.pace}`,
    form.hotelFlexibility && `换酒店策略：${form.hotelFlexibility}`,
    form.bookedItems && `已预订项：${form.bookedItems}`,
    form.lockedItems && `不可改动项：${form.lockedItems}`,
    form.constraints && `特殊约束：${form.constraints}`,
    form.helpNeeded && `系统补齐重点：${form.helpNeeded}`
  ].filter(Boolean);
}

function summarizeHotelRisk(hotelSignals) {
  if (!hotelSignals.length) return "酒店价格还未探到，先按路线可行性做骨架。";
  const highRiskCount = hotelSignals.filter((item) => item.risk === "高").length;
  if (highRiskCount === hotelSignals.length) return "当前落脚点住宿价格偏紧，路线应优先减少换酒店次数。";
  if (highRiskCount > 0) return "至少有一个落脚点住宿风险偏高，建议准备备选片区。";
  return "酒店价格带目前可控，可以按现有骨架继续推进。";
}

function summarizeFlightRisk(flightSignals, flightQueries) {
  if (!flightQueries.length) return "补充出发地和日期后，才能生成机票查询任务。";
  if (!flightSignals.length) return "机票还未探到价格，先看搜索任务是否齐全。";
  const highRiskCount = flightSignals.filter((item) => item.risk === "高").length;
  if (highRiskCount) return "至少有一段机票价格偏高，路线闭环成本需要重新看。";
  return "机票价格带初步可控，可以继续看住宿和逐日安排。";
}

function buildFallbackAnalysis({ context, hotelSignals, flightQueries, flightSignals }) {
  const anchorProfile = context.anchorProfile;
  const summaryLines = [
    anchorProfile?.isAnchorDriven
      ? `这次按“锚点明确型旅行者”处理：先锁定 ${anchorProfile.requiredAnchors.join("、") || context.destinations.join(" -> ") || "待补目的地"}，再比较方向、区域簇和住宿落点。`
      : "",
    `这次规划更接近“${context.modeLabel}”场景，当前先按 ${context.destinations.join(" -> ") || "待补目的地"} 搭骨架。`,
    context.constraints.length
      ? `已识别到 ${context.constraints.length} 条显性约束，后续所有住宿和交通查询都应围绕这些条件收缩。`
      : "当前显性约束还不够多，结果先以保守骨架为主。"
  ];

  return {
    summary: summaryLines.join(""),
    routeSuggestions: [
      anchorProfile?.isAnchorDriven
        ? `主约束先按 ${anchorProfile.primaryConstraint} 处理：方向、花期/预约和高海拔递进要先于单纯距离最短。`
        : "",
      context.destinations.length > 1
        ? `先把 ${context.destinations[0]} 作为首晚锚点，再决定是否需要向后段换酒店。`
        : "先确定首晚落脚点，再决定是否扩成多城市串联。",
      summarizeHotelRisk(hotelSignals),
      summarizeFlightRisk(flightSignals, flightQueries)
    ].filter(Boolean),
    nextActions: [
      hotelSignals.length ? "先点开酒店查询链接核对真实价位，再决定是否保留该落点。" : "补充出行日期和目的地列表，才能跑酒店探针。",
      flightQueries.length ? "去程和返程都先看一眼价格带，避免路线成立但机票不成立。" : "补充出发地和日期，才能生成机票查询任务。",
      "确认不可改动项后，再做逐日路线和活动安排。"
    ]
  };
}

export function buildPlannerContext({ activeType, form }) {
  const tripDays = parseTripDays(form.tripDays);
  const destinations = buildDestinationCandidates(form, activeType);
  const mode = inferPlanningMode(activeType);
  const modeLabelMap = {
    semi_finished: "已有想法、未成行程",
    detailed: "已有详细计划",
    poi_only: "只确定想去的地方",
    desire_only: "只有旅行需求、未定目的地"
  };

  const anchorProfile = buildAnchorPlanningProfile({
    activeType,
    form,
    destinations,
    tripDays
  });

  return {
    mode,
    modeLabel: modeLabelMap[mode],
    activeType,
    tripDays,
    destinations,
    anchorProfile,
    constraints: buildConstraints(form),
    hotelQueries: buildHotelQueries({
      destinations,
      startDate: form.startDate,
      tripDays
    }),
    flightQueries: buildFlightQueries({
      form,
      destinations,
      startDate: form.startDate,
      tripDays
    }),
    formSnapshot: {
      departureCity: form.departureCity || "",
      startDate: form.startDate || "",
      travelers: form.travelers || "",
      budget: form.budget || "",
      transportPreference: form.transportPreference || "",
      pace: form.pace || "",
      plannedPlaces: form.plannedPlaces || "",
      mustVisit: form.mustVisit || "",
      optionalPlaces: form.optionalPlaces || "",
      constraints: form.constraints || "",
      bookedItems: form.bookedItems || "",
      lockedItems: form.lockedItems || "",
      sourceContent: form.sourceContent || "",
      helpNeeded: form.helpNeeded || ""
    }
  };
}

export async function generatePlannerAnalysis({ context, hotelSignals, flightQueries, flightSignals, fetchImpl, apiKey, baseUrl, model }) {
  const fallback = buildFallbackAnalysis({ context, hotelSignals, flightQueries, flightSignals });
  if (!apiKey || typeof fetchImpl !== "function") return fallback;

  const payload = {
    model,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `对锚点明确型旅行者优先使用下面的方法论。\n\n${ANCHOR_PROMPT_TEMPLATE}`
      },
      {
        role: "system",
        content:
          "你是自驾与多城市旅行规划助手。你要基于结构化上下文、酒店探针结果和机票探针结果，输出严格 JSON。不要编造不存在的查询结果。JSON 必须包含 summary、routeSuggestions、nextActions，且全部用中文。"
      },
      {
        role: "user",
        content: JSON.stringify({
          planner_context: context,
          hotel_signals: hotelSignals,
          flight_queries: flightQueries,
          flight_signals: flightSignals
        })
      }
    ]
  };

  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(content);

    return {
      summary: String(parsed.summary || fallback.summary),
      routeSuggestions: Array.isArray(parsed.routeSuggestions) ? parsed.routeSuggestions.slice(0, 4) : fallback.routeSuggestions,
      nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions.slice(0, 3) : fallback.nextActions
    };
  } catch {
    return fallback;
  }
}
