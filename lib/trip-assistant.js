import { ROADBOOK_DAYS } from "@/lib/roadtrip-data";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function collectProtectedNames(note, stops) {
  const text = String(note || "");
  return safeArray(stops)
    .map((stop) => (typeof stop === "string" ? stop : stop?.name || ""))
    .filter(Boolean)
    .filter((name) => text.includes(name));
}

function stopName(stop) {
  return typeof stop === "string" ? stop : stop?.name || "未命名地点";
}

function stopDuration(stop, fallback = 45) {
  return typeof stop === "object" && typeof stop?.durationMinutes === "number" ? stop.durationMinutes : fallback;
}

function buildDropOperation(stop, index, reason) {
  return {
    type: "drop_stop",
    index,
    name: stopName(stop),
    reason
  };
}

function buildShortenOperation(stop, index, minutes, reason) {
  return {
    type: "shorten_stop",
    index,
    name: stopName(stop),
    toDurationMinutes: minutes,
    reason
  };
}

function applyOperationsToStops(stops, operations) {
  let next = safeArray(stops).map((stop) => (typeof stop === "string" ? { name: stop } : { ...stop }));

  for (const operation of operations.filter((item) => item.type === "shorten_stop")) {
    next = next.map((stop, index) =>
      index === operation.index
        ? {
            ...stop,
            durationMinutes: operation.toDurationMinutes
          }
        : stop
    );
  }

  for (const operation of operations.filter((item) => item.type === "drop_stop")) {
    if (operation.type === "drop_stop") {
      next = next.filter((_, index) => index !== operation.index);
    }
  }

  return next;
}

function buildReplanResult(context, note) {
  const rawStops = safeArray(context?.stops);
  if (rawStops.length < 2) {
    return {
      reply: "当前当天停靠点不足，没必要再重排。先补齐当天计划后再调整。",
      patch: null
    };
  }

  const protectedNames = collectProtectedNames(note, rawStops);
  const routeDistance = Number(context?.routeMetrics?.distanceKm || 0);
  const routeHours = Number(context?.routeMetrics?.durationHours || 0);
  const fatigue = Number(context?.fatigue || 0);
  const shouldAggressivelyTrim = routeDistance >= 500 || routeHours >= 8 || fatigue >= 7;

  const operations = [];
  const firstIndex = 0;
  const lastIndex = rawStops.length - 1;
  const mutableStops = rawStops
    .map((stop, index) => ({ stop, index }))
    .filter(({ index, stop }) => index !== firstIndex && index !== lastIndex && !protectedNames.includes(stopName(stop)));

  if (shouldAggressivelyTrim && mutableStops.length) {
    const removable = mutableStops[mutableStops.length - 1];
    operations.push(
      buildDropOperation(
        removable.stop,
        removable.index,
        "当天驾驶时长或疲劳指数偏高，优先删除靠后的弹性停靠点。"
      )
    );
  }

  for (const { stop, index } of mutableStops.slice(0, shouldAggressivelyTrim ? 2 : 1)) {
    const duration = stopDuration(stop);
    if (duration > 40) {
      operations.push(
        buildShortenOperation(
          stop,
          index,
          Math.max(25, Math.min(40, duration - 20)),
          "压缩停留时长，给后续行驶和落地留缓冲。"
        )
      );
    }
  }

  if (!operations.length) {
    return {
      reply: "我看了当天路线，当前更适合维持现有停靠点，只需要控制停留节奏，不建议硬删点。",
      patch: null
    };
  }

  const updatedStops = applyOperationsToStops(rawStops, operations);
  const replyLines = [
    "我按当天实际强度做了一版保守重排。",
    ...operations.map((operation) =>
      operation.type === "drop_stop"
        ? `删除 ${operation.name}，原因是 ${operation.reason}`
        : `把 ${operation.name} 的停留压缩到 ${operation.toDurationMinutes} 分钟，原因是 ${operation.reason}`
    ),
    "如果你确认，可以直接应用到当天路线。"
  ];

  return {
    reply: replyLines.join("\n"),
    patch: {
      dayId: context?.dayId || "",
      kind: "replace_stops",
      updatedStops,
      operations
    }
  };
}

function buildSummaryResult(context) {
  const stops = safeArray(context?.activeStops).map((item) => `${item.name}${item.durationMinutes ? ` ${item.durationMinutes}分钟` : ""}`);
  const photoCount = safeArray(context?.photos).length;
  const lines = [
    `今天是 Day ${context?.day || "--"}，主线为 ${context?.title || "当天路线"}。`,
    stops.length ? `停靠点依次是：${stops.join("、")}。` : "当天还没有明确的停靠点记录。",
    context?.routeMetrics ? `预计驾驶 ${context.routeMetrics.distanceKm} km / ${context.routeMetrics.durationHours} h。` : "",
    photoCount ? `已记录 ${photoCount} 条照片摘要，可以据此补写回顾。` : "目前还没有照片摘要。"
  ].filter(Boolean);

  return { reply: lines.join("\n"), patch: null };
}

function buildFamilyResult(context) {
  const firstStop = context?.activeStops?.[0]?.name || "当天起点";
  const lastStop = context?.activeStops?.[context.activeStops.length - 1]?.name || "当天终点";
  return {
    reply: `今天从 ${firstStop} 走到 ${lastStop}，整体还顺利。路线和时间都在可控范围内，晚上会按计划落脚，先报个平安。`,
    patch: null
  };
}

function buildPhotosResult(context) {
  const photos = safeArray(context?.photos);
  if (!photos.length) {
    return {
      reply: "今天还没有照片摘要，先把照片按停靠点分组，后面我再帮你补标题和备注。",
      patch: null
    };
  }

  const lines = photos.slice(0, 5).map((item, index) => `${index + 1}. ${item.spotName || item.fileName || "未命名照片"}：建议保留，标题可写“${item.spotName || "当天片段"}”。`);
  return { reply: lines.join("\n"), patch: null };
}

function buildRiskResult(context) {
  const distance = Number(context?.routeMetrics?.distanceKm || 0);
  const duration = Number(context?.routeMetrics?.durationHours || 0);
  const issues = [];
  if (distance >= 500) issues.push("里程偏长");
  if (duration >= 8) issues.push("驾驶时间偏长");
  if (Number(context?.fatigue || 0) >= 7) issues.push("疲劳指数偏高");

  return {
    reply: issues.length
      ? `今天后半程的主要风险是：${issues.join("、")}。建议减少临时加点，把落脚时间往前收。`
      : "今天后半程风险还算可控，重点是别再额外加点，按现有节奏走完即可。",
    patch: null
  };
}

function compactStopName(stop) {
  return typeof stop === "string" ? stop : stop?.name || "";
}

function buildRouteAuditContext(activeContext) {
  return ROADBOOK_DAYS.map((day) => ({
    day: day.day,
    date: day.date,
    title: day.title,
    routeText: day.routeText,
    stops: safeArray(day.stops).map(compactStopName).filter(Boolean),
    distanceKm: day.distance || 0,
    durationHours: day.hours || 0,
    isActive: day.id === activeContext?.dayId
  }));
}

function actionInstruction(actionId) {
  const map = {
    replan: "重点做当天路线重排。先审查前后两天衔接、起终点一致性、地图可检索性、当天里程和落脚点是否现实，再决定是否给出可应用的 updatedStops。",
    summary: "生成当天总结，但必须先指出路线中任何明显不连续、不可检索或执行风险；没有问题再总结。",
    family: "生成适合发给家人的报平安消息，语气自然，不夸大安全性；如当天高风险，要温和提醒会控制节奏。",
    photos: "根据照片和停靠点给整理建议，优先保留能证明路线节点和关键风景的照片。",
    risk: "做风险提醒。必须覆盖里程、驾驶时长、海拔、落脚点、前后日衔接和地图检索稳定性。"
  };
  return map[actionId] || "分析当天行程并给出可执行建议。";
}

function normalizeAssistantPatch(parsed, context) {
  const patch = parsed?.patch;
  if (!patch || patch.kind !== "replace_stops" || !Array.isArray(patch.updatedStops)) return null;

  const updatedStops = patch.updatedStops
    .map((stop) => {
      if (typeof stop === "string") return { name: stop };
      if (!stop || typeof stop !== "object") return null;
      const name = String(stop.name || "").trim();
      if (!name) return null;
      return {
        ...stop,
        name,
        durationMinutes: typeof stop.durationMinutes === "number" ? stop.durationMinutes : undefined
      };
    })
    .filter(Boolean);

  if (updatedStops.length < 2) return null;
  return {
    dayId: context?.dayId || patch.dayId || "",
    kind: "replace_stops",
    updatedStops,
    operations: Array.isArray(patch.operations) ? patch.operations.slice(0, 8) : []
  };
}

export async function generateTripAssistantAction({ actionId, context, note, fetchImpl, apiKey, baseUrl, model }) {
  if (!apiKey) {
    throw new Error("尚未配置 AI，请先在 DeepSeek API 配置中填写密钥。");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("当前运行环境不支持模型请求。");
  }

  const fallback = runTripAssistantAction({ actionId, context, note });
  const payload = {
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "你是真正的长线自驾路书审查与执行助手，不是聊天装饰。",
          "回答前必须先审查路线数据，尤其是：前后日终点/起点是否连续、地点是否像村级或模糊点导致地图不可检索、当天里程/时长是否过重、住宿落点是否合理。",
          "不要为了快而直接给泛泛建议。发现问题要明确指出；无法确定时说明假设。",
          "只输出严格 JSON，不要 Markdown。JSON 字段：reply(string)、patch(object|null)、confidence(number)、auditFindings(array)。",
          "只有 action 是 replan 且你确实要改当天停靠点时，patch 才能为 { kind:'replace_stops', updatedStops:[{name,durationMinutes?}], operations:[...] }；其他情况 patch 为 null。",
          "updatedStops 必须保留当天真实起点和终点，不要删除用户明确要求保留的点。全部内容用中文。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          action: actionId,
          action_instruction: actionInstruction(actionId),
          user_note: note || "",
          active_day_context: context,
          full_route_audit_context: buildRouteAuditContext(context)
        })
      }
    ]
  };

  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`模型请求失败：${response.status}${detail ? ` ${detail.slice(0, 180)}` : ""}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const parsed = JSON.parse(content);
  const reply = String(parsed?.reply || "").trim();

  if (!reply) {
    return { ...fallback, source: "local_fallback", model, warning: "模型返回为空，已使用本地兜底结果。" };
  }

  return {
    reply,
    patch: normalizeAssistantPatch(parsed, context),
    source: "model",
    model,
    confidence: typeof parsed?.confidence === "number" ? parsed.confidence : null,
    auditFindings: Array.isArray(parsed?.auditFindings) ? parsed.auditFindings.slice(0, 8).map(String) : []
  };
}

export function runTripAssistantAction({ actionId, context, note }) {
  if (actionId === "replan") return buildReplanResult(context, note);
  if (actionId === "summary") return buildSummaryResult(context);
  if (actionId === "family") return buildFamilyResult(context);
  if (actionId === "photos") return buildPhotosResult(context);
  if (actionId === "risk") return buildRiskResult(context);

  return {
    reply: "这个动作暂时还没有接入结构化处理。",
    patch: null
  };
}
