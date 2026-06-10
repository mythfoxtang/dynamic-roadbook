function splitList(value) {
  return String(value || "")
    .split(/[、，,\n/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueList(values) {
  return [...new Set(values.filter(Boolean))];
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferPrimaryConstraint(form) {
  const text = [
    form?.plannedPlaces,
    form?.mustVisit,
    form?.optionalPlaces,
    form?.constraints,
    form?.helpNeeded,
    form?.sourceContent
  ]
    .filter(Boolean)
    .join(" ");

  if (includesAny(text, ["花海", "花期", "油菜花", "草原花"])) return "seasonal_bloom";
  if (includesAny(text, ["雪山", "冰川", "垭口", "封路", "冬季"])) return "weather_and_pass";
  if (includesAny(text, ["高反", "海拔", "老人", "孩子", "亲子"])) return "altitude_and_people";
  if (includesAny(text, ["预约", "门票", "旺季", "九寨", "黄龙"])) return "booking_and_capacity";
  if (includesAny(text, ["不想赶", "轻松", "休整", "缓冲"])) return "pace_buffer";
  return "route_feasibility";
}

export const ANCHOR_WORKFLOW_STEPS = [
  {
    title: "锁定锚点",
    text: "先把必去、想去、可放弃分开；必去点不轻易删，只调整顺序和住宿落点。"
  },
  {
    title: "识别主约束",
    text: "先判断这次最硬的限制是花期、封路、预约、高反、预算，还是起终点交通。"
  },
  {
    title: "比较方向",
    text: "同一组锚点至少比较正走和反走，重点看海拔递进、花期命中、租车和返程成本。"
  },
  {
    title: "合并区域簇",
    text: "把散点合成区域块，每块 1-3 晚；先定住宿地，再把景点塞进当天。"
  },
  {
    title: "单日主目标",
    text: "每天只设一个主目标，其他点作为顺路加点，避免景区步行和山路驾驶叠爆。"
  },
  {
    title: "预订分级",
    text: "热门景区和房少县城提前订可退；天气、路况、高海拔段避免过早锁死不可退。"
  }
];

export const ANCHOR_DECISION_RULES = [
  "用户已经明确提出的必去锚点，默认保留；除非时间、季节或安全条件明显冲突。",
  "先选季节窗口，再排路线顺序；花海、雪山、封路和景区预约优先级高于普通距离最短。",
  "方向选择必须解释海拔递进、交通接驳和预订成本，不只解释地图顺路。",
  "住宿落点优先服务第二天执行，不只服务当天结束。",
  "长线自驾的强度来自连续性：连续高海拔、连续 7 小时驾驶、景区步行叠加都要加权。",
  "输出必须包含标准版和压缩版，并明确哪些天不适合买不可退酒店。"
];

export const ANCHOR_PROMPT_TEMPLATE = `你是长线自驾行程规划师。用户属于“锚点明确型旅行者”：他大体知道要去哪儿，不需要泛泛推荐景点。

请按以下流程规划：
1. 提取必去锚点、想去锚点、可放弃锚点。
2. 判断主约束：季节窗口、花期/雪山/封路/预约、起终点交通、高反、每日驾驶强度。
3. 比较正走和反走，说明推荐方向。
4. 把锚点合并成区域簇，不要逐点硬排。
5. 每天只设置一个主目标，其他作为可选加点。
6. 每天输出起点、终点住宿地、主目标、可选加点、估算车程、海拔/体力风险、预订建议。
7. 最后给出强度评分，并说明相对用户现有高强度路书的比例。
8. 给出标准舒适版和压缩高强度版。

不要写旅游软文。要像真实可执行的自驾计划。`;

export function buildAnchorPlanningProfile({ activeType, form, destinations, tripDays }) {
  const plannedPlaces = splitList(form?.plannedPlaces);
  const mustVisit = splitList(form?.mustVisit);
  const optionalPlaces = splitList(form?.optionalPlaces);
  const lockedItems = splitList(form?.lockedItems);
  const requiredAnchors = uniqueList([...plannedPlaces, ...mustVisit, ...lockedItems]);
  const niceToHaveAnchors = optionalPlaces.filter((item) => !requiredAnchors.includes(item));
  const primaryConstraint = inferPrimaryConstraint(form);
  const isAnchorDriven =
    activeType === "semifinished" ||
    activeType === "poi-only" ||
    requiredAnchors.length >= 3 ||
    Boolean(form?.plannedPlaces || form?.mustVisit);

  return {
    isAnchorDriven,
    requiredAnchors,
    niceToHaveAnchors,
    destinationOrder: destinations,
    primaryConstraint,
    tripDays,
    workflowSteps: ANCHOR_WORKFLOW_STEPS,
    decisionRules: ANCHOR_DECISION_RULES,
    promptTemplate: ANCHOR_PROMPT_TEMPLATE,
    outputContract: [
      "推荐方向与理由",
      "区域簇划分",
      "逐日主目标和住宿地",
      "强度评分",
      "预订分级清单",
      "标准版与压缩版"
    ]
  };
}
