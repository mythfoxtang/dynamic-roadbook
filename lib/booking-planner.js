import { PLACE_META } from "@/lib/place-data";

const BOOKING_PORTALS = {
  hotel: {
    label: "去携程酒店",
    href: "https://hotels.ctrip.com/hotels"
  },
  flight: {
    label: "去携程机票",
    href: "https://flights.ctrip.com/"
  },
  train: {
    label: "去携程火车票",
    href: "https://trains.ctrip.com/"
  },
  car: {
    label: "去携程租车",
    href: "https://car.ctrip.com/zijia"
  },
  ticket: {
    label: "去携程门票",
    href: "https://piao.ctrip.com/"
  },
  activity: {
    label: "去携程玩乐",
    href: "https://huodong.ctrip.com/"
  }
};

const STAY_KEYWORD_MAP = {
  丽江: "丽江古城",
  香格里拉: "独克宗古城",
  德钦: "飞来寺",
  芒康: "芒康县城",
  类乌齐: "类乌齐县城",
  丁青: "丁青县城",
  白嘎乡: "比如县白嘎乡",
  比如: "比如县城",
  比如人民政府: "比如县人民政府",
  班戈: "班戈县城",
  日喀则: "日喀则市区",
  定日: "定日县城",
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
  伊宁: "伊宁市区",
  博乐: "博乐市区",
  乌鲁木齐: "乌鲁木齐市区"
};

const STAY_STRATEGY_MAP = {
  九寨沟: {
    priority: "high",
    refundPolicy: "优先可退",
    bookingWindow: "旺季提前 3-6 周",
    locationStrategy: "优先沟口，不要为了便宜住到九寨沟县城。",
    reason: "热门景区房价和房量波动大，且第二天进沟时间很关键。"
  },
  川主寺: {
    priority: "medium",
    refundPolicy: "优先可退",
    bookingWindow: "提前 1-3 周",
    locationStrategy: "用于衔接黄龙、松潘和九寨沟，优先靠主路和停车方便。",
    reason: "这是九黄之间的功能型落点，位置比酒店本身更重要。"
  },
  松潘: {
    priority: "medium",
    refundPolicy: "优先可退",
    bookingWindow: "提前 1-3 周",
    locationStrategy: "适合作为黄龙前后缓冲，优先县城或古城外停车方便位置。",
    reason: "黄龙当天体力消耗大，住宿点要方便收车。"
  },
  扎尕那: {
    priority: "high",
    refundPolicy: "优先可退",
    bookingWindow: "旺季提前 3-5 周",
    locationStrategy: "优先景区村寨内或观景方便的民宿，接受条件朴素。",
    reason: "房源少且位置差异明显，旺季临订容易牺牲体验。"
  },
  郎木寺: {
    priority: "medium",
    refundPolicy: "可退优先",
    bookingWindow: "提前 1-3 周",
    locationStrategy: "优先镇中心，方便步行和次日出发。",
    reason: "镇子不大，核心是停车和早晚步行便利。"
  },
  若尔盖: {
    priority: "medium",
    refundPolicy: "可退优先",
    bookingWindow: "花期提前 2-4 周",
    locationStrategy: "按第二天去花湖、九曲黄河或九寨沟方向选边。",
    reason: "花期和雨季叠加时，落点要给路线调整留余地。"
  },
  红原: {
    priority: "medium",
    refundPolicy: "可退优先",
    bookingWindow: "花期提前 2-4 周",
    locationStrategy: "优先月亮湾、县城或俄么塘方向的顺路落点。",
    reason: "花海和草原天气变量大，不建议锁死不可退。"
  },
  阿坝县: {
    priority: "high",
    refundPolicy: "优先可退",
    bookingWindow: "提前 2-4 周",
    locationStrategy: "优先县城，服务莲宝叶则当天早出和补给。",
    reason: "莲宝叶则游玩耗时长，前夜住宿位置直接影响执行。"
  },
  久治: {
    priority: "medium",
    refundPolicy: "可退优先",
    bookingWindow: "提前 1-3 周",
    locationStrategy: "作为莲宝叶则到果洛之间的中继，优先停车和供氧条件。",
    reason: "高海拔中继点选择不多，舒适度和补给优先。"
  },
  玛沁: {
    priority: "medium",
    refundPolicy: "可退优先",
    bookingWindow: "提前 1-3 周",
    locationStrategy: "优先县城，作为阿尼玛卿前后补给点。",
    reason: "阿尼玛卿天气变量大，住宿不要买死。"
  },
  玛多: {
    priority: "high",
    refundPolicy: "必须可退",
    bookingWindow: "提前 2-4 周并临近复核",
    locationStrategy: "优先县城可靠酒店，关注供暖、热水、停车和供氧。",
    reason: "三江源和黄河源区海拔高、天气和管控变量大。"
  }
};

function normalizeRiskLabel(priority) {
  if (priority === "high") return "高";
  if (priority === "medium") return "中";
  return "低";
}

function getStayStrategy(city, keyword, coveredDays) {
  const matched = Object.entries(STAY_STRATEGY_MAP).find(([name]) => city?.includes(name) || keyword?.includes(name));
  const strategy = matched?.[1] || {
    priority: "low",
    refundPolicy: "可退优先",
    bookingWindow: "提前 1-2 周",
    locationStrategy: "按当天终点和次日出发方向选择，优先停车方便。",
    reason: "普通落脚点先保证位置、停车和可取消。"
  };
  const hasHardDrive = coveredDays.some((day) => Number(day.distance || 0) >= 500 || Number(day.hours || 0) >= 8);

  return {
    ...strategy,
    risk: normalizeRiskLabel(strategy.priority),
    refundPolicy: hasHardDrive ? "必须可退" : strategy.refundPolicy,
    reason: hasHardDrive ? `${strategy.reason} 当天驾驶强度偏高，酒店不要锁死不可退。` : strategy.reason
  };
}

function buildFlightStrategy(item) {
  return {
    risk: item.day <= 2 ? "中" : "低",
    refundPolicy: "先比价，确认取还车与首晚住宿后再下单",
    bookingWindow: "确定路线方向后优先查去程，再查返程",
    locationStrategy: "同时比较正向和反向起终点，别只按一个方向查票。",
    reason: "机票价格会反向影响路线方向；落地时间也会影响能否当天取车和赶到首晚落点。"
  };
}

function buildUrl(baseUrl, params) {
  try {
    const url = new URL(baseUrl);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  } catch {
    return baseUrl;
  }
}

function addDays(dateString, offset) {
  const [year, month, day] = String(dateString || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function formatDate(dateString) {
  if (!dateString) return "--";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(date);
}

function normalizeDates(days) {
  const firstDatedDay = days.find((day) => day.date);
  if (!firstDatedDay?.date) return days;

  return days.map((day) => ({
    ...day,
    bookingDate: day.date || addDays(firstDatedDay.date, day.day - firstDatedDay.day)
  }));
}

function getKnownStops(day) {
  return (day.stops || []).filter((stop) => PLACE_META[stop]);
}

function getStartPlace(day) {
  const knownStops = getKnownStops(day);
  return knownStops[0] || day.stops?.[0] || "待确认";
}

function getEndPlace(day) {
  const knownStops = getKnownStops(day);
  return knownStops[knownStops.length - 1] || day.stops?.[day.stops.length - 1] || "待确认";
}

function getStayKeyword(city) {
  return STAY_KEYWORD_MAP[city] || city;
}

function shouldSkipAccommodation(day, days) {
  const isLastDay = day.day === days.length;
  return isLastDay && day.transport === "flight";
}

function buildAccommodationBlocks(days) {
  const blocks = [];

  days.forEach((day) => {
    if (shouldSkipAccommodation(day, days)) return;

    const city = getEndPlace(day);
    const existing = blocks[blocks.length - 1];

    if (existing && existing.city === city) {
      existing.nights += 1;
      existing.checkoutDate = addDays(day.bookingDate, 1);
      existing.coveredDays.push(day.day);
      existing.coveredDayDetails.push(day);
      return;
    }

    const stayKeyword = getStayKeyword(city);
    blocks.push({
      id: `stay-${day.day}`,
      city,
      stayKeyword,
      nights: 1,
      checkinDate: day.bookingDate,
      checkoutDate: addDays(day.bookingDate, 1),
      coveredDays: [day.day],
      coveredDayDetails: [day],
      rationale:
        day.transport === "flight"
          ? "到达当天先住落地城市，方便接后续取车或休整。"
          : "按当天终点落住宿锚点，减少折返并保持次日出发顺手。"
    });
  });

  return blocks.map((block) => ({
    ...block,
    bookingStrategy: getStayStrategy(block.city, block.stayKeyword, block.coveredDayDetails),
    portal: {
      ...BOOKING_PORTALS.hotel,
      href: buildUrl(BOOKING_PORTALS.hotel.href, {
        cityName: block.city,
        city: block.city,
        checkIn: block.checkinDate,
        checkOut: block.checkoutDate,
        keyword: block.stayKeyword,
        districtName: block.stayKeyword
      }),
      copyValue: block.stayKeyword
    }
  }));
}

function buildTransportItems(days) {
  return days
    .filter((day) => day.transport === "flight")
    .map((day) => {
      const knownStops = getKnownStops(day);
      const from = knownStops[0] || day.stops?.[0] || "待确认";
      const to = knownStops[knownStops.length - 1] || day.stops?.[day.stops.length - 1] || "待确认";

      const item = {
        id: `transport-${day.day}`,
        day: day.day,
        date: day.bookingDate,
        type: day.transportLabel || "航班",
        from,
        to,
        title: `${from} -> ${to}`,
        rationale: day.routeText || "这一天在路书里被标记为航班日，适合直接生成机票搜索任务。",
        portal: {
          ...BOOKING_PORTALS.flight,
          href: buildUrl(BOOKING_PORTALS.flight.href, {
            dcity: from,
            acity: to,
            date: day.bookingDate,
            tripType: "OW"
          })
        }
      };

      return {
        ...item,
        bookingStrategy: buildFlightStrategy(item)
      };
    });
}

function buildCarRentalItem(days) {
  const driveDays = days.filter((day) => day.transport !== "flight");
  if (!driveDays.length) return null;

  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const pickupCity = getEndPlace(firstDay);
  const returnCity = getStartPlace(lastDay);
  const pickupDate = firstDay.bookingDate;
  const returnDate = lastDay.bookingDate;

  return {
    id: "car-roadtrip-main",
    title: `${pickupCity} 取车 -> ${returnCity} 还车`,
    pickupCity,
    returnCity,
    pickupDate,
    returnDate,
    durationDays: driveDays.length + 1,
    rationale: "整条线路以连续自驾推进为主，先按全程一张租车单来评估最省事。若价格过高，再拆分为分段取还车。",
    portal: {
      ...BOOKING_PORTALS.car,
      href: buildUrl(BOOKING_PORTALS.car.href, {
        pickupCity,
        returnCity,
        pickupDate,
        returnDate
      })
    }
  };
}

function buildTicketItems(days) {
  const seen = new Set();

  return days
    .flatMap((day) => {
      const lodgingCity = getEndPlace(day);

      return (day.highlights || [])
        .filter((highlight) => highlight.name && !seen.has(highlight.name))
        .filter((highlight) => highlight.scene !== "city")
        .filter((highlight) => highlight.name !== lodgingCity)
        .slice(0, 1)
        .map((highlight) => {
          seen.add(highlight.name);
          return {
            id: `ticket-${day.day}-${highlight.name}`,
            day: day.day,
            date: day.bookingDate,
            title: highlight.name,
            city: lodgingCity,
            rationale: "这类景点或景区通常值得提前确认门票、预约或玩乐产品，避免临近出发再临时查。",
            portals: [
              {
                ...BOOKING_PORTALS.ticket,
                href: buildUrl(BOOKING_PORTALS.ticket.href, {
                  keyword: highlight.name
                })
              },
              {
                ...BOOKING_PORTALS.activity,
                href: buildUrl(BOOKING_PORTALS.activity.href, {
                  keyword: highlight.name
                })
              }
            ]
          };
        });
    })
    .slice(0, 10);
}

export function buildBookingPlan(days) {
  const normalizedDays = normalizeDates(days);
  const accommodation = buildAccommodationBlocks(normalizedDays);
  const transport = buildTransportItems(normalizedDays);
  const carRental = buildCarRentalItem(normalizedDays);
  const tickets = buildTicketItems(normalizedDays);

  return {
    dateRange: {
      start: normalizedDays[0]?.bookingDate || null,
      end: normalizedDays[normalizedDays.length - 1]?.bookingDate || null,
      startLabel: formatDate(normalizedDays[0]?.bookingDate || null),
      endLabel: formatDate(normalizedDays[normalizedDays.length - 1]?.bookingDate || null)
    },
    accommodation,
    transport,
    carRental,
    tickets
  };
}
