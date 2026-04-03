"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ChevronDown, ChevronLeft, ChevronRight, Gauge, Link2, List, Mountain, Plane, Route, Users } from "lucide-react";
import Timeline from "@/components/timeline";
import MapPanel from "@/components/map-panel";
import { ROADBOOK_DAYS } from "@/lib/roadtrip-data";
import { STOP_CATEGORY_META, inferStopCategory, inferStopDurationMinutes } from "@/lib/stop-categories";

const DAY_PLAN_STORAGE_KEY = "dynamic-roadbook-day-plan-v1";

function loadDayPlans() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DAY_PLAN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistDayPlans(value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DAY_PLAN_STORAGE_KEY, JSON.stringify(value));
  } catch {}
}

function StatCard({ icon: Icon, label, value, accent = "text-accent" }) {
  return (
    <div className="panel rounded-2xl p-4 shadow-glow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/55">{label}</div>
          <div className={`mt-3 text-xl font-semibold sm:text-2xl ${accent}`}>{value}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/10 p-2 text-white/80">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function statusTone(level) {
  if (level === "critical") return "text-warning";
  if (level === "high") return "text-accent";
  if (level === "medium") return "text-amber-200";
  return "text-emerald-200";
}

function formatRouteHours(routeMetrics, fallbackHours) {
  if (!routeMetrics) return `${fallbackHours || 0} h`;
  const hours = (routeMetrics.time / 3600).toFixed(1).replace(/\.0$/, "");
  return `${hours} h`;
}

function formatRouteDistance(routeMetrics, fallbackDistance) {
  if (!routeMetrics) return `${fallbackDistance || 0} km`;
  return `${(routeMetrics.distance / 1000).toFixed(0)} km`;
}

function formatMinutesAsHours(minutes) {
  if (!minutes) return "0 h";
  const hours = (minutes / 60).toFixed(1).replace(/\.0$/, "");
  return `${hours} h`;
}

function parseTimeToMinutes(timeText) {
  if (!timeText || !/^\d{2}:\d{2}$/.test(timeText)) return null;
  const [hours, minutes] = timeText.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMinutes) {
  if (typeof totalMinutes !== "number") return "--:--";
  const safe = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function HighlightCard({ item, index }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className="panel-soft overflow-hidden rounded-[24px]"
    >
      <div className="relative aspect-[16/10] sm:aspect-[16/9]">
        <Image src={item.image} alt={item.name} fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] tracking-[0.18em] text-white/80">
          {item.scene}
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="text-lg font-semibold text-white">{item.name}</div>
          <div className="mt-1 text-sm text-white/70">{item.altitude} m</div>
        </div>
      </div>
      <div className="p-4 text-sm leading-6 text-white/78">{item.summary}</div>
    </motion.article>
  );
}

function CrewCard({ member, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.08 }}
      className={`overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${member.accent} p-[1px]`}
    >
      <div className="flex h-full items-center gap-4 rounded-2xl bg-[#30271f]/80 p-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/20 sm:h-16 sm:w-16">
          <Image src={member.avatar} alt={member.name} fill className="object-cover" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{member.name}</div>
          <div className="mt-1 text-[11px] tracking-[0.16em] text-white/55">{member.role}</div>
          <div className="mt-2 text-sm leading-6 text-white/70">{member.note}</div>
        </div>
      </div>
    </motion.div>
  );
}

function SectionBlock({ title, kicker, meta, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="panel rounded-[24px] p-4 sm:p-5 sm:rounded-[28px]">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-4 text-left">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/50">{kicker}</div>
          <div className="mt-2 text-xl font-semibold text-white">{title}</div>
        </div>
        <div className="flex items-center gap-3">
          {meta ? <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-[0.18em] text-white/60">{meta}</div> : null}
          <div className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70">
            <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
          </div>
        </div>
      </button>

      {open ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

function getStopName(stop) {
  return typeof stop === "string" ? stop : stop?.name || "未命名地点";
}

function getStopCategory(stop, activeDay, index, total) {
  const explicit = typeof stop === "object" ? stop?.category : null;
  return explicit || inferStopCategory({ name: getStopName(stop), scene: activeDay.scene?.key || "", index, total });
}

function getStopDuration(stop, activeDay, index, total) {
  const explicit = typeof stop === "object" && typeof stop?.durationMinutes === "number" ? stop.durationMinutes : null;
  if (typeof explicit === "number") return explicit;
  return inferStopDurationMinutes({ category: getStopCategory(stop, activeDay, index, total), index, total });
}

function serializeStop(stop) {
  if (typeof stop === "string") return stop;
  if (!stop) return "";
  const coord = Array.isArray(stop.coord) ? stop.coord.join(",") : "";
  return `${stop.name || ""}|${stop.category || ""}|${stop.durationMinutes ?? ""}|${coord}`;
}

function sameStopsList(a = [], b = []) {
  return JSON.stringify(a.map(serializeStop)) === JSON.stringify(b.map(serializeStop));
}

function StopBadge({ stop, category }) {
  const meta = STOP_CATEGORY_META[category] || STOP_CATEGORY_META.waypoint;
  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${meta.tone}`}>
      {getStopName(stop)} · {meta.label}
    </span>
  );
}

function DailyPlanningPanel({ activeDay, activeStops, driveMinutes, stopMinutes, totalMinutes }) {
  const [plan, setPlan] = useState({
    departureTime: activeDay.transport === "flight" ? "" : "08:30",
    sunrise: "06:30",
    sunset: "20:10",
    weatherSummary: "",
    tempMin: "",
    tempMax: "",
    flightNo: "",
    departAirport: "",
    arriveAirport: "",
    flightDepartureTime: "",
    flightArrivalTime: ""
  });

  useEffect(() => {
    const allPlans = loadDayPlans();
    const saved = allPlans[activeDay.id] || {};
    setPlan({
      departureTime: activeDay.transport === "flight" ? "" : saved.departureTime || "08:30",
      sunrise: saved.sunrise || "06:30",
      sunset: saved.sunset || "20:10",
      weatherSummary: saved.weatherSummary || "",
      tempMin: saved.tempMin || "",
      tempMax: saved.tempMax || "",
      flightNo: saved.flightNo || "",
      departAirport: saved.departAirport || "",
      arriveAirport: saved.arriveAirport || "",
      flightDepartureTime: saved.flightDepartureTime || "",
      flightArrivalTime: saved.flightArrivalTime || ""
    });
  }, [activeDay.id, activeDay.transport]);

  function updatePlan(field, value) {
    setPlan((current) => {
      const next = { ...current, [field]: value };
      const allPlans = loadDayPlans();
      persistDayPlans({ ...allPlans, [activeDay.id]: next });
      return next;
    });
  }

  const departureMinutes = parseTimeToMinutes(plan.departureTime);
  const arrivalMinutes = departureMinutes === null ? null : departureMinutes + totalMinutes;
  const driveLegMinutes = activeStops.length > 1 ? Math.round(driveMinutes / (activeStops.length - 1)) : driveMinutes;
  const keyMoments = departureMinutes === null
    ? []
    : activeStops.map((stop, index) => {
        const stopDuration = getStopDuration(stop, activeDay, index, activeStops.length);
        const passedDrive = driveLegMinutes * index;
        const passedStay = activeStops
          .slice(1, index)
          .reduce((sum, item, innerIndex) => sum + getStopDuration(item, activeDay, innerIndex + 1, activeStops.length), 0);
        const arriveAt = departureMinutes + passedDrive + passedStay;
        const leaveAt = index === 0 ? departureMinutes : arriveAt + stopDuration;

        return {
          label: getStopName(stop),
          kind: index === 0 ? "出发" : index === activeStops.length - 1 ? "到达" : "停留",
          arriveAt,
          leaveAt,
          stopDuration
        };
      });

  const summaryCards = activeDay.transport === "flight"
    ? []
    : [
        { label: "出发", value: plan.departureTime || "--:--" },
        { label: "到达", value: formatMinutesToTime(arrivalMinutes) },
        { label: "驾驶", value: formatMinutesAsHours(driveMinutes) },
        { label: "停留", value: formatMinutesAsHours(stopMinutes) }
      ];

  return (
    <SectionBlock kicker="时间计划" title="当天时间与天气" defaultOpen meta={activeDay.date || `DAY ${activeDay.day}`}>
      {activeDay.transport === "flight" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="panel-soft rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">航班信息</div>
            <div className="mt-3 grid gap-2">
              <input value={plan.flightNo} onChange={(event) => updatePlan("flightNo", event.target.value)} placeholder="航班号，买好后再填" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
              <input value={plan.departAirport} onChange={(event) => updatePlan("departAirport", event.target.value)} placeholder="出发机场" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
              <input value={plan.arriveAirport} onChange={(event) => updatePlan("arriveAirport", event.target.value)} placeholder="到达机场" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <input value={plan.flightDepartureTime} onChange={(event) => updatePlan("flightDepartureTime", event.target.value)} placeholder="起飞时间" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
                <input value={plan.flightArrivalTime} onChange={(event) => updatePlan("flightArrivalTime", event.target.value)} placeholder="落地时间" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
              </div>
            </div>
          </div>
          <div className="panel-soft rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">天气占位</div>
            <div className="mt-3 grid gap-2">
              <input value={plan.weatherSummary} onChange={(event) => updatePlan("weatherSummary", event.target.value)} placeholder="天气情况，后续可接真实天气接口" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <input value={plan.sunrise} onChange={(event) => updatePlan("sunrise", event.target.value)} placeholder="日出" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
                <input value={plan.sunset} onChange={(event) => updatePlan("sunset", event.target.value)} placeholder="日落" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {summaryCards.map((item) => (
              <div key={`${activeDay.id}-${item.label}`} className="panel-soft rounded-2xl p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">{item.label}</div>
                <div className="mt-2 text-base font-semibold text-white sm:text-lg">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="panel-soft rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">时间安排</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input value={plan.departureTime} onChange={(event) => updatePlan("departureTime", event.target.value)} placeholder="出发时间，例如 08:30" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">预计到达时间：{formatMinutesToTime(arrivalMinutes)}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">驾驶时长：{formatMinutesAsHours(driveMinutes)}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">停留总时长：{formatMinutesAsHours(stopMinutes)}</div>
            </div>
          </div>
          <div className="panel-soft rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">天气与光线</div>
            <div className="mt-3 grid gap-2">
              <input value={plan.weatherSummary} onChange={(event) => updatePlan("weatherSummary", event.target.value)} placeholder="例如 多云转晴 / 风大 / 午后可能有雨" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <input value={plan.tempMin} onChange={(event) => updatePlan("tempMin", event.target.value)} placeholder="最低温" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
                <input value={plan.tempMax} onChange={(event) => updatePlan("tempMax", event.target.value)} placeholder="最高温" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={plan.sunrise} onChange={(event) => updatePlan("sunrise", event.target.value)} placeholder="日出，例如 06:30" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
                <input value={plan.sunset} onChange={(event) => updatePlan("sunset", event.target.value)} placeholder="日落，例如 20:10" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
              </div>
            </div>
            <div className="mt-3 text-xs leading-6 text-white/50">天气这块现在先手动填。后面最自然的接法，是按当天日期和主要区域去拉天气，再把日出日落一起自动带进来。</div>
          </div>
          </div>

          <div className="panel-soft rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">动线与关键时间点</div>
            <div className="mt-3 grid gap-3">
              {keyMoments.map((item, index) => (
                <div key={`${activeDay.id}-moment-${item.label}-${index}`} className="relative rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80 sm:px-5">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10 sm:left-5" />
                  <div className="relative flex items-start gap-3">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-xs text-accent">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate text-white">{item.label}</div>
                          <div className="mt-1 text-xs text-white/50">
                            {item.kind}
                            {item.kind === "停留" ? ` · 预计停留 ${item.stopDuration} 分钟` : ""}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-left text-xs text-white/75 sm:text-right">
                          <div>{item.kind === "出发" ? `出发 ${formatMinutesToTime(item.leaveAt)}` : `到达 ${formatMinutesToTime(item.arriveAt)}`}</div>
                          {item.kind === "停留" ? <div className="mt-1 text-white/50">离开 {formatMinutesToTime(item.leaveAt)}</div> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionBlock>
  );
}

export default function Dashboard() {
  const firstDriveDay = ROADBOOK_DAYS.find((day) => day.transport !== "flight") ?? ROADBOOK_DAYS[0];
  const [activeDayId, setActiveDayId] = useState(firstDriveDay.id);
  const [glitchShift, setGlitchShift] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileScreen, setMobileScreen] = useState("timeline");
  const [routeMetricsByDay, setRouteMetricsByDay] = useState({});
  const [stopsByDay, setStopsByDay] = useState({});

  const activeDay = useMemo(
    () => ROADBOOK_DAYS.find((day) => day.id === activeDayId) ?? ROADBOOK_DAYS[0],
    [activeDayId]
  );

  const activeIndex = ROADBOOK_DAYS.findIndex((day) => day.id === activeDayId);
  const canPrev = activeIndex > 0;
  const canNext = activeIndex < ROADBOOK_DAYS.length - 1;
  const totalDistance = ROADBOOK_DAYS.reduce((sum, day) => sum + (day.distance || 0), 0);
  const activeRouteMetrics = routeMetricsByDay[activeDay.id] ?? null;
  const activeStops = stopsByDay[activeDay.id] ?? activeDay.stops;
  const activeStopMinutes = activeStops.reduce((sum, stop, index) => sum + getStopDuration(stop, activeDay, index, activeStops.length), 0);
  const activeTotalDayMinutes = activeStopMinutes + Math.round((activeRouteMetrics?.time ?? (activeDay.hours || 0) * 3600) / 60);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setGlitchShift((Math.random() - 0.5) * 24);
    }, 1500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const syncViewport = () => {
      const nextIsMobile = media.matches;
      setIsMobile(nextIsMobile);
      if (!nextIsMobile) setMobileScreen("detail");
    };

    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  function handleDayChange(dayId) {
    setActiveDayId(dayId);
    if (isMobile) setMobileScreen("detail");
  }

  function handleRouteInfoChange(dayId, routeInfo) {
    setRouteMetricsByDay((current) => ({
      ...current,
      [dayId]: routeInfo
    }));
  }

  function handleStopsChange(dayId, stops) {
    setStopsByDay((current) => {
      const prev = current[dayId];
      if (sameStopsList(prev, stops)) return current;
      return {
        ...current,
        [dayId]: stops
      };
    });
  }

  function goPrevDay() {
    if (canPrev) handleDayChange(ROADBOOK_DAYS[activeIndex - 1].id);
  }

  function goNextDay() {
    if (canNext) handleDayChange(ROADBOOK_DAYS[activeIndex + 1].id);
  }

  const showTimeline = !isMobile || mobileScreen === "timeline";
  const showDetail = !isMobile || mobileScreen === "detail";

  return (
    <main
      className="roadbook-shell glitch-layer min-h-screen overflow-hidden"
      style={{
        "--glitch-shift": `${glitchShift.toFixed(1)}px`,
        backgroundImage: activeDay.scene.gradient
      }}
    >
      <div className="noise-mask" />
      <div className="relative mx-auto flex min-h-screen max-w-[1680px] flex-col px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
        {showDetail && (
          <header className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.7fr,1fr,1fr,1fr]">
            <div className="panel rounded-[24px] p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-white/50">动态路书</div>
                  <h1 className="mt-3 max-w-[14ch] text-2xl font-semibold leading-tight text-white sm:max-w-none sm:text-3xl">
                    丽江 -&gt; 乌鲁木齐 / 28 天家庭自驾
                  </h1>
                </div>
                <div className="w-fit rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs tracking-[0.22em] text-accent">
                  {activeDay.scene.label}
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-white/60 sm:flex sm:flex-wrap sm:gap-3">
                <span>给家里人看你每天开到哪儿了</span>
                <span>按天查看，地图优先展示当天路线</span>
              </div>
            </div>

            <StatCard icon={Mountain} label="预计海拔" value={`${activeDay.estimatedAltitude.toLocaleString()} m`} />
            <StatCard
              icon={activeDay.transport === "flight" ? Plane : Route}
              label={activeDay.transport === "flight" ? "当天交通" : "当日里程"}
              value={activeDay.transport === "flight" ? "飞机" : formatRouteDistance(activeRouteMetrics, activeDay.distance)}
              accent={activeDay.transport === "flight" ? "text-sky-100" : activeDay.distance >= 600 ? "text-warning" : "text-accentAlt"}
            />
            <StatCard icon={Gauge} label="累计里程" value={`${totalDistance.toLocaleString()} km`} accent="text-white" />
          </header>
        )}

        <div className="grid flex-1 gap-4 lg:grid-cols-[360px,minmax(0,1fr)] xl:grid-cols-[400px,minmax(0,1fr)]">
          {showTimeline && <Timeline activeDayId={activeDayId} onActiveDayChange={handleDayChange} />}

          {showDetail && (
            <section className="space-y-4">
              {isMobile && (
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setMobileScreen("timeline")} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white/80">
                    <List className="h-4 w-4" />
                    日期列表
                  </button>
                  <button type="button" onClick={goPrevDay} disabled={!canPrev} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white/80 disabled:cursor-not-allowed disabled:opacity-50">
                    <ChevronLeft className="h-4 w-4" />
                    上一天
                  </button>
                  <button type="button" onClick={goNextDay} disabled={!canNext} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white/80 disabled:cursor-not-allowed disabled:opacity-50">
                    下一天
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              <DailyPlanningPanel activeDay={activeDay} activeStops={activeStops} driveMinutes={Math.round((activeRouteMetrics?.time ?? (activeDay.hours || 0) * 3600) / 60)} stopMinutes={activeStopMinutes} totalMinutes={activeTotalDayMinutes} />

              <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
                <MapPanel activeDay={activeDay} days={ROADBOOK_DAYS} onRouteInfoChange={handleRouteInfoChange} onStopsChange={handleStopsChange} />

                <div className="panel rounded-[24px] p-4 sm:p-5 sm:rounded-[28px]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-white/50">当日看板</div>
                      <div className="mt-3 text-lg font-semibold text-white sm:text-xl">{`DAY ${String(activeDay.day).padStart(2, "0")} // ${activeDay.title}`}</div>
                    </div>
                    {activeDay.transport === "flight" ? <Plane className="h-5 w-5 shrink-0 text-white/60" /> : <Activity className="h-5 w-5 shrink-0 text-white/60" />}
                  </div>

                  {!isMobile && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button type="button" onClick={goPrevDay} disabled={!canPrev} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white/80 disabled:cursor-not-allowed disabled:opacity-50">
                        <ChevronLeft className="h-4 w-4" />
                        上一天
                      </button>
                      <button type="button" onClick={goNextDay} disabled={!canNext} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white/80 disabled:cursor-not-allowed disabled:opacity-50">
                        下一天
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="panel-soft rounded-2xl p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">{activeDay.transport === "flight" ? "当天交通" : "驾驶时长"}</div>
                      <div className="mt-2 text-lg text-white">{activeDay.transport === "flight" ? "飞机往返" : formatRouteHours(activeRouteMetrics, activeDay.hours)}</div>
                    </div>
                    <div className="panel-soft rounded-2xl p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">海拔系数</div>
                      <div className="mt-2 text-lg text-white">{activeDay.altitudeFactor.toFixed(2)}</div>
                    </div>
                  </div>

                  {activeDay.transport !== "flight" ? (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="panel-soft rounded-2xl p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">预计游玩时长</div>
                        <div className="mt-2 text-lg text-white">{formatMinutesAsHours(activeStopMinutes)}</div>
                      </div>
                      <div className="panel-soft rounded-2xl p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">整天预计耗时</div>
                        <div className="mt-2 text-lg text-white">{formatMinutesAsHours(activeTotalDayMinutes)}</div>
                      </div>
                    </div>
                  ) : null}

                  <div className={`mt-4 rounded-2xl border p-4 ${activeDay.fatigueLevel === "critical" ? "warning-pulse border-warning/40 bg-warning/10" : "border-white/10 bg-white/5"}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">疲劳指数</div>
                        <div className={`mt-2 text-3xl font-semibold ${statusTone(activeDay.fatigueLevel)}`}>{activeDay.fatigue.toFixed(2)}</div>
                      </div>
                      <div className={`rounded-full border px-3 py-1 text-xs tracking-[0.18em] ${activeDay.fatigueLevel === "critical" ? "border-warning/50 text-warning" : "border-white/10 text-white/70"}`}>
                        {activeDay.statusLabel}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/65">
                      {activeDay.transport === "flight"
                        ? "这一天是航班行程，不纳入驾车导航和里程规划。"
                        : `疲劳指数 = (${activeDay.distance || 0} / 100) x (${activeDay.hours || 0} / 5) x ${activeDay.altitudeFactor.toFixed(2)}`}
                    </p>
                  </div>

                  <div className="mt-4 panel-soft rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/50">
                      <Link2 className="h-4 w-4" />
                      分享建议
                    </div>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-white/75">
                      <p>页面现在按“当天视角”收口，适合直接发给家里人看每天进度。</p>
                      <p>下面这些内容都改成折叠块，后续继续加功能时不会把页面拉得太长。</p>
                    </div>
                  </div>
                </div>
              </div>

              <SectionBlock kicker="路线说明" title="当天线路备注" defaultOpen meta={`DAY ${String(activeDay.day).padStart(2, "0")}`}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeDay.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="panel-soft rounded-2xl p-4"
                  >
                    <div className="text-sm leading-7 text-white/80">{activeDay.routeText}</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {activeStops.map((stop, index) => {
                        const category = getStopCategory(stop, activeDay, index, activeStops.length);
                        return <StopBadge key={`${activeDay.id}-${getStopName(stop)}-${index}`} stop={stop} category={category} />;
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </SectionBlock>

              <SectionBlock kicker="沿途亮点" title="当天风景节点" meta={`${activeDay.highlights.length} 个点位`}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {activeDay.highlights.map((item, index) => (
                    <HighlightCard key={`${activeDay.id}-${item.name}-${index}`} item={item} index={index} />
                  ))}
                </div>
              </SectionBlock>

              <SectionBlock kicker="同行成员" title="车上成员" meta={`${activeDay.crew.length} 人同行`}>
                <div className="rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-white/80">{activeDay.crewEvent}</div>
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {activeDay.crew.map((member, index) => (
                    <CrewCard key={`${activeDay.id}-${member.id}-${index}`} member={member} index={index} />
                  ))}
                </div>
              </SectionBlock>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
