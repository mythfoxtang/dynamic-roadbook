import { parseRoadbookText } from "@/lib/parser";
import { getCrewEventLabel, getCrewForDay } from "@/lib/crew-data";

export const RAW_ROADBOOK = `Day1 (2026.06.28) 上海-丽江-飞机抵达-整备
Day2 丽江-虎跳峡-香格里拉 200km 3.5h
Day3 香格里拉-梅里雪山-德钦 200km 3.5h
Day4 德钦-芒康 220km 5h
Day5 芒康-类乌齐 385km 7.5h
Day6 类乌齐-孜珠寺-丁青 216km 5h
Day7 丁青-比如 430km 7h
Day8 比如-萨普神山-比如 180km 6h
Day9 比如-班戈 477km 7.5h
Day10 班戈-色林错-日喀则 575km 8h
Day11 日喀则-休整
Day12 日喀则-珠峰大本营-定日 362km 6.5h
Day13 定日-佩枯错-帕羊 582km 8.5h
Day14 帕羊-玛旁雍错-冈仁波齐 300km 4h
Day15 塔尔钦-札达-狮泉河 470km 7.5h
Day16 狮泉河-班公湖-三十里营房 700km 9h
Day17 三十里营房-叶城-喀什 560km 8.5h
Day18 喀什-休整
Day19 喀什-慕士塔格峰-塔县 300km 6h
Day20 塔县-盘龙古道-喀什 300km 5h
Day21 喀什-温宿大峡谷-库车 755km 8.5h
Day22 库车-独库南段-新源 390km 7h
Day23 新源-库尔德宁-特克斯 260km 5h
Day24 特克斯-喀拉峻-昭苏 220km 4.5h
Day25 昭苏-夏塔-昭苏 120km 3h
Day26 昭苏-伊宁-赛里木湖-博乐 350km 7.5h
Day27 博乐-乌鲁木齐 500km 6h
Day28 乌鲁木齐-上海-飞机返程`;

const parsed = parseRoadbookText(RAW_ROADBOOK);

const DAY_OVERRIDES = {
  1: {
    transport: "flight",
    distance: 0,
    hours: 0,
    statusLabel: "航班日",
    routeText: "上海飞丽江，落地后整备车辆和物资。"
  },
  28: {
    transport: "flight",
    distance: 0,
    hours: 0,
    statusLabel: "航班日",
    routeText: "乌鲁木齐飞上海，车辆行程到此结束。"
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
    cumulativeDistance: parsed.slice(0, index + 1).reduce((sum, day) => sum + (DAY_OVERRIDES[day.day]?.distance ?? day.distance ?? 0), 0),
    crew: getCrewForDay(item.day),
    crewEvent: getCrewEventLabel(item.day)
  };
});
