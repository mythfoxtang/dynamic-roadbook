"use client";

import { useMemo } from "react";
import { Mountain, Plane, Route } from "lucide-react";
import { PLACE_META } from "@/lib/place-data";

const MAP_WIDTH = 1280;
const MAP_HEIGHT = 820;
const MAP_PADDING_X = 128;
const MAP_PADDING_Y = 118;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildRouteDays(days) {
  return days
    .map((day) => {
      const points = (day.stops || [])
        .map((name) => {
          const meta = PLACE_META[name];
          return meta?.coord ? { name, coord: meta.coord, altitude: meta.altitude } : null;
        })
        .filter(Boolean);

      const deduped = points.filter((point, index, items) => index === 0 || items[index - 1].name !== point.name);
      if (deduped.length < 2) return null;

      return {
        id: day.id,
        day: day.day,
        transport: day.transport,
        distance: day.distance || 0,
        points: deduped
      };
    })
    .filter(Boolean);
}

function uniqueRoutePoints(daySegments) {
  return daySegments.flatMap((segment) => segment.points).filter((point, index, items) => index === 0 || items[index - 1].name !== point.name);
}

function projectPoints(points) {
  const lons = points.map((point) => point.coord[0]);
  const lats = points.map((point) => point.coord[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lonSpan = Math.max(1, maxLon - minLon);
  const latSpan = Math.max(1, maxLat - minLat);

  return points.map((point) => {
    const normalizedX = (point.coord[0] - minLon) / lonSpan;
    const normalizedY = (point.coord[1] - minLat) / latSpan;

    return {
      ...point,
      x: MAP_PADDING_X + normalizedX * (MAP_WIDTH - MAP_PADDING_X * 2),
      y: MAP_HEIGHT - MAP_PADDING_Y - normalizedY * (MAP_HEIGHT - MAP_PADDING_Y * 2)
    };
  });
}

function segmentPath(points) {
  if (points.length < 2) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function pickAnchorIndexes(points) {
  if (points.length <= 7) return points.map((_, index) => index);
  const raw = [0, 0.14, 0.28, 0.44, 0.62, 0.8, 1]
    .map((ratio) => Math.round((points.length - 1) * ratio))
    .map((index) => clamp(index, 0, points.length - 1));

  return [...new Set(raw)];
}

function Metric({ icon: Icon, label, value, tone = "text-white" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</div>
          <div className={`mt-2 text-lg font-semibold ${tone}`}>{value}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-white/70">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export default function FullRouteOverview({ days }) {
  const route = useMemo(() => {
    const daySegments = buildRouteDays(days);
    const routePoints = uniqueRoutePoints(daySegments);
    const plotted = projectPoints(routePoints);
    const plottedByName = new Map(plotted.map((point) => [point.name, point]));

    const segments = daySegments.map((segment) => ({
      ...segment,
      plotted: segment.points.map((point) => plottedByName.get(point.name)).filter(Boolean)
    }));

    return {
      points: plotted,
      anchors: pickAnchorIndexes(plotted).map((index) => ({ ...plotted[index], index })),
      segments,
      driveDistance: days.filter((day) => day.transport !== "flight").reduce((sum, day) => sum + (day.distance || 0), 0),
      highestAltitude: Math.max(...plotted.map((point) => point.altitude || 0)),
      stopCount: plotted.length
    };
  }, [days]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">全程路线图</div>
          <div className="mt-2 text-xl font-semibold text-white">补充总览，不替代主地图</div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/68">
            这张图主要看全程空间跨度和路线节奏。上面是中国版图轮廓，飞行段用虚线，驾驶段用主线发光。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-white/62">
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2">虚线：飞行切换</div>
          <div className="rounded-full border border-accent/25 bg-accent/10 px-3 py-2 text-accent">实线：驾驶主线</div>
          <div className="rounded-full border border-accentAlt/25 bg-accentAlt/10 px-3 py-2 text-emerald-100">节点：关键站点</div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Metric icon={Route} label="驾驶总里程" value={`${route.driveDistance.toLocaleString()} km`} tone="text-accent" />
        <Metric icon={Plane} label="路线节点" value={`${route.stopCount} 站`} tone="text-accentAlt" />
        <Metric icon={Mountain} label="最高节点海拔" value={`${route.highestAltitude.toLocaleString()} m`} tone="text-sky-100" />
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#081018]">
        <div className="relative aspect-[16/10] w-full">
          <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="h-full w-full">
            <defs>
              <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f7ca7f" />
                <stop offset="50%" stopColor="#d5a15a" />
                <stop offset="100%" stopColor="#77c0b0" />
              </linearGradient>
              <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="8" />
              </filter>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              </pattern>
            </defs>

            <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#081018" />
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#grid)" opacity="0.5" />

            <path
              d="M174 210 L244 172 L318 168 L370 134 L462 148 L550 120 L650 136 L728 120 L812 140 L892 172 L960 164 L1036 206 L1088 270 L1118 350 L1102 430 L1046 492 L986 534 L916 550 L846 584 L772 592 L692 628 L580 630 L508 610 L452 636 L378 624 L320 590 L280 544 L242 500 L220 450 L194 408 L170 356 L164 290 Z"
              fill="rgba(209, 225, 232, 0.08)"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="2.2"
            />
            <path
              d="M1000 610 L1038 596 L1072 608 L1092 636 L1070 664 L1028 658 L1002 632 Z"
              fill="rgba(209, 225, 232, 0.06)"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1.5"
            />
            <path
              d="M264 226 L310 206 L350 196 L414 204 L500 182 L580 178 L664 184 L726 174 L802 192 L868 220 L934 230 L994 270 L1022 328 L1010 390 L970 432 L922 456 L860 476 L794 506 L720 528 L642 540 L586 564 L528 554 L470 580 L412 568 L360 536 L316 492 L280 444 L252 402 L240 346 L242 282 Z"
              fill="rgba(45, 78, 92, 0.16)"
              stroke="rgba(124,163,138,0.18)"
              strokeWidth="1.2"
            />

            {route.segments.map((segment) => (
              <g key={segment.id}>
                <path
                  d={segmentPath(segment.plotted)}
                  fill="none"
                  stroke={segment.transport === "flight" ? "rgba(151,211,255,0.28)" : "rgba(245,196,106,0.24)"}
                  strokeWidth={segment.transport === "flight" ? 10 : 14}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={segment.transport === "flight" ? "18 14" : undefined}
                  filter="url(#routeGlow)"
                />
                <path
                  d={segmentPath(segment.plotted)}
                  fill="none"
                  stroke={segment.transport === "flight" ? "#98d4ff" : "url(#routeGradient)"}
                  strokeWidth={segment.transport === "flight" ? 3.4 : 5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={segment.transport === "flight" ? "12 10" : undefined}
                />
              </g>
            ))}

            {route.points.map((point, index) => (
              <g key={`${point.name}-${index}`}>
                <circle cx={point.x} cy={point.y} r="8" fill="rgba(255,255,255,0.08)" />
                <circle cx={point.x} cy={point.y} r="4.2" fill={index === 0 || index === route.points.length - 1 ? "#f7ca7f" : "#9dd5ff"} />
              </g>
            ))}

            {route.anchors.map((anchor, index) => {
              const side = index % 2 === 0 ? -1 : 1;
              const lx = anchor.x + 18;
              const ly = anchor.y + side * 22;
              return (
                <g key={`${anchor.name}-${index}`}>
                  <path d={`M ${anchor.x} ${anchor.y} L ${lx - 6} ${ly - 6}`} stroke="rgba(255,255,255,0.24)" strokeWidth="1.3" />
                  <rect x={lx - 10} y={ly - 18} rx="14" ry="14" width="120" height="32" fill="rgba(8,18,24,0.84)" stroke="rgba(255,255,255,0.12)" />
                  <text x={lx} y={ly + 2} fill="#f6efe4" fontSize="13" fontFamily="Microsoft YaHei, sans-serif">{anchor.name}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
