"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinned, Radar, Signal } from "lucide-react";
import { PLACE_META } from "@/lib/place-data";

function projectPoint([lng, lat], bounds, width, height) {
  const paddingX = 72;
  const paddingY = 54;
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng || 1)) * (width - paddingX * 2) + paddingX;
  const y =
    height -
    (((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat || 1)) * (height - paddingY * 2) + paddingY);
  return { x, y };
}

function getSegmentPoints(day) {
  return day.stops
    .map((stop) => {
      const coord = PLACE_META[stop]?.coord;
      return coord ? { name: stop, coord } : null;
    })
    .filter(Boolean);
}

function isValidCoord(coord) {
  return (
    Array.isArray(coord) &&
    coord.length === 2 &&
    typeof coord[0] === "number" &&
    Number.isFinite(coord[0]) &&
    typeof coord[1] === "number" &&
    Number.isFinite(coord[1])
  );
}

function sanitizePoints(points) {
  return points.filter((item) => isValidCoord(item?.coord));
}

function getBounds(points) {
  const allPoints = points.length
    ? points.map((item) => item.coord)
    : Object.values(PLACE_META)
        .map((item) => item.coord)
        .filter(Boolean);

  return {
    minLng: Math.min(...allPoints.map((point) => point[0])) - 2.5,
    maxLng: Math.max(...allPoints.map((point) => point[0])) + 2.5,
    minLat: Math.min(...allPoints.map((point) => point[1])) - 1.8,
    maxLat: Math.max(...allPoints.map((point) => point[1])) + 1.8
  };
}

function uniqByName(points) {
  return points.filter((point, index, array) => index === array.findIndex((item) => item.name === point.name));
}

function OfflineMap({ activeDay, days }) {
  const width = 920;
  const height = 620;
  const activePoints = sanitizePoints(getSegmentPoints(activeDay));
  const bounds = getBounds(days.flatMap((day) => getSegmentPoints(day)));
  const routePoints = uniqByName(sanitizePoints(days.flatMap((day) => getSegmentPoints(day))));
  const allProjected = routePoints.map((point) => ({
    ...point,
    ...projectPoint(point.coord, bounds, width, height)
  }));
  const stageProjected = activePoints.map((point) => ({
    ...point,
    ...projectPoint(point.coord, bounds, width, height)
  }));
  const fullRoutePolyline = allProjected.map((point) => `${point.x},${point.y}`).join(" ");
  const polyline = stageProjected.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="relative mt-5 overflow-hidden rounded-[24px] border border-white/[0.08] bg-slate-900/60">
      <svg viewBox={`0 0 ${width} ${height}`} className="aspect-[1.48/1] w-full">
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="rgba(148,163,184,0.12)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0)" />
          </radialGradient>
          <linearGradient id="baseRoute" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#c084fc" stopOpacity="0.26" />
          </linearGradient>
          <linearGradient id="activeRoute" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
        </defs>

        <rect width={width} height={height} fill="rgba(15,23,42,0.78)" />
        <rect width={width} height={height} fill="url(#mapGlow)" />

        {Array.from({ length: 10 }).map((_, index) => (
          <line
            key={`h-${index}`}
            x1="0"
            x2={width}
            y1={index * 62}
            y2={index * 62}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: 12 }).map((_, index) => (
          <line
            key={`v-${index}`}
            y1="0"
            y2={height}
            x1={index * 76}
            x2={index * 76}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}

        {allProjected.length > 1 && (
          <polyline
            points={fullRoutePolyline}
            fill="none"
            stroke="url(#baseRoute)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {allProjected.map((point) => (
          <g key={`ghost-${point.name}`}>
            <circle cx={point.x} cy={point.y} r="5" fill="rgba(255,255,255,0.14)" />
            <circle cx={point.x} cy={point.y} r="1.8" fill="rgba(255,255,255,0.6)" />
          </g>
        ))}

        {stageProjected.length > 1 && (
          <polyline
            points={polyline}
            fill="none"
            stroke="url(#activeRoute)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {stageProjected.map((point) => (
          <g key={`${activeDay.id}-${point.name}`}>
            <circle cx={point.x} cy={point.y} r="14" fill="rgba(255,122,24,0.18)" />
            <circle cx={point.x} cy={point.y} r="7" fill="rgba(255,255,255,0.25)" />
            <circle cx={point.x} cy={point.y} r="4.5" fill="#ff7a18" />
            <text x={point.x + 10} y={point.y - 10} fill="rgba(255,255,255,0.78)" fontSize="14">
              {point.name}
            </text>
          </g>
        ))}
      </svg>

      <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/65">
        offline fallback
      </div>
    </div>
  );
}

function LiveAmap({ activeDay, days }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const overlaysRef = useRef([]);
  const [loadError, setLoadError] = useState("");
  const amapKey = process.env.NEXT_PUBLIC_AMAP_KEY;
  const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;

  const allPoints = uniqByName(days.flatMap((day) => getSegmentPoints(day)));
  const stagePoints = sanitizePoints(getSegmentPoints(activeDay));
  const safeAllPoints = uniqByName(sanitizePoints(allPoints));

  useEffect(() => {
    if (!amapKey || !mapRef.current) return;

    let disposed = false;
    window._AMapSecurityConfig = securityCode
      ? { securityJsCode: securityCode }
      : window._AMapSecurityConfig || {};

    import("@amap/amap-jsapi-loader")
      .then(({ default: AMapLoader }) =>
        AMapLoader.load({
          key: amapKey,
          version: "2.0",
          plugins: ["AMap.Scale", "AMap.ToolBar"]
        })
      )
      .then((AMap) => {
        if (disposed || !mapRef.current) return;

        const map = new AMap.Map(mapRef.current, {
          viewMode: "3D",
          mapStyle: "amap://styles/darkblue",
          zoom: 5.6,
          center: [88.5, 34.2],
          pitch: 0,
          terrain: false
        });

        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar({ position: "RB" }));
        mapInstanceRef.current = map;
      })
      .catch((error) => {
        setLoadError(error?.message || "AMap failed to load");
      });

    return () => {
      disposed = true;
      overlaysRef.current.forEach((item) => item?.setMap?.(null));
      overlaysRef.current = [];
      mapInstanceRef.current?.destroy?.();
      mapInstanceRef.current = null;
    };
  }, [amapKey, securityCode]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const AMap = window.AMap;
    if (!AMap) return;

    overlaysRef.current.forEach((item) => item?.setMap?.(null));
    overlaysRef.current = [];

    const createdOverlays = [];

    if (safeAllPoints.length >= 2) {
      createdOverlays.push(
        new AMap.Polyline({
          path: safeAllPoints.map((item) => item.coord),
          strokeColor: "#60a5fa",
          strokeOpacity: 0.45,
          strokeWeight: 4
        })
      );
    }

    if (stagePoints.length >= 2) {
      createdOverlays.push(
        new AMap.Polyline({
          path: stagePoints.map((item) => item.coord),
          strokeColor: "#ff7a18",
          strokeOpacity: 0.95,
          strokeWeight: 6,
          showDir: true
        })
      );
    }

    const stageMarkers = stagePoints.map(
      (item) =>
        new AMap.Marker({
          position: item.coord,
          title: item.name,
          label: {
            direction: "top",
            content: `<div style="padding:4px 8px;border-radius:999px;background:rgba(18,18,18,.85);border:1px solid rgba(255,255,255,.12);color:#fff;font-size:12px;">${item.name}</div>`
          }
        })
    );

    const allMarkers = safeAllPoints.map(
      (item) =>
        new AMap.CircleMarker({
          center: item.coord,
          radius: 5,
          strokeColor: "#cbd5e1",
          strokeWeight: 1,
          strokeOpacity: 0.4,
          fillColor: "#e2e8f0",
          fillOpacity: 0.2
        })
    );

    map.add([...createdOverlays, ...allMarkers, ...stageMarkers]);
    overlaysRef.current = [...createdOverlays, ...allMarkers, ...stageMarkers];

    const focusCoords = stagePoints.length ? stagePoints.map((item) => item.coord) : safeAllPoints.map((item) => item.coord);
    if (focusCoords.length) {
      map.setFitView(overlaysRef.current, false, [80, 80, 80, 80], 16);
    }
  }, [activeDay.id, safeAllPoints, stagePoints]);

  if (!amapKey || loadError) {
    return (
      <div className="mt-5 rounded-[24px] border border-white/[0.08] bg-slate-900/40 p-4 text-sm text-white/65">
        <div className="font-medium text-white">Live map unavailable</div>
        <div className="mt-2 leading-6">
          {loadError || "Set NEXT_PUBLIC_AMAP_KEY to enable AMap JSAPI. The panel is using the offline fallback below."}
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className="mt-5 h-[520px] overflow-hidden rounded-[24px] border border-white/[0.08]" />;
}

export default function MapPanel({ activeDay, days }) {
  const bounds = getBounds(days.flatMap((day) => getSegmentPoints(day)));

  return (
    <div className="panel relative overflow-hidden rounded-[28px] p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />

      <div className="relative flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-white/[0.45]">Supported Map Layer</div>
          <div className="mt-2 text-xl font-semibold text-white">AMap JSAPI with offline fallback</div>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/[0.45]">
          <Signal className="h-4 w-4" />
          <span>{process.env.NEXT_PUBLIC_AMAP_KEY ? "amap ready" : "fallback mode"}</span>
        </div>
      </div>

      <LiveAmap activeDay={activeDay} days={days} />
      {!process.env.NEXT_PUBLIC_AMAP_KEY && <OfflineMap activeDay={activeDay} days={days} />}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="panel-soft rounded-2xl p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/[0.45]">
            <MapPinned className="h-4 w-4" />
            Stage Stops
          </div>
          <div className="mt-3 text-lg text-white">{activeDay.stops.length}</div>
        </div>
        <div className="panel-soft rounded-2xl p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/[0.45]">
            <Radar className="h-4 w-4" />
            Route Extent
          </div>
          <div className="mt-3 text-lg text-white">
            {`${(bounds.maxLng - bounds.minLng).toFixed(1)}° x ${(bounds.maxLat - bounds.minLat).toFixed(1)}°`}
          </div>
        </div>
        <div className="panel-soft rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/[0.45]">Atmosphere</div>
          <div className="mt-3 text-lg text-white">{activeDay.scene.label}</div>
        </div>
      </div>
    </div>
  );
}
