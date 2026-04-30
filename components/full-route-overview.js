"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, MapPinned, Mountain, Plane, Route } from "lucide-react";
import { PLACE_META } from "@/lib/place-data";

const ROUTE_CACHE_KEY = "dynamic-roadbook-route-cache-v6";
const ROUTE_OVERRIDE_KEY = "dynamic-roadbook-route-overrides-v3";

function loadJson(key, fallback = {}) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeCoord(coord) {
  if (!Array.isArray(coord) || coord.length < 2) return null;
  const lng = Number(coord[0]);
  const lat = Number(coord[1]);
  if (Number.isNaN(lng) || Number.isNaN(lat)) return null;
  return [lng, lat];
}

function normalizeStop(stop) {
  if (typeof stop === "string") {
    return {
      name: stop,
      coord: normalizeCoord(PLACE_META[stop]?.coord),
      altitude: PLACE_META[stop]?.altitude || 0
    };
  }

  if (!stop || typeof stop !== "object") return null;
  const coord = normalizeCoord(stop.coord) || normalizeCoord(PLACE_META[stop.name]?.coord);

  return {
    name: stop.name || "未命名地点",
    coord,
    altitude: PLACE_META[stop.name]?.altitude || 0
  };
}

function serializeStop(stop) {
  const item = normalizeStop(stop);
  if (!item) return "";
  if (!item.coord) return item.name;
  return `${item.name}@${item.coord[0].toFixed(6)},${item.coord[1].toFixed(6)}`;
}

function normalizePathPoint(point) {
  if (!point) return null;
  if (Array.isArray(point) && point.length >= 2) return normalizeCoord(point);
  if (typeof point.lng === "number" && typeof point.lat === "number") return [point.lng, point.lat];
  if (typeof point.getLng === "function" && typeof point.getLat === "function") return [point.getLng(), point.getLat()];
  return null;
}

function getOverrideKey(dayId, stops) {
  return `${dayId}::${stops.map(serializeStop).join(">")}`;
}

function buildRouteDays(days, overrides) {
  return days
    .map((day) => {
      const stops = overrides?.[day.id] || day.stops || [];
      const points = stops.map(normalizeStop).filter((item) => item?.coord);
      const deduped = points.filter((point, index, items) => index === 0 || items[index - 1].name !== point.name);
      if (deduped.length < 2) return null;

      return {
        id: day.id,
        day: day.day,
        stops,
        transport: day.transport,
        distance: day.distance || 0,
        points: deduped
      };
    })
    .filter(Boolean);
}

function uniqueRoutePoints(daySegments) {
  return daySegments
    .flatMap((segment) => segment.points)
    .filter((point, index, items) => index === 0 || items[index - 1].name !== point.name);
}

function pickAnchorIndexes(points) {
  if (points.length <= 7) return points.map((_, index) => index);
  return [...new Set([0, 0.14, 0.28, 0.44, 0.62, 0.8, 1].map((ratio) => Math.round((points.length - 1) * ratio)))];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createMarkerContent(index, name, isAnchor) {
  const safeName = escapeHtml(name);

  return `
    <div style="display:flex;align-items:center;gap:8px;transform:translate(-50%,-100%);">
      <div style="display:flex;height:24px;min-width:24px;align-items:center;justify-content:center;border-radius:999px;background:${isAnchor ? "#d6b46e" : "#24555e"};color:#061018;font-size:12px;font-weight:800;box-shadow:0 10px 24px rgba(8,18,24,.32);">
        ${index + 1}
      </div>
      ${isAnchor ? `<div style="max-width:132px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(10,20,26,.88);padding:6px 10px;color:#fff;font-size:12px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeName}</div>` : ""}
    </div>
  `;
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

function RouteList({ segments }) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {segments.slice(0, 12).map((segment) => (
        <div key={segment.id} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/72">
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/90">Day {segment.day}</span>
            <span className={segment.transport === "flight" ? "text-sky-200" : "text-accent"}>{segment.transport === "flight" ? "航班" : `${segment.distance.toLocaleString()} km`}</span>
          </div>
          <div className="mt-2 truncate text-xs text-white/50">
            {segment.points.map((point) => point.name).join(" - ")}
          </div>
        </div>
      ))}
    </div>
  );
}

function AmapRouteOverview({ route }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const overlaysRef = useRef([]);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const amapKey = process.env.NEXT_PUBLIC_AMAP_KEY;
  const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;

  useEffect(() => {
    if (!amapKey || !mapRef.current) {
      setIsLoading(false);
      return;
    }

    let disposed = false;
    setIsLoading(true);
    window._AMapSecurityConfig = securityCode ? { securityJsCode: securityCode } : window._AMapSecurityConfig || {};

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
          zoom: 4.8,
          zooms: [4.4, 18],
          center: route.points[0]?.coord || [91.5, 34.5],
          pitch: 0,
          terrain: false,
          resizeEnable: true,
          dragEnable: true,
          zoomEnable: true,
          scrollWheel: true,
          doubleClickZoom: true,
          keyboardEnable: true
        });

        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar({ position: "RB" }));
        map.setStatus?.({
          dragEnable: true,
          zoomEnable: true,
          scrollWheel: true,
          doubleClickZoom: true,
          keyboardEnable: true
        });
        mapInstanceRef.current = map;
        drawRoute(AMap, map, route);
        setLoadError("");
        setIsLoading(false);
      })
      .catch((error) => {
        if (disposed) return;
        setLoadError(error?.message || "AMap failed to load");
        setIsLoading(false);
      });

    return () => {
      disposed = true;
      overlaysRef.current.forEach((overlay) => overlay?.setMap?.(null));
      overlaysRef.current = [];
      mapInstanceRef.current?.destroy?.();
      mapInstanceRef.current = null;
    };
  }, [amapKey, securityCode, route]);

  function drawRoute(AMap, map, nextRoute) {
    overlaysRef.current.forEach((overlay) => overlay?.setMap?.(null));
    overlaysRef.current = [];

    const cache = loadJson(ROUTE_CACHE_KEY, {});
    const overlays = [];

    nextRoute.segments.forEach((segment) => {
      const cached = cache[getOverrideKey(segment.id, segment.stops)];
      const cachedPath = Array.isArray(cached?.path) ? cached.path.map(normalizePathPoint).filter(Boolean) : [];
      const fallbackPath = segment.points.map((point) => point.coord);
      const path = cachedPath.length > 1 && segment.transport !== "flight" ? cachedPath : fallbackPath;

      const polyline = new AMap.Polyline({
        path,
        bubble: true,
        strokeColor: segment.transport === "flight" ? "#98d4ff" : cachedPath.length > 1 ? "#d6b46e" : "#74b8b0",
        strokeWeight: segment.transport === "flight" ? 4 : 6,
        strokeOpacity: 0.92,
        strokeStyle: segment.transport === "flight" ? "dashed" : "solid",
        strokeDasharray: segment.transport === "flight" ? [14, 12] : undefined,
        lineJoin: "round",
        lineCap: "round",
        showDir: segment.transport !== "flight" && cachedPath.length > 1
      });

      polyline.setMap(map);
      overlays.push(polyline);
    });

    const anchorIndexes = new Set(route.anchors.map((anchor) => anchor.index));
    nextRoute.points.forEach((point, index) => {
      const marker = new AMap.Marker({
        position: point.coord,
        anchor: "bottom-center",
        bubble: true,
        content: createMarkerContent(index, point.name, anchorIndexes.has(index))
      });
      marker.setMap(map);
      overlays.push(marker);
    });

    overlaysRef.current = overlays;
    map.setFitView(overlays, false, [24, 28, 24, 28]);
    if (map.getZoom?.() < 4.4) map.setZoom(4.4);
  }

  if (!amapKey || loadError) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-2 text-sm text-amber-100">
          <MapPinned className="h-4 w-4" />
          {amapKey ? "高德总览加载失败，下面保留真实坐标节点列表。" : "还没有配置高德 Key，下面保留真实坐标节点列表。"}
        </div>
        <div className="mt-4">
          <RouteList segments={route.segments} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#081018]">
      <div ref={mapRef} className="h-[420px] w-full touch-none sm:h-[560px]" />
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#081018]/72 text-sm text-white/70">
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          正在加载高德总览地图
        </div>
      ) : null}
      <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-xs text-white/72 backdrop-blur">
        <div className="font-medium text-white">高德全程路线总览</div>
        <div className="mt-1">金色为已缓存导航线，绿色为坐标连线，蓝色虚线为航班切换。</div>
      </div>
    </div>
  );
}

export default function FullRouteOverview({ days }) {
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    setOverrides(loadJson(ROUTE_OVERRIDE_KEY, {}));
  }, []);

  const route = useMemo(() => {
    const segments = buildRouteDays(days, overrides);
    const points = uniqueRoutePoints(segments);

    return {
      points,
      anchors: pickAnchorIndexes(points).map((index) => ({ ...points[index], index })),
      segments,
      driveDistance: days.filter((day) => day.transport !== "flight").reduce((sum, day) => sum + (day.distance || 0), 0),
      highestAltitude: Math.max(0, ...points.map((point) => point.altitude || 0)),
      stopCount: points.length
    };
  }, [days, overrides]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">全程路线图</div>
          <div className="mt-2 text-xl font-semibold text-white">接入高德底图的全程总览</div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/68">
            这里用高德地图承载全程节点和路线。已经打开过的驾车日会优先使用本地缓存的高德导航路径，没缓存的路段先用坐标连线补齐，不再用手画中国轮廓当底图。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-white/62">
          <div className="rounded-full border border-[#d6b46e]/25 bg-[#d6b46e]/10 px-3 py-2 text-[#f4d58e]">金色：高德导航缓存</div>
          <div className="rounded-full border border-[#74b8b0]/25 bg-[#74b8b0]/10 px-3 py-2 text-[#bce9e2]">绿色：坐标连线</div>
          <div className="rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-sky-100">蓝色虚线：航班</div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Metric icon={Route} label="驾驶总里程" value={`${route.driveDistance.toLocaleString()} km`} tone="text-accent" />
        <Metric icon={Plane} label="路线节点" value={`${route.stopCount} 站`} tone="text-accentAlt" />
        <Metric icon={Mountain} label="最高节点海拔" value={`${route.highestAltitude.toLocaleString()} m`} tone="text-sky-100" />
      </div>

      <AmapRouteOverview route={route} />
    </div>
  );
}
