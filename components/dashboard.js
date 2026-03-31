"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Gauge, Mountain, Route, Users } from "lucide-react";
import Timeline from "@/components/timeline";
import MapPanel from "@/components/map-panel";
import { ROADBOOK_DAYS } from "@/lib/roadtrip-data";

function StatCard({ icon: Icon, label, value, accent = "text-accent" }) {
  return (
    <div className="panel rounded-2xl p-4 shadow-glow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-white/50">{label}</div>
          <div className={`mt-3 text-2xl font-semibold ${accent}`}>{value}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function statusTone(level) {
  if (level === "critical") return "text-warning";
  if (level === "high") return "text-accent";
  if (level === "medium") return "text-amber-300";
  return "text-emerald-300";
}

function HighlightCard({ item, index }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className="panel-soft overflow-hidden rounded-[24px]"
    >
      <div className="relative aspect-[16/9]">
        <Image src={item.image} alt={item.name} fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/70">
          {item.scene}
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="text-lg font-semibold text-white">{item.name}</div>
          <div className="mt-1 text-sm text-white/70">{item.altitude} m</div>
        </div>
      </div>
      <div className="p-4 text-sm leading-6 text-white/72">{item.summary}</div>
      {item.credit && (
        <div className="border-t border-white/10 px-4 py-3 text-[11px] leading-5 text-white/52">
          <span>{`${item.credit.author} / ${item.credit.license}`}</span>
          <span className="mx-2 text-white/25">|</span>
          <a
            href={item.credit.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:text-white"
          >
            Source
          </a>
        </div>
      )}
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
      <div className="flex h-full items-center gap-4 rounded-2xl bg-[#151515]/95 p-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          <Image src={member.avatar} alt={member.name} fill className="object-cover" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{member.name}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/45">{member.role}</div>
          <div className="mt-2 text-sm leading-6 text-white/65">{member.note}</div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const [activeDayId, setActiveDayId] = useState(ROADBOOK_DAYS[0].id);
  const [glitchShift, setGlitchShift] = useState(0);

  const activeDay = useMemo(
    () => ROADBOOK_DAYS.find((day) => day.id === activeDayId) ?? ROADBOOK_DAYS[0],
    [activeDayId]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setGlitchShift((Math.random() - 0.5) * 24);
    }, 1500);
    return () => window.clearInterval(timer);
  }, []);

  const totalDistance = ROADBOOK_DAYS.reduce((sum, day) => sum + (day.distance || 0), 0);

  return (
    <main
      className="roadbook-shell glitch-layer min-h-screen overflow-hidden"
      style={{
        "--glitch-shift": `${glitchShift.toFixed(1)}px`,
        backgroundImage: activeDay.scene.gradient
      }}
    >
      <div className="noise-mask" />
      <div className="relative mx-auto flex min-h-screen max-w-[1680px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-4 grid gap-3 lg:grid-cols-[1.8fr,1fr,1fr,1fr]">
          <div className="panel rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.36em] text-white/[0.45]">
                  Cyber Rally Roadbook
                </div>
                <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                  Lijiang -&gt; Urumqi / 28-Day Plateau Vector
                </h1>
              </div>
              <div className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-accent">
                {activeDay.scene.label}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/55">
              <span>Audience: Math-minded overlanders</span>
              <span>Mode: Dark / Mechanical / Rally Telemetry</span>
            </div>
          </div>

          <StatCard
            icon={Mountain}
            label="Expected Altitude"
            value={`${activeDay.estimatedAltitude.toLocaleString()} m`}
            accent="text-accent"
          />
          <StatCard
            icon={Route}
            label="Today Distance"
            value={`${activeDay.distance || 0} km`}
            accent={activeDay.distance >= 600 ? "text-warning" : "text-accentAlt"}
          />
          <StatCard
            icon={Gauge}
            label="Total Distance"
            value={`${totalDistance.toLocaleString()} km`}
            accent="text-white"
          />
        </header>

        <div className="grid flex-1 gap-4 lg:grid-cols-[420px,minmax(0,1fr)]">
          <Timeline activeDayId={activeDayId} onActiveDayChange={setActiveDayId} />

          <section className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.25fr,0.75fr]">
              <MapPanel activeDay={activeDay} days={ROADBOOK_DAYS} />

              <div className="panel rounded-[28px] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-white/[0.45]">
                      Stage Telemetry
                    </div>
                    <div className="mt-3 text-xl font-semibold text-white">
                      {`DAY ${String(activeDay.day).padStart(2, "0")} // ${activeDay.title}`}
                    </div>
                  </div>
                  <Activity className="h-5 w-5 text-white/50" />
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="panel-soft rounded-2xl p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">Drive Window</div>
                    <div className="mt-2 text-lg text-white">{activeDay.hours || 0} h</div>
                  </div>
                  <div className="panel-soft rounded-2xl p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">Altitude Factor</div>
                    <div className="mt-2 text-lg text-white">{activeDay.altitudeFactor.toFixed(2)}</div>
                  </div>
                </div>

                <div
                  className={`mt-4 rounded-2xl border p-4 ${
                    activeDay.fatigueLevel === "critical"
                      ? "warning-pulse border-warning/40 bg-warning/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">Fatigue Index</div>
                      <div className={`mt-2 text-3xl font-semibold ${statusTone(activeDay.fatigueLevel)}`}>
                        {activeDay.fatigue.toFixed(2)}
                      </div>
                    </div>
                    <div
                      className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.22em] ${
                        activeDay.fatigueLevel === "critical"
                          ? "border-warning/50 text-warning"
                          : "border-white/10 text-white/65"
                      }`}
                    >
                      {activeDay.statusLabel}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/62">
                    {`Fatigue = (${activeDay.distance || 0} / 100) * (${activeDay.hours || 0} / 5) * ${activeDay.altitudeFactor.toFixed(2)}`}
                  </p>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeDay.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="mt-4 panel-soft rounded-2xl p-4"
                  >
                    <div className="text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">Route Script</div>
                    <div className="mt-3 text-sm leading-7 text-white/78">{activeDay.routeText}</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {activeDay.stops.map((stop) => (
                        <span
                          key={`${activeDay.id}-${stop}`}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65"
                        >
                          {stop}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <section className="panel rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.28em] text-white/[0.45]">
                    Scenic Highlights
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    中间景点已经带图展示
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/60">
                  {activeDay.highlights.length} spots
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {activeDay.highlights.map((item, index) => (
                  <HighlightCard key={`${activeDay.id}-${item.name}`} item={item} index={index} />
                ))}
              </div>
            </section>

            <section className="panel rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.28em] text-white/[0.45]">Crew Manifest</div>
                  <div className="mt-2 text-xl font-semibold text-white">车上成员</div>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/65">
                  <Users className="h-4 w-4" />
                  <span>{`${activeDay.crew.length} onboard`}</span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-white/78">
                {activeDay.crewEvent}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {activeDay.crew.map((member, index) => (
                  <CrewCard key={`${activeDay.id}-${member.id}`} member={member} index={index} />
                ))}
              </div>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
