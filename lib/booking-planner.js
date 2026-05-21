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
      return;
    }

    blocks.push({
      id: `stay-${day.day}`,
      city,
      stayKeyword: getStayKeyword(city),
      nights: 1,
      checkinDate: day.bookingDate,
      checkoutDate: addDays(day.bookingDate, 1),
      coveredDays: [day.day],
      rationale:
        day.transport === "flight"
          ? "到达当天先住落地城市，方便接后续取车或休整。"
          : "按当天终点落住宿锚点，减少折返并保持次日出发顺手。"
    });
  });

  return blocks.map((block) => ({
    ...block,
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

      return {
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
