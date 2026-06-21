import { parseRoadbookText } from "@/lib/parser";
import { getCrewEventLabel, getCrewForDay } from "@/lib/crew-data";

export const RAW_ROADBOOK = `Day1 (2026.06.27) 上海-昆明-大理-丽江
Day2 丽江
Day3 丽江-虎跳峡-香格里拉 200km 3.5h
Day4 香格里拉-梅里雪山-德钦 200km 3.5h
Day5 德钦-芒康 220km 5h
Day6 芒康-类乌齐 385km 7.5h
Day7 类乌齐-孜珠寺-丁青 216km 5h
Day8 丁青-白嘎乡 460km 7.5h
Day9 白嘎乡-萨普神山-比如人民政府 220km 6.5h
Day10 比如人民政府-圣象天门-班戈 520km 8.5h
Day11 班戈-色林错-文布南村 430km 7.5h
Day12 文布南村-扎日南木错-措勤 360km 6.5h
Day13 措勤-佩枯错希峰观景台-乃夏村 520km 8.5h
Day14 乃夏村-亚洲一号观景台-帕羊 310km 5.5h
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
    transportLabel: "飞机 + 动车",
    transportHeadline: "MU5822 + D8652 + C327 经大理进丽江",
    transportSegments: [
      {
        kind: "flight",
        code: "MU5822",
        carrier: "东方航空",
        from: "上海",
        to: "昆明",
        departureLabel: "06/26 晚上起飞",
        arrivalLabel: "06/26 夜间抵昆明",
        fromDetail: "上海出发机场以出票记录为准",
        toDetail: "昆明长水",
        duration: "以出票记录为准",
        note: "前一晚先落昆明，给第二天早上转大理留出更稳的缓冲。"
      },
      {
        kind: "train",
        code: "D8652",
        carrier: "昆明 -> 大理 动车",
        from: "昆明",
        to: "大理",
        departureLabel: "06/27 早上开车",
        arrivalLabel: "06/27 上午到大理",
        fromDetail: "昆明出发站以车票为准",
        toDetail: "大理站",
        duration: "以车票为准",
        note: "早上从昆明切到大理，把白天时间留给大理半日游。"
      },
      {
        kind: "scenic",
        title: "大理半日游",
        departureLabel: "06/27 白天",
        arrivalLabel: "半日游",
        fromDetail: "大理古城 / 洱海一线",
        note: "只保留半天轻量游玩，不把体力消耗拉满，晚上继续进丽江。"
      },
      {
        kind: "train",
        code: "C327",
        carrier: "大理 -> 丽江 城际列车",
        from: "大理",
        to: "丽江",
        departureLabel: "06/27 晚上开车",
        arrivalLabel: "06/27 晚上到丽江",
        fromDetail: "大理站",
        toDetail: "丽江站",
        duration: "以车票为准",
        note: "当晚抵达丽江，第二天按原计划休整。"
      }
    ],
    routeText: "6 月 26 日晚上乘 MU5822 飞昆明；6 月 27 日早上坐 D8652 到大理，留半天玩大理，晚上坐 C327 到丽江。后续从 6 月 28 日丽江休整开始保持原计划。"
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
  11: {
    routeText: "从班戈继续西南推进，先经过色林错，把湖区节奏放慢一点，晚上落到文布南村休息。"
  },
  12: {
    routeText: "从文布南村出发穿过当惹雍错一线后继续向西，经扎日南木错到措勤县城休息，作为阿里中线的补给落脚点。"
  },
  13: {
    routeText: "从措勤向西南推进，途中把佩枯错希峰观景台作为当天主景点，傍晚收进乃夏村休息，给第二天去亚洲一号观景台留出位置。"
  },
  14: {
    routeText: "从乃夏村先去亚洲一号观景台，游玩结束后继续往帕羊走，晚上在帕羊接回原来的阿里段节奏。"
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
