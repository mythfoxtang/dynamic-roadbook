"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronDown, ChevronUp, Plane, TriangleAlert } from "lucide-react";
import { ROADBOOK_DAYS } from "@/lib/roadtrip-data";

function riskStyles(level) {
  if (level === "critical") return "border-warning/50 bg-warning/10 text-warning";
  if (level === "high") return "border-accent/40 bg-accent/10 text-accent";
  if (level === "medium") return "border-amber-300/35 bg-amber-300/10 text-amber-300";
  return "border-emerald-300/30 bg-emerald-300/10 text-emerald-300";
}

export default function Timeline({ activeDayId, onActiveDayChange }) {
  const sectionRefs = useRef({});

  useEffect(() => {
    const node = sectionRefs.current[activeDayId];
    node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeDayId]);

  const activeIndex = ROADBOOK_DAYS.findIndex((day) => day.id === activeDayId);
  const canPrev = activeIndex > 0;
  const canNext = activeIndex < ROADBOOK_DAYS.length - 1;

  return (
    <aside className="panel rounded-[24px] p-3 sm:rounded-[28px] lg:h-[calc(100vh-12rem)] lg:overflow-y-auto">
      <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-4 backdrop-blur lg:sticky lg:top-0 lg:z-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">时间线</div>
            <div className="mt-2 text-base font-semibold text-white sm:text-lg">28 天路线总览</div>
          </div>
          <CalendarDays className="h-5 w-5 shrink-0 text-white/40" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => canPrev && onActiveDayChange(ROADBOOK_DAYS[activeIndex - 1].id)}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs tracking-[0.16em] text-white/80 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronUp className="h-4 w-4" />
            前一天
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => canNext && onActiveDayChange(ROADBOOK_DAYS[activeIndex + 1].id)}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs tracking-[0.16em] text-white/80 disabled:cursor-not-allowed disabled:opacity-35"
          >
            后一天
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative mt-4 pl-6 sm:pl-7">
        <div className="absolute bottom-0 left-3 top-0 w-px bg-gradient-to-b from-accent via-accentAlt to-transparent" />

        {ROADBOOK_DAYS.map((day, index) => {
          const isActive = day.id === activeDayId;

          return (
            <motion.button
              key={day.id}
              ref={(node) => {
                sectionRefs.current[day.id] = node;
              }}
              type="button"
              onClick={() => onActiveDayChange(day.id)}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.4, delay: index * 0.018 }}
              className={`relative mb-3 block w-full rounded-2xl border p-4 text-left transition ${
                isActive ? "border-accent/45 bg-white/15 shadow-glow" : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <span
                className={`absolute left-[-18px] top-6 h-4 w-4 rounded-full border-2 ${
                  isActive ? "border-accent bg-accentAlt" : "border-white/20 bg-white/10"
                }`}
              />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/45">{`DAY ${String(day.day).padStart(2, "0")}`}</div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-white sm:text-base">{day.title}</div>
                </div>
                {day.transport === "flight" ? (
                  <Plane className="mt-1 h-4 w-4 shrink-0 text-white/70" />
                ) : day.fatigueLevel === "critical" ? (
                  <TriangleAlert className="mt-1 h-4 w-4 shrink-0 text-warning" />
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/60">
                <span>{day.transport === "flight" ? "飞机日" : day.distance ? `${day.distance} km` : "弹性安排"}</span>
                <span>{day.transport === "flight" ? "不安排驾车" : day.hours ? `${day.hours} h` : "时间机动"}</span>
                <span>{`${day.estimatedAltitude} m`}</span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className={`rounded-full border px-2.5 py-1 text-[11px] tracking-[0.15em] ${riskStyles(day.fatigueLevel)}`}>
                  {day.statusLabel}
                </span>
                <span className="text-xs text-white/38">{day.date ?? "2026-06 / 待定"}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </aside>
  );
}
