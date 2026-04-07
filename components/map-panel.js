"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, MapPinned, Plane, Plus, Radar, RotateCcw, RotateCw, Route, Signal, X } from "lucide-react";
import { PLACE_META } from "@/lib/place-data";
import { STOP_CATEGORY_META, STOP_CATEGORY_OPTIONS, inferStopCategory, inferStopDurationMinutes } from "@/lib/stop-categories";

const ROUTE_CACHE_KEY = "dynamic-roadbook-route-cache-v6";
const ROUTE_OVERRIDE_KEY = "dynamic-roadbook-route-overrides-v3";
const CUSTOM_PLACE_LIBRARY_KEY = "dynamic-roadbook-custom-places-v2";
const CURRENT_LOCATION_KEY = "dynamic-roadbook-current-location-v1";

function loadJson(key) {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function formatLocationTimestamp(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatCoord(value, digits = 5) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return value.toFixed(digits);
}

function normalizeStop(stop) {
  if (typeof stop === "string") {
    return {
      name: stop,
      coord: PLACE_META[stop]?.coord ?? null,
      custom: false,
      category: null,
      durationMinutes: null
    };
  }

  if (!stop || typeof stop !== "object") return null;
  const rawCoord = Array.isArray(stop.coord) && stop.coord.length >= 2 ? [Number(stop.coord[0]), Number(stop.coord[1])] : null;
  const metaCoord = stop.name ? PLACE_META[stop.name]?.coord ?? null : null;

  return {
    name: stop.name || "未命名地点",
    coord: rawCoord || metaCoord || null,
    custom: Boolean(stop.custom || rawCoord),
    category: stop.category || null,
    durationMinutes: typeof stop.durationMinutes === "number" ? stop.durationMinutes : null
  };
}

function normalizeCustomPlace(place) {
  const item = normalizeStop(place);
  if (!item?.coord) return null;
  return { name: item.name, coord: item.coord, custom: true };
}

function serializeStop(stop) {
  const item = normalizeStop(stop);
  if (!item) return "";
  if (!item.coord) return item.name;
  return `${item.name}@${item.coord[0].toFixed(6)},${item.coord[1].toFixed(6)}`;
}

function sameStops(a, b) {
  return JSON.stringify(a.map(serializeStop)) === JSON.stringify(b.map(serializeStop));
}

function getSegmentPoints(stops) {
  return stops
    .map((stop) => {
      const item = normalizeStop(stop);
      return item?.coord ? { name: item.name, coord: item.coord, custom: item.custom } : null;
    })
    .filter(Boolean);
}

function buildRouteRequest(points) {
  if (points.length < 2) return null;
  return {
    origin: points[0].coord,
    destination: points[points.length - 1].coord,
    waypoints: points.slice(1, -1).map((point) => point.coord)
  };
}

function getBounds(points) {
  const source = points.length
    ? points.map((point) => point.coord)
    : Object.values(PLACE_META).map((item) => item.coord).filter(Boolean);

  return {
    minLng: Math.min(...source.map((point) => point[0])) - 2.5,
    maxLng: Math.max(...source.map((point) => point[0])) + 2.5,
    minLat: Math.max(-90, Math.min(...source.map((point) => point[1])) - 1.8),
    maxLat: Math.min(90, Math.max(...source.map((point) => point[1])) + 1.8)
  };
}

function formatDuration(seconds) {
  if (!seconds) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatRouteInfo(routeInfo) {
  if (!routeInfo) return "等待导航结果";
  return `${(routeInfo.distance / 1000).toFixed(0)} km / ${formatDuration(routeInfo.time)}`;
}

function normalizePathPoint(point) {
  if (!point) return null;
  if (Array.isArray(point) && point.length >= 2) return [Number(point[0]), Number(point[1])];
  if (typeof point.lng === "number" && typeof point.lat === "number") return [point.lng, point.lat];
  if (typeof point.getLng === "function" && typeof point.getLat === "function") return [point.getLng(), point.getLat()];
  return null;
}

function decodePolyline(polyline) {
  if (!polyline) return [];
  return String(polyline)
    .split(";")
    .map((item) => item.split(",").map(Number))
    .filter((item) => item.length >= 2 && !Number.isNaN(item[0]) && !Number.isNaN(item[1]));
}

function createMarkerContent(index, name) {
  return `
    <div style="display:flex;align-items:center;gap:8px;transform:translate(-50%,-100%);">
      <div style="display:flex;height:26px;min-width:26px;align-items:center;justify-content:center;border-radius:999px;background:#24555e;color:#f5efe4;font-size:12px;font-weight:700;box-shadow:0 10px 24px rgba(8,18,24,.28);">
        ${index + 1}
      </div>
      <div style="max-width:150px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(18,29,36,.82);padding:6px 10px;color:#fff;font-size:12px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${name}
      </div>
    </div>
  `;
}

function getOverrideKey(dayId, stops) {
  return `${dayId}::${stops.map(serializeStop).join(">")}`;
}

function getStopCategory(stop, options = {}) {
  const item = normalizeStop(stop);
  const category = item?.category || inferStopCategory({ name: item?.name || "", ...options });
  return STOP_CATEGORY_META[category] ? category : "waypoint";
}

function getStopDurationMinutes(stop, options = {}) {
  const item = normalizeStop(stop);
  if (typeof item?.durationMinutes === "number") return item.durationMinutes;
  const category = getStopCategory(stop, options);
  return inferStopDurationMinutes({ category, index: options.index ?? 0, total: options.total ?? 0 });
}

function StopCategoryBadge({ category, compact = false }) {
  const meta = STOP_CATEGORY_META[category] || STOP_CATEGORY_META.waypoint;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${meta.tone}`}>
      {compact ? meta.shortLabel : meta.label}
    </span>
  );
}

function FlightPanel({ activeDay }) {
  return (
    <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,31,40,0.86),rgba(52,83,95,0.58))] p-6 sm:mt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/55">航班日</div>
          <div className="mt-3 text-2xl font-semibold text-white">{activeDay.day === 1 ? "飞往丽江" : "飞回上海"}</div>
          <p className="mt-3 max-w-xl text-sm leading-7 text-white/75">{activeDay.routeText}</p>
        </div>
        <Plane className="h-8 w-8 shrink-0 text-white/75" />
      </div>
    </div>
  );
}

function OfflineMap({ activeDay, stops, routeInfo, currentLocation }) {
  const stagePoints = useMemo(() => getSegmentPoints(stops), [stops]);

  if (activeDay.transport === "flight") return <FlightPanel activeDay={activeDay} />;

  return (
    <div className="mt-4 overflow-hidden rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] p-4 sm:mt-5 sm:p-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">当天路线摘要</div>
      <div className="mt-3 text-lg text-white">{routeInfo ? formatRouteInfo(routeInfo) : "未接入在线导航"}</div>
      <div className="mt-5 space-y-3">
        {stagePoints.map((point, index) => (
          <div key={`${activeDay.id}-offline-${point.name}-${index}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/78">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs text-accent">{index + 1}</span>
            <span>{point.name}</span>
          </div>
        ))}
      </div>
      {currentLocation ? (
        <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-white/78">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">当前位置记录</div>
          <div className="mt-2 text-white">{`${formatCoord(currentLocation.lat, 4)}, ${formatCoord(currentLocation.lng, 4)}`}</div>
          <div className="mt-1 text-xs text-white/55">{`记录于 ${formatLocationTimestamp(currentLocation.recordedAt)}`}</div>
        </div>
      ) : null}
    </div>
  );
}

function RouteEditor({ activeDay, currentStops, setCurrentStops, hasOverride, onApply, onReset, isApplying }) {
  const [selectedStop, setSelectedStop] = useState("");
  const [customName, setCustomName] = useState("");
  const [selectedSuggestionId, setSelectedSuggestionId] = useState("");
  const [replaceIndex, setReplaceIndex] = useState(null);
  const [categoryValue, setCategoryValue] = useState("waypoint");
  const [customLng, setCustomLng] = useState("");
  const [customLat, setCustomLat] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [resolveMessage, setResolveMessage] = useState("");
  const [customPlaceLibrary, setCustomPlaceLibrary] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const placeSearchRef = useRef(null);
  const geocoderRef = useRef(null);
  const placeNames = useMemo(() => Object.keys(PLACE_META), []);
  const amapKey = process.env.NEXT_PUBLIC_AMAP_KEY;
  const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;

  useEffect(() => {
    setSelectedStop("");
    setCustomName("");
    setSelectedSuggestionId("");
    setReplaceIndex(null);
    setCategoryValue("waypoint");
    setCustomLng("");
    setCustomLat("");
    setResolveMessage("");
    setSuggestions([]);
  }, [activeDay.id]);

  useEffect(() => {
    const stored = loadJson(CUSTOM_PLACE_LIBRARY_KEY);
    const list = Array.isArray(stored) ? stored.map(normalizeCustomPlace).filter(Boolean) : [];
    setCustomPlaceLibrary(list);
  }, []);

  useEffect(() => {
    if (!amapKey) return;

    let disposed = false;
    window._AMapSecurityConfig = securityCode ? { securityJsCode: securityCode } : window._AMapSecurityConfig || {};

    import("@amap/amap-jsapi-loader")
      .then(({ default: AMapLoader }) =>
        AMapLoader.load({
          key: amapKey,
          version: "2.0",
          plugins: ["AMap.PlaceSearch", "AMap.Geocoder"]
        })
      )
      .then((AMap) => {
        if (disposed) return;
        placeSearchRef.current = new AMap.PlaceSearch({
          pageSize: 8,
          pageIndex: 1,
          citylimit: false,
          extensions: "base"
        });
        geocoderRef.current = new AMap.Geocoder();
      })
      .catch(() => {
        placeSearchRef.current = null;
        geocoderRef.current = null;
      });

    return () => {
      disposed = true;
      placeSearchRef.current = null;
      geocoderRef.current = null;
    };
  }, [amapKey, securityCode]);

  useEffect(() => {
    const keyword = customName.trim();
    if (!keyword) {
      setSuggestions([]);
      setSelectedSuggestionId("");
      setIsSearching(false);
      return;
    }

    const loweredKeyword = keyword.toLowerCase();
    const localMatches = customPlaceLibrary
      .filter((place) => place.name.toLowerCase().includes(loweredKeyword))
      .slice(0, 5)
      .map((place) => ({
        id: `local-${place.name}-${place.coord.join(",")}`,
        name: place.name,
        coord: place.coord,
        district: "",
        address: "",
        source: "本地记录"
      }));

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);

      if (!amapKey) {
        setSuggestions(localMatches);
        setSelectedSuggestionId(localMatches[0]?.id ?? "");
        setIsSearching(false);
        return;
      }

      try {
        const remotePois = await new Promise((resolve, reject) => {
          if (!placeSearchRef.current) {
            resolve([]);
            return;
          }

          placeSearchRef.current.search(keyword, (status, result) => {
            if (status !== "complete") {
              reject(new Error(result?.info || "place search failed"));
              return;
            }

            const pois = (result?.poiList?.pois || [])
              .map((poi, index) => {
                const location = poi?.location;
                const coord = normalizePathPoint(location);
                if (!coord) return null;
                return {
                  id: `poi-${index}-${poi.id || poi.name}-${coord[0]},${coord[1]}`,
                  name: poi.name || keyword,
                  district: [poi.pname, poi.cityname, poi.adname].filter(Boolean).join(" "),
                  address: poi.address || "",
                  coord,
                  source: "高德地点"
                };
              })
              .filter(Boolean);

            resolve(pois);
          });
        });

        if (cancelled) return;
        const merged = [...localMatches];
        for (const item of remotePois) {
          if (!merged.some((existing) => existing.name === item.name && existing.coord.join(",") === item.coord.join(","))) {
            merged.push(item);
          }
        }

        setSuggestions(merged.slice(0, 8));
        setSelectedSuggestionId((current) => current || merged[0]?.id || "");
      } catch {
        if (!cancelled) {
          setSuggestions(localMatches);
          setSelectedSuggestionId((current) => current || localMatches[0]?.id || "");
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [amapKey, customName, customPlaceLibrary]);

  function persistCustomPlace(place) {
    const normalized = normalizeCustomPlace(place);
    if (!normalized) return;

    setCustomPlaceLibrary((current) => {
      const next = [normalized, ...current.filter((item) => !(item.name === normalized.name && item.coord.join(",") === normalized.coord.join(",")))].slice(0, 30);
      persistJson(CUSTOM_PLACE_LIBRARY_KEY, next);
      return next;
    });
  }

  function appendPresetStop() {
    if (!selectedStop) return;
    setCurrentStops((stops) => {
      const nextStop = { name: selectedStop, coord: PLACE_META[selectedStop]?.coord ?? null, custom: false, category: categoryValue };
      if (replaceIndex === null) return [...stops, nextStop];
      const next = [...stops];
      next[replaceIndex] = nextStop;
      return next;
    });
    setSelectedStop("");
    setReplaceIndex(null);
  }

  function resetCustomInputs() {
    setCustomName("");
    setSelectedSuggestionId("");
    setReplaceIndex(null);
    setCategoryValue("waypoint");
    setCustomLng("");
    setCustomLat("");
    setResolveMessage("");
    setSuggestions([]);
  }

  function appendCustomStop() {
    const lng = Number(customLng);
    const lat = Number(customLat);
    if (!customName.trim() || Number.isNaN(lng) || Number.isNaN(lat)) return;

    const nextPlace = { name: customName.trim(), coord: [lng, lat], custom: true, category: categoryValue };
    setCurrentStops((stops) => {
      if (replaceIndex === null) return [...stops, nextPlace];
      const next = [...stops];
      next[replaceIndex] = nextPlace;
      return next;
    });
    persistCustomPlace(nextPlace);
    resetCustomInputs();
  }

  function pickSuggestion(suggestion) {
    const nextPlace = { name: suggestion.name, coord: suggestion.coord, custom: true, category: categoryValue };
    setCurrentStops((stops) => {
      if (replaceIndex === null) return [...stops, nextPlace];
      const next = [...stops];
      next[replaceIndex] = nextPlace;
      return next;
    });
    persistCustomPlace(nextPlace);
    resetCustomInputs();
  }

  function appendSelectedSuggestion() {
    const suggestion = suggestions.find((item) => item.id === selectedSuggestionId);
    if (!suggestion) return;
    pickSuggestion(suggestion);
  }

  async function resolveCustomStop() {
    const keyword = customName.trim();
    if (!keyword || !amapKey) return;
    setIsResolving(true);
    setResolveMessage("");

    try {
      const location = await new Promise((resolve, reject) => {
        if (!geocoderRef.current) {
          resolve(null);
          return;
        }

        geocoderRef.current.getLocation(keyword, (status, result) => {
          if (status !== "complete") {
            reject(new Error(result?.info || "geocode failed"));
            return;
          }
          resolve(result?.geocodes?.[0]?.location ?? null);
        });
      });

      const coord = normalizePathPoint(location);
      if (!coord) {
        setResolveMessage("没有查到明确坐标，换个更完整的地点名试试。");
        return;
      }

      setCustomLng(String(coord[0]));
      setCustomLat(String(coord[1]));
      setResolveMessage("已自动填入坐标，可以直接手动加入。");
    } catch {
      setResolveMessage("自动查坐标失败，可以稍后再试。");
    } finally {
      setIsResolving(false);
    }
  }

  function removeStop(index) {
    setCurrentStops((stops) => (stops.length <= 2 ? stops : stops.filter((_, stopIndex) => stopIndex !== index)));
  }

  function updateStopDuration(index, value) {
    const minutes = Math.max(0, Number(value) || 0);
    setCurrentStops((stops) =>
      stops.map((stop, stopIndex) => {
        if (stopIndex !== index) return stop;
        const item = normalizeStop(stop);
        return { ...item, durationMinutes: minutes };
      })
    );
  }

  function moveStop(index, direction) {
    setCurrentStops((stops) => {
      const target = index + direction;
      if (target < 0 || target >= stops.length) return stops;
      const next = [...stops];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  if (activeDay.transport === "flight") return null;

  return (
    <div className="panel rounded-[24px] p-4 sm:rounded-[28px] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/50">当天路线编辑</div>
          <div className="mt-2 text-xl font-semibold text-white">可以新增点，也可以把默认点改成真实酒店或停车场</div>
        </div>
        {hasOverride ? <div className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs tracking-[0.18em] text-accent">已使用自定义路线</div> : null}
      </div>

      {replaceIndex !== null ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-white/85">
          <span>正在替换第 {replaceIndex + 1} 个节点：{normalizeStop(currentStops[replaceIndex])?.name}</span>
          <button type="button" onClick={() => setReplaceIndex(null)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/75">
            取消替换
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs tracking-[0.18em] text-white/45">当前分类</span>
        {STOP_CATEGORY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setCategoryValue(option.value)}
            className={`rounded-full border px-3 py-2 text-xs transition sm:px-3 sm:py-1.5 ${categoryValue === option.value ? option.tone : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,220px),auto]">
        <div className="flex flex-wrap gap-2">
          <select value={selectedStop} onChange={(event) => setSelectedStop(event.target.value)} className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none sm:min-w-[180px] sm:flex-none">
            <option value="" className="bg-[#162129] text-white">从现有地点里添加</option>
            {placeNames.map((place) => (
              <option key={place} value={place} className="bg-[#162129] text-white">{place}</option>
            ))}
          </select>
          <button type="button" onClick={appendPresetStop} disabled={!selectedStop} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/85 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            <Plus className="h-4 w-4" />
            {replaceIndex === null ? "添加现有点" : "替换为现有点"}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1.2fr),auto]">
        <input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="输入地点名，例如 萨普神山观景台 / 喀拉峻游客中心" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
        <button type="button" onClick={appendSelectedSuggestion} disabled={!selectedSuggestionId} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto">
          <Plus className="h-4 w-4" />
          {replaceIndex === null ? "加入选中地点" : "替换为选中地点"}
        </button>
      </div>

      {customName.trim() ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs tracking-[0.18em] text-white/45">高德候选地点</div>
            {isSearching ? <div className="text-xs text-white/45">搜索中...</div> : null}
          </div>

          {suggestions.length ? (
            <div className="mt-3 grid gap-2">
              {suggestions.map((item) => {
                const selected = item.id === selectedSuggestionId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedSuggestionId(item.id)}
                    onDoubleClick={() => pickSuggestion(item)}
                    className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${selected ? "border-accent/40 bg-accent/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white">{item.name}</div>
                      <div className="mt-1 truncate text-xs text-white/45">{[item.source, item.district, item.address].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className={`shrink-0 rounded-full border px-3 py-1 text-xs ${selected ? "border-accent/30 text-accent" : "border-white/10 text-white/60"}`}>
                      {selected ? "已选中" : "点选"}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : !isSearching ? (
            <div className="mt-3 text-sm text-white/55">没搜到明确候选。换更完整的关键词，或者改用下面的坐标兜底。</div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,0.9fr),minmax(0,0.9fr),auto,auto]">
        <input value={customLng} onChange={(event) => setCustomLng(event.target.value)} placeholder="经度，可由自动查坐标填入" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
        <input value={customLat} onChange={(event) => setCustomLat(event.target.value)} placeholder="纬度，可由自动查坐标填入" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
        <button type="button" onClick={resolveCustomStop} disabled={!customName.trim() || !amapKey || isResolving} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/85 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50">
          {isResolving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MapPinned className="h-4 w-4" />}
          自动查坐标
        </button>
        <button type="button" onClick={appendCustomStop} disabled={!customName.trim() || !customLng.trim() || !customLat.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/85 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50">
          <Plus className="h-4 w-4" />
          {replaceIndex === null ? "手动加入" : "手动替换"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/50">
        <span>搜索现在走高德 JSAPI 的地点检索服务，不再要求一字不差。</span>
        <span>你选过的自定义地点会保存在本地，下次还能继续搜到。</span>
        {resolveMessage ? <span className="text-accent">{resolveMessage}</span> : null}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">停留时长设置</div>
        <div className="mt-3 grid gap-2">
          {currentStops.map((stop, index) => (
            <div key={`${activeDay.id}-duration-${serializeStop(stop)}-${index}`} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm text-white">{normalizeStop(stop)?.name}</div>
                <div className="mt-1 text-xs text-white/45">{STOP_CATEGORY_META[getStopCategory(stop, { scene: activeDay.scene?.key || "", index, total: currentStops.length })]?.label || "途经点"}</div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <input type="number" min="0" step="5" value={getStopDurationMinutes(stop, { scene: activeDay.scene?.key || "", index, total: currentStops.length })} onChange={(event) => updateStopDuration(index, event.target.value)} className="w-20 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none" />
                <span className="text-xs text-white/55">分钟</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onApply} disabled={currentStops.length < 2 || isApplying} className="inline-flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50">
          {isApplying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
          应用并重算
        </button>
        <button type="button" onClick={onReset} disabled={!hasOverride} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
          <RotateCcw className="h-4 w-4" />
          恢复官方路线
        </button>
      </div>

      <div className="mt-5 grid gap-3">
        {currentStops.map((stop, index) => {
          const item = normalizeStop(stop);
          return (
            <div key={`${activeDay.id}-editor-${serializeStop(stop)}-${index}`} className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-sm text-accent">{index + 1}</div>
              <div className="min-w-[160px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm text-white">{item?.name}</div>
                  <StopCategoryBadge category={getStopCategory(stop, { scene: activeDay.scene?.key || "", index, total: currentStops.length })} compact />
                </div>
                {item?.coord ? <div className="mt-1 text-xs text-white/45">{item.coord[0].toFixed(4)}, {item.coord[1].toFixed(4)}{item.custom ? " · 自定义" : ""}</div> : null}
              </div>
              <button type="button" onClick={() => moveStop(index, -1)} disabled={index === 0} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 disabled:opacity-35">前移</button>
              <button type="button" onClick={() => moveStop(index, 1)} disabled={index === currentStops.length - 1} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 disabled:opacity-35">后移</button>
              <button type="button" onClick={() => setReplaceIndex(index)} className={`rounded-full border px-3 py-1 text-xs ${replaceIndex === index ? "border-accent/30 text-accent" : "border-white/10 text-white/70"}`}>
                替换
              </button>
              <button type="button" onClick={() => removeStop(index)} disabled={currentStops.length <= 2} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 disabled:opacity-35">
                <X className="h-3 w-3" />
                删除
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveAmap({ activeDay, days, stops, onRouteInfoChange, applyNonce, onPlanningChange, currentLocation }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const amapRef = useRef(null);
  const activeDrivingRef = useRef(null);
  const preloadDrivingRef = useRef(null);
  const routeOverlayRef = useRef(null);
  const markerRefs = useRef([]);
  const locationMarkerRef = useRef(null);
  const preloadStartedRef = useRef(false);
  const planRequestIdRef = useRef(0);
  const cacheRef = useRef({});
  const [loadError, setLoadError] = useState("");
  const [routeInfo, setRouteInfo] = useState(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState({ done: 0, total: 0, running: false });
  const amapKey = process.env.NEXT_PUBLIC_AMAP_KEY;
  const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;

  const stagePoints = useMemo(() => getSegmentPoints(stops), [stops]);
  const activeRequest = useMemo(() => buildRouteRequest(stagePoints), [stagePoints]);
  const cacheKey = useMemo(() => getOverrideKey(activeDay.id, stops), [activeDay.id, stops]);

  function setPlanningState(value) {
    setIsPlanning(value);
    onPlanningChange?.(value);
  }

  function clearMarkers() {
    if (!mapInstanceRef.current || !markerRefs.current.length) return;
    mapInstanceRef.current.remove(markerRefs.current);
    markerRefs.current = [];
  }

  function clearRouteOverlay() {
    if (!routeOverlayRef.current) return;
    routeOverlayRef.current.setMap(null);
    routeOverlayRef.current = null;
  }

  function clearLocationMarker() {
    if (!locationMarkerRef.current) return;
    locationMarkerRef.current.setMap(null);
    locationMarkerRef.current = null;
  }

  function publishRoute(dayId, route) {
    if (dayId !== activeDay.id) return;
    setRouteInfo(route ?? null);
    onRouteInfoChange?.(dayId, route ?? null);
  }

  function saveRoute(dayId, nextCacheKey, route) {
    cacheRef.current = { ...cacheRef.current, [nextCacheKey]: route };
    persistJson(ROUTE_CACHE_KEY, cacheRef.current);
    publishRoute(dayId, route);
  }

  function drawDayRoute(points, route) {
    const map = mapInstanceRef.current;
    const AMap = amapRef.current;
    if (!map || !AMap) return;

    clearRouteOverlay();
    clearMarkers();

    const markers = points.map((point, index) => new AMap.Marker({
      position: point.coord,
      anchor: "bottom-center",
      content: createMarkerContent(index, point.name)
    }));

    markerRefs.current = markers;
    map.add(markers);

    const path = route?.path?.length ? route.path : points.map((point) => point.coord);
    routeOverlayRef.current = new AMap.Polyline({
      path,
      strokeColor: route?.path?.length ? "#d6b46e" : "#74b8b0",
      strokeWeight: route?.path?.length ? 6 : 4,
      strokeOpacity: 0.95,
      lineJoin: "round",
      lineCap: "round",
      showDir: Boolean(route?.path?.length)
    });

    routeOverlayRef.current.setMap(map);
    map.setFitView([...markers, routeOverlayRef.current], false, [64, 80, 64, 80]);
  }

  function drawCurrentLocation(location) {
    const map = mapInstanceRef.current;
    const AMap = amapRef.current;
    if (!map || !AMap) return;

    clearLocationMarker();
    if (!location) return;

    const marker = new AMap.Marker({
      position: [location.lng, location.lat],
      anchor: "bottom-center",
      content: `
        <div style="display:flex;align-items:center;gap:8px;transform:translate(-50%,-100%);">
          <div style="display:flex;height:18px;width:18px;align-items:center;justify-content:center;border-radius:999px;background:#34d399;box-shadow:0 0 0 6px rgba(52,211,153,.16);"></div>
          <div style="border:1px solid rgba(52,211,153,.24);border-radius:999px;background:rgba(12,24,28,.88);padding:6px 10px;color:#d1fae5;font-size:12px;line-height:1.1;white-space:nowrap;">
            当前位置
          </div>
        </div>
      `
    });

    marker.setMap(map);
    locationMarkerRef.current = marker;
  }

  function applyCachedRoute(dayId, nextCacheKey, points) {
    const cached = cacheRef.current[nextCacheKey] ?? null;
    publishRoute(dayId, cached);
    if (points.length) drawDayRoute(points, cached);
  }

  function searchRoute(driving, request) {
    return new Promise((resolve, reject) => {
      const callback = (status, result) => {
        if (status !== "complete" || !result?.routes?.length) {
          reject(new Error(result?.info || "route search failed"));
          return;
        }

        const primaryRoute = result.routes[0];
        const path = (primaryRoute.steps || []).flatMap((step) => {
          if (Array.isArray(step.path) && step.path.length) return step.path.map(normalizePathPoint).filter(Boolean);
          return decodePolyline(step.polyline);
        });

        resolve({
          distance: Number(primaryRoute.distance || 0),
          time: Number(primaryRoute.time || 0),
          tolls: Number(primaryRoute.tolls || 0),
          restriction: Number(primaryRoute.restriction || 0),
          path
        });
      };

      if (request.waypoints.length) {
        driving.search(request.origin, request.destination, { waypoints: request.waypoints }, callback);
      } else {
        driving.search(request.origin, request.destination, callback);
      }
    });
  }

  async function preloadRoutes() {
    const driving = preloadDrivingRef.current;
    if (!driving || preloadStartedRef.current) return;
    preloadStartedRef.current = true;

    const driveDays = days.filter((day) => day.transport !== "flight");
    const targets = driveDays
      .map((day) => {
        const dayPoints = getSegmentPoints(day.stops);
        return {
          id: day.id,
          cacheKey: getOverrideKey(day.id, day.stops),
          request: buildRouteRequest(dayPoints)
        };
      })
      .filter((item) => item.id !== activeDay.id && item.request && !cacheRef.current[item.cacheKey]);

    setPreloadProgress({ done: driveDays.length - targets.length, total: driveDays.length, running: targets.length > 0 });

    for (let index = 0; index < targets.length; index += 1) {
      const item = targets[index];
      try {
        const route = await searchRoute(driving, item.request);
        cacheRef.current = { ...cacheRef.current, [item.cacheKey]: route };
        persistJson(ROUTE_CACHE_KEY, cacheRef.current);
      } catch {}

      setPreloadProgress({
        done: driveDays.length - targets.length + index + 1,
        total: driveDays.length,
        running: index + 1 < targets.length
      });
    }
  }

  async function planCurrentDay(force = false) {
    const driving = activeDrivingRef.current;
    if (!stagePoints.length || !driving) return;
    const requestId = ++planRequestIdRef.current;
    const requestDayId = activeDay.id;

    if (activeDay.transport === "flight" || !activeRequest) {
      publishRoute(requestDayId, null);
      clearRouteOverlay();
      clearMarkers();
      return;
    }

    if (!force && cacheRef.current[cacheKey]) {
      const cached = cacheRef.current[cacheKey];
      publishRoute(requestDayId, cached);
      drawDayRoute(stagePoints, cached);
      return;
    }

    setPlanningState(true);
    try {
      const route = await searchRoute(driving, activeRequest);
      if (requestId !== planRequestIdRef.current) return;
      saveRoute(requestDayId, cacheKey, route);
      drawDayRoute(stagePoints, route);
    } catch {
      if (requestId !== planRequestIdRef.current) return;
      const fallback = cacheRef.current[cacheKey] ?? null;
      publishRoute(requestDayId, fallback);
      drawDayRoute(stagePoints, fallback);
    } finally {
      if (requestId === planRequestIdRef.current) setPlanningState(false);
    }
  }

  useEffect(() => {
    cacheRef.current = loadJson(ROUTE_CACHE_KEY);
    if (activeDay.transport === "flight") {
      publishRoute(activeDay.id, null);
      return;
    }
    publishRoute(activeDay.id, cacheRef.current[cacheKey] ?? null);
  }, []);

  useEffect(() => {
    if (!amapKey || !mapRef.current) return;

    let disposed = false;
    window._AMapSecurityConfig = securityCode ? { securityJsCode: securityCode } : window._AMapSecurityConfig || {};

    import("@amap/amap-jsapi-loader")
      .then(({ default: AMapLoader }) =>
        AMapLoader.load({
          key: amapKey,
          version: "2.0",
          plugins: ["AMap.Scale", "AMap.ToolBar", "AMap.Driving"]
        })
      )
      .then(async (AMap) => {
        if (disposed || !mapRef.current) return;

        amapRef.current = AMap;
        const map = new AMap.Map(mapRef.current, {
          viewMode: "3D",
          mapStyle: "amap://styles/darkblue",
          zoom: 6,
          center: stagePoints[0]?.coord || [88.5, 34.2],
          pitch: 0,
          terrain: false,
          resizeEnable: true
        });

        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar({ position: "RB" }));
        mapInstanceRef.current = map;
        activeDrivingRef.current = new AMap.Driving({ policy: 0, hideMarkers: true, showTraffic: false, map: null });
        preloadDrivingRef.current = new AMap.Driving({ policy: 0, hideMarkers: true, showTraffic: false, map: null });

        if (activeDay.transport === "flight") {
          publishRoute(activeDay.id, null);
        } else {
          applyCachedRoute(activeDay.id, cacheKey, stagePoints);
          if (!cacheRef.current[cacheKey]) await planCurrentDay(true);
        }

        drawCurrentLocation(currentLocation);
        await preloadRoutes();
      })
      .catch((error) => {
        setLoadError(error?.message || "AMap failed to load");
      });

    return () => {
      disposed = true;
      clearRouteOverlay();
      clearMarkers();
      clearLocationMarker();
      activeDrivingRef.current = null;
      preloadDrivingRef.current = null;
      mapInstanceRef.current?.destroy?.();
      mapInstanceRef.current = null;
      amapRef.current = null;
    };
  }, [amapKey, securityCode]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (activeDay.transport === "flight") {
      publishRoute(activeDay.id, null);
      clearRouteOverlay();
      clearMarkers();
      return;
    }
    applyCachedRoute(activeDay.id, cacheKey, stagePoints);
    planCurrentDay(false);
  }, [activeDay.id, cacheKey]);

  useEffect(() => {
    if (!mapInstanceRef.current || activeDay.transport === "flight" || applyNonce === 0) return;
    planCurrentDay(true);
  }, [applyNonce]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    drawCurrentLocation(currentLocation);
  }, [currentLocation]);

  if (!amapKey || loadError) return <OfflineMap activeDay={activeDay} stops={stops} routeInfo={routeInfo} currentLocation={currentLocation} />;
  if (activeDay.transport === "flight") return <FlightPanel activeDay={activeDay} />;

  return (
    <>
      <div ref={mapRef} className="mt-4 h-[380px] overflow-hidden rounded-[24px] border border-white/[0.08] sm:mt-5 sm:h-[560px]" />
      <div className="mt-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
          <div className="panel-soft rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.18em] text-white/50">
              <Route className="h-4 w-4" />
              当天导航路线
            </div>
            <div className="mt-3 text-lg text-white">{formatRouteInfo(routeInfo)}</div>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/65">
              <span>{routeInfo ? `收费 ${routeInfo.tolls.toFixed(0)} 元` : "当前路线还没有缓存结果，应用后会自动重算"}</span>
              <span>{routeInfo?.restriction ? "存在限行路段" : "默认优先规避限行"}</span>
            </div>
          </div>
          <button type="button" onClick={() => planCurrentDay(true)} disabled={isPlanning} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50">
            {isPlanning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            重新规划
          </button>
        </div>

        <div className="panel-soft rounded-2xl p-4 text-sm text-white/65">
          <div className="flex items-center justify-between gap-4">
            <span>整段驾车日缓存</span>
            <span>{`${preloadProgress.done}/${preloadProgress.total || days.filter((day) => day.transport !== "flight").length}`}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-accent to-accentAlt transition-all" style={{ width: `${((preloadProgress.done || 0) / (preloadProgress.total || days.filter((day) => day.transport !== "flight").length || 1)) * 100}%` }} />
          </div>
          <div className="mt-2 text-xs text-white/45">
            {preloadProgress.running ? "官方路线会在首次打开后逐天缓存。你手动加过的地点会保存在本地。" : "官方路线缓存已就绪，自定义地点和自定义路线都会保存在本地。"}
          </div>
        </div>
      </div>
    </>
  );
}

export default function MapPanel({ activeDay, days, onRouteInfoChange, onStopsChange, onLocationCapture }) {
  const [currentStops, setCurrentStops] = useState(activeDay.stops);
  const [applyNonce, setApplyNonce] = useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);
  const effectiveStops = currentStops;
  const hasAmapKey = Boolean(process.env.NEXT_PUBLIC_AMAP_KEY);
  const hasOverride = !sameStops(currentStops, activeDay.stops);
  const bounds = getBounds(getSegmentPoints(effectiveStops));

  useEffect(() => {
    const stored = loadJson(CURRENT_LOCATION_KEY);
    if (stored && typeof stored.lng === "number" && typeof stored.lat === "number") {
      setCurrentLocation(stored);
      onLocationCapture?.(stored);
    }
  }, [onLocationCapture]);

  useEffect(() => {
    const nextOverrides = loadJson(ROUTE_OVERRIDE_KEY);
    setCurrentStops(nextOverrides[activeDay.id] || activeDay.stops);
    setApplyNonce(0);
    setEditorOpen(false);
  }, [activeDay.id, activeDay.stops]);

  useEffect(() => {
    onStopsChange?.(activeDay.id, currentStops);
  }, [activeDay.id, currentStops, onStopsChange]);

  function applyOverride() {
    const nextOverrides = loadJson(ROUTE_OVERRIDE_KEY);
    nextOverrides[activeDay.id] = currentStops;
    persistJson(ROUTE_OVERRIDE_KEY, nextOverrides);
    setApplyNonce((value) => value + 1);
  }

  function resetOverride() {
    const nextOverrides = loadJson(ROUTE_OVERRIDE_KEY);
    delete nextOverrides[activeDay.id];
    persistJson(ROUTE_OVERRIDE_KEY, nextOverrides);
    setCurrentStops(activeDay.stops);
    setApplyNonce((value) => value + 1);
  }

  function captureCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("当前浏览器不支持定位");
      return;
    }

    setIsLocating(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lng: Number(position.coords.longitude),
          lat: Number(position.coords.latitude),
          accuracy: Number(position.coords.accuracy || 0),
          recordedAt: new Date().toISOString()
        };
        setCurrentLocation(nextLocation);
        persistJson(CURRENT_LOCATION_KEY, nextLocation);
        onLocationCapture?.(nextLocation);
        setIsLocating(false);
      },
      (error) => {
        const nextMessage = error?.code === 1
          ? "定位权限被拒绝"
          : error?.code === 2
            ? "无法获取当前位置"
            : error?.code === 3
              ? "定位超时，请重试"
              : "定位失败，请稍后重试";
        setLocationError(nextMessage);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <div className="space-y-4">
      <div className="panel relative overflow-hidden rounded-[24px] p-4 sm:rounded-[28px] sm:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-white/50">地图图层</div>
            <div className="mt-2 text-lg font-semibold text-white sm:text-xl">{activeDay.transport === "flight" ? "航班日视图" : "当天导航路线"}</div>
          </div>
          <div className="flex items-center gap-2 text-xs tracking-[0.2em] text-white/50">
            <Signal className="h-4 w-4" />
            <span>{hasAmapKey ? "高德导航已启用" : "离线示意模式"}</span>
          </div>
        </div>

        <div className="relative mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">当前位置</div>
            <div className="mt-2 text-sm text-white">
              {currentLocation
                ? `${formatCoord(currentLocation.lat, 5)}, ${formatCoord(currentLocation.lng, 5)}`
                : "还没有记录当前位置"}
            </div>
            <div className="mt-1 text-xs text-white/50">
              {currentLocation
                ? `记录于 ${formatLocationTimestamp(currentLocation.recordedAt)}${currentLocation.accuracy ? ` · 精度约 ${Math.round(currentLocation.accuracy)}m` : ""}`
                : "点右侧按钮后会调用浏览器定位并保存在本地"}
            </div>
            {locationError ? <div className="mt-2 text-xs text-amber-200">{locationError}</div> : null}
          </div>
          <button type="button" onClick={captureCurrentLocation} disabled={isLocating} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50">
            {isLocating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MapPinned className="h-4 w-4" />}
            {isLocating ? "定位中..." : "记录当前位置"}
          </button>
        </div>

        {hasAmapKey ? (
          <LiveAmap activeDay={activeDay} days={days} stops={effectiveStops} onRouteInfoChange={onRouteInfoChange} applyNonce={applyNonce} onPlanningChange={setIsApplying} currentLocation={currentLocation} />
        ) : (
          <OfflineMap activeDay={activeDay} stops={effectiveStops} routeInfo={null} currentLocation={currentLocation} />
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="panel-soft rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/50">
              <MapPinned className="h-4 w-4" />
              当天节点
            </div>
            <div className="mt-3 text-lg text-white">{effectiveStops.length}</div>
          </div>
          <div className="panel-soft rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/50">
              <Radar className="h-4 w-4" />
              视图跨度
            </div>
            <div className="mt-3 text-lg text-white">{`${(bounds.maxLng - bounds.minLng).toFixed(1)}° x ${(bounds.maxLat - bounds.minLat).toFixed(1)}°`}</div>
          </div>
          <div className="panel-soft rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/50">当天模式</div>
            <div className="mt-3 text-lg text-white">{activeDay.transport === "flight" ? "飞机" : hasOverride ? "自定义路线" : activeDay.scene.label}</div>
          </div>
        </div>
      </div>

      {activeDay.transport !== "flight" ? (
        <div className="panel rounded-[24px] p-4 sm:rounded-[28px] sm:p-5">
          <button type="button" onClick={() => setEditorOpen((value) => !value)} className="flex w-full items-center justify-between gap-4 text-left">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/50">路线编辑</div>
              <div className="mt-2 text-xl font-semibold text-white">修改当天线路</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-[0.18em] text-white/60">
                {`${currentStops.length} 个节点`}
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                {editorOpen ? "收起" : "展开"}
              </div>
            </div>
          </button>

          {editorOpen ? (
            <div className="mt-5">
              <RouteEditor activeDay={activeDay} currentStops={currentStops} setCurrentStops={setCurrentStops} hasOverride={hasOverride} onApply={applyOverride} onReset={resetOverride} isApplying={isApplying} />
            </div>
          ) : (
            <div className="mt-4 text-sm leading-6 text-white/65">这里保留一处路线编辑。展开后可以替换点位、调顺序、改停留时长并重新规划。</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
