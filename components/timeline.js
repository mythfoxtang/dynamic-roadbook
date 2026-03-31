"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronDown, ChevronUp, TriangleAlert } from "lucide-react";
import { ROADBOOK_DAYS } from "@/lib/roadtrip-data";

function riskStyles(level) {
  if (level === "critical") return "border-warning/50 bg-warning/10 text-warning";
  if (level === "high") return "border-accent/40 bg-accent/10 text-accent";
  if (level === "medium") return "border-amber-300/35 bg-amber-300/10 text-amber-300";
  return "border-emerald-300/30 bg-emerald-300/10 text-emerald-300";
}

export default function Timeline({ activeDayId, onActiveDayChange }) {
  const sectionRefs = useRef({});
  const containerRef = useRef(null);

  useEffect(() => {
    const node = sectionRefs.current[activeDayId];
    node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeDayId]);

  const activeIndex = ROADBOOK_DAYS.findIndex((day) => day.id === activeDayId);
  const canPrev = activeIndex > 0;
  const canNext = activeIndex < ROADBOOK_DAYS.length - 1;

  return (
    <aside ref={containerRef} className="panel scrollbar-thin rounded-[28px] p-3 lg:h-[calc(100vh-12rem)] lg:overflow-y-auto">
      <div className="sticky top-0 z-10 rounded-2xl border border-white/[0.06] bg-black/20 px-3 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-white/[0.45]">Timeline Feed</div>
            <div className="mt-2 text-lg font-semibold text-white">28-Day Stage Matrix</div>
          </div>
          <CalendarDays className="h-5 w-5 text-white/40" />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => canPrev && onActiveDayChange(ROADBOOK_DAYS[activeIndex - 1].id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/70 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronUp className="h-4 w-4" />
            Prev Day
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => canNext && onActiveDayChange(ROADBOOK_DAYS[activeIndex + 1].id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/70 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Next Day
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative mt-4 pl-7">
        <div className="absolute bottom-0 left-3 top-0 w-px bg-gradient-to-b from-accent via-accentAlt to-transparent" />

        {ROADBOOK_DAYS.map((day, index) => {
          const isActive = day.id === activeDayId;

          return (
            <motion.button
              key={day.id}
              ref={(node) => {
                sectionRefs.current[day.id] = node;
              }}
              data-id={day.id}
              type="button"
              onClick={() => {
                onActiveDayChange(day.id);
                sectionRefs.current[day.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.4, delay: index * 0.018 }}
              className={`relative mb-3 block w-full rounded-2xl border p-4 text-left transition ${
                isActive ? "border-accent/[0.45] bg-white/[0.08] shadow-glow" : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <span
                className={`absolute left-[-22px] top-6 h-4 w-4 rounded-full border-2 ${
                  isActive ? "border-accent bg-accentAlt" : "border-white/20 bg-base"
                }`}
              />

              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-white/40">
                    {`DAY ${String(day.day).padStart(2, "0")}`}
                  </div>
                  <div className="mt-2 text-base font-semibold text-white">{day.title}</div>
                </div>
                {day.fatigueLevel === "critical" && <TriangleAlert className="h-4 w-4 text-warning" />}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/55">
                <span>{day.distance ? `${day.distance} km` : "Flexible stage"}</span>
                <span>{day.hours ? `${day.hours} h` : "Open schedule"}</span>
                <span>{`${day.estimatedAltitude} m`}</span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${riskStyles(day.fatigueLevel)}`}>
                  {day.fatigueLevel}
                </span>
                <span className="text-xs text-white/38">{day.date ?? "2026-06 / TBD"}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </aside>
  );
}
