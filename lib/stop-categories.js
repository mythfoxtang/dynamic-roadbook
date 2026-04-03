export const STOP_CATEGORY_META = {
  lodging: { label: "住宿", shortLabel: "住", tone: "border-sky-300/25 bg-sky-300/10 text-sky-100" },
  scenic: { label: "景点", shortLabel: "景", tone: "border-amber-300/25 bg-amber-300/10 text-amber-100" },
  viewpoint: { label: "观景点", shortLabel: "观", tone: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" },
  waypoint: { label: "途经点", shortLabel: "途", tone: "border-white/15 bg-white/5 text-white/70" },
  supply: { label: "补给", shortLabel: "补", tone: "border-orange-300/25 bg-orange-300/10 text-orange-100" },
  parking: { label: "停车/换乘", shortLabel: "停", tone: "border-fuchsia-300/25 bg-fuchsia-300/10 text-fuchsia-100" }
};

export const STOP_CATEGORY_OPTIONS = Object.entries(STOP_CATEGORY_META).map(([value, meta]) => ({
  value,
  ...meta
}));

export function inferStopCategory({ name = "", scene = "", index = 0, total = 0 }) {
  if (index === 0 || index === total - 1) return "lodging";

  if (/(停车场|游客中心|服务中心|换乘|摆渡|接驳)/.test(name)) return "parking";
  if (/(加油|服务区|补给|餐厅|饭店|超市|驿站)/.test(name)) return "supply";
  if (/(观景|垭口|山口|日落|日出|机位|观景台)/.test(name)) return "viewpoint";
  if (/(景区|神山|雪山|湖|峡谷|古城|公园|草原|湿地|冰川)/.test(name)) return "scenic";
  if (scene === "ice" || scene === "lake" || scene === "desert") return "scenic";
  if (scene === "city") return "supply";
  return "waypoint";
}

export function inferStopDurationMinutes({ category = "waypoint", index = 0, total = 0 }) {
  if (index === 0 || index === total - 1) return 0;

  switch (category) {
    case "lodging":
      return 30;
    case "scenic":
      return 120;
    case "viewpoint":
      return 40;
    case "supply":
      return 30;
    case "parking":
      return 20;
    case "waypoint":
    default:
      return 10;
  }
}
