import { parseRoadbookText } from "@/lib/parser";
import { getCrewEventLabel, getCrewForDay } from "@/lib/crew-data";

export const RAW_ROADBOOK = `Day1 (2026.06.27) 上海-昆明-丽江
Day2 丽江
Day3 丽江-虎跳峡-香格里拉 200km 3.5h
Day4 香格里拉-梅里雪山-德钦 200km 3.5h
Day5 德钦-芒康 220km 5h
Day6 芒康-类乌齐 385km 7.5h
Day7 类乌齐-孜珠寺-丁青 216km 5h
Day8 丁青-白嘎乡 460km 7.5h
Day9 白嘎乡-萨普神山-比如人民政府 220km 6.5h
Day10 比如人民政府-圣象天门-班戈 520km 8.5h
Day11 班戈-色林错-日喀则 575km 8h
Day12 日喀则
Day13 日喀则-珠峰大本营-定日 362km 6.5h
Day14 定日-佩枯错-帕羊 582km 8.5h
Day15 帕羊-玛旁雍错-冈仁波齐 300km 4h
Day16 塔尔钦-札达-狮泉河 470km 7.5h
Day17 狮泉河-班公湖-三十里营房 700km 9h
Day18 三十里营房-叶城-喀什 560km 8.5h
Day19 喀什
Day20 喀什-慕士塔格峰-塔县 300km 6h
Day21 塔县-盘龙古道-喀什 300km 5h
Day22 喀什-温宿大峡谷-库车 755km 8.5h
Day23 库车-独库南段-乔尔玛-唐布拉百里画廊-新源 500km 9h
Day24 新源-库尔德宁-特克斯 260km 5h
Day25 特克斯-喀拉峻-昭苏 220km 4.5h
Day26 昭苏-夏塔-伊宁 300km 5.5h
Day27 伊宁-赛里木湖-博乐 260km 4.5h
Day28 博乐-独山子大峡谷-乌鲁木齐 560km 7h
Day29 乌鲁木齐-天山天池-上海`;

const parsed = parseRoadbookText(RAW_ROADBOOK);
const TRIP_START_DATE = parsed.find((day) => day.day === 1)?.date || "2026-06-27";

function addDays(dateString, offset) {
  const [year, month, day] = String(dateString || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

const DAY_OVERRIDES = {
  1: {
    transport: "flight",
    distance: 0,
    hours: 0,
    statusLabel: "联运日",
    transportLabel: "飞机 + 夜车",
    transportHeadline: "MU9716 + Y752 进丽江",
    transportSegments: [
      {
        kind: "flight",
        code: "MU9716",
        carrier: "东方航空",
        from: "上海",
        to: "昆明",
        departureLabel: "06/27 13:50 起飞",
        arrivalLabel: "06/27 18:55 抵昆明",
        fromDetail: "上海浦东 T1",
        toDetail: "昆明长水",
        duration: "5h05",
        via: "昭通",
        note: "当前公开班表能查到这组时刻，但公开班期与 2026-06-27 周六存在冲突，需以你的出票记录为准。"
      },
      {
        kind: "train",
        code: "Y752",
        carrier: "昆明 -> 丽江 过夜列车",
        from: "昆明",
        to: "丽江",
        departureLabel: "06/27 21:30 开车",
        arrivalLabel: "06/28 07:55 到丽江",
        fromDetail: "昆明站",
        toDetail: "丽江站",
        duration: "10h25",
        note: "夜车把最后一段入场补完，第二天直接进丽江休整。"
      }
    ],
    routeText: "6 月 27 日先乘 MU9716 飞昆明，再换乘过夜火车 Y752 进丽江，当天以联运进场、整备和休息为主。"
  },
  2: {
    distance: 0,
    hours: 0,
    title: "丽江休整",
    stops: ["丽江"],
    routeText: "6 月 28 日留在丽江适应海拔和节奏，把古城闲逛、补给和出发前准备都放在这一天。"
  },
  8: {
    routeText: "从丁青直接推进到比如白嘎乡，把住宿前置到更靠近萨普神山的位置，为第二天整段游玩留足时间。"
  },
  9: {
    routeText: "从白嘎乡进萨普神山，游玩结束后不回白嘎，直接回收到比如人民政府附近住宿。"
  },
  10: {
    routeText: "从比如人民政府附近继续西推，途中补上纳木错圣象天门，再赶到班戈。"
  },
  12: {
    distance: 0,
    hours: 0,
    title: "日喀则休整",
    stops: ["日喀则"],
    routeText: "在日喀则安排完整休整日，把人和车都调整到珠峰段前的最佳状态。"
  },
  18: {
    dayEvents: [
      {
        kind: "pickup",
        title: "妈妈飞抵喀什后加入",
        person: "妈妈",
        code: "CZ6830",
        window: "07/14 14:55 起飞 / 21:40 抵喀什",
        location: "上海浦东 T2 → 喀什徕宁 T2",
        note: "白天先把三十里营房到喀什的长推进跑完，晚上按这个落地时刻去机场接人。"
      }
    ],
    routeText: "从三十里营房经叶城推进到喀什，晚上去机场接妈妈乘 CZ6830 抵达并加入后半程。"
  },
  19: {
    distance: 0,
    hours: 0,
    title: "喀什休整",
    stops: ["喀什"],
    routeText: "喀什整休一天，补给、洗整，同时给妈妈留适应和缓冲时间。"
  },
  20: {
    dayEvents: [
      {
        kind: "pickup",
        title: "爸爸当天飞到喀什",
        person: "爸爸",
        code: "CZ6830",
        window: "07/16 14:55 起飞 / 21:40 抵喀什",
        location: "上海浦东 T2 → 喀什徕宁 T2",
        note: "你和妈妈继续跑塔县线，爸爸先单独落地喀什。"
      }
    ],
    routeText: "你和妈妈先跑慕士塔格峰到塔县这条线，爸爸当天乘 CZ6830 飞到喀什，先独立安顿。"
  },
  21: {
    dayEvents: [
      {
        kind: "meetup",
        title: "晚上在喀什会合",
        person: "全员",
        window: "07/17 晚上",
        note: "爸爸白天自己逛喀什，你和妈妈从塔县回城后正式碰头。"
      }
    ],
    routeText: "从塔县经盘龙古道回喀什，爸爸白天自己玩喀什，晚上全员会合。"
  },
  22: {
    routeText: "7 月 18 日三人正式一起出发，从喀什拉到温宿大峡谷，再推进到库车。"
  },
  23: {
    routeText: "从库车走独库公路北上，到乔尔玛后拐去唐布拉百里画廊，再回收到新源住宿。"
  },
  26: {
    routeText: "白天先玩夏塔，不再回昭苏，傍晚直接赶到伊宁市区住宿。"
  },
  28: {
    routeText: "从博乐东进乌鲁木齐，路上补上独山子大峡谷，晚上回收到乌鲁木齐。"
  },
  29: {
    transport: "flight",
    distance: 0,
    hours: 0,
    statusLabel: "返程日",
    transportLabel: "飞机",
    transportHeadline: "天池后乘 FM9224 回上海",
    transportSegments: [
      {
        kind: "scenic",
        title: "天山天池收尾行程",
        from: "乌鲁木齐",
        to: "天山天池",
        departureLabel: "07/25 白天",
        arrivalLabel: "返程前最后一站",
        fromDetail: "乌鲁木齐市区",
        toDetail: "天山天池景区",
        note: "先把最后一天做成完整行程，再回机场。"
      },
      {
        kind: "flight",
        code: "FM9224",
        carrier: "上海航空",
        from: "乌鲁木齐",
        to: "上海",
        departureLabel: "07/25 20:20 起飞",
        arrivalLabel: "07/26 01:15 抵上海",
        fromDetail: "乌鲁木齐 T2",
        toDetail: "上海浦东 T1",
        duration: "4h55",
        note: "当前公开班表显示这班次是次日凌晨到上海，车辆行程到此结束。"
      }
    ],
    routeText: "7 月 25 日先去天山天池收尾，再返回乌鲁木齐机场乘 FM9224 飞回上海。"
  }
};

export const ROADBOOK_DAYS = parsed.map((item, index) => {
  const override = DAY_OVERRIDES[item.day] || {};
  const merged = {
    ...item,
    ...override,
    transport: override.transport || "drive"
  };

  return {
    ...merged,
    date: merged.date || addDays(TRIP_START_DATE, item.day - 1),
    cumulativeDistance: parsed.slice(0, index + 1).reduce((sum, day) => sum + (DAY_OVERRIDES[day.day]?.distance ?? day.distance ?? 0), 0),
    crew: getCrewForDay(item.day),
    crewEvent: getCrewEventLabel(item.day)
  };
});
