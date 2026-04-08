"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, MapPinned, Search, UtensilsCrossed } from "lucide-react";
import { loadDayRecommendations, saveDayRecommendations } from "@/lib/day-recommendation-store";
import { PLACE_META } from "@/lib/place-data";

function getStopName(stop) {
  return typeof stop === "string" ? stop : stop?.name || "未命名地点";
}

function getStopCoord(stop) {
  if (typeof stop === "object" && Array.isArray(stop?.coord) && stop.coord.length >= 2) {
    return [Number(stop.coord[0]), Number(stop.coord[1])];
  }

  const name = typeof stop === "string" ? stop : stop?.name;
  return name ? PLACE_META[name]?.coord ?? null : null;
}

function buildDefaultKeyword(kind) {
  return kind === "food" ? "美食" : "景点";
}

function normalizePoiAsStop(poi, kind) {
  const [lng, lat] = String(poi.location || "")
    .split(",")
    .map((item) => Number(item));

  return {
    name: poi.name,
    coord: Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null,
    custom: true,
    category: kind === "food" ? "supply" : "scenic",
    durationMinutes: kind === "food" ? 60 : 90
  };
}

function toneForKind(kind) {
  return kind === "food"
    ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
    : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
}

function EmptyState({ text }) {
  return (
    <div className="rounded-[20px] border border-dashed border-white/12 bg-white/5 px-4 py-5 text-sm leading-7 text-white/62">
      {text}
    </div>
  );
}

function normalizePoi(item, index) {
  const location = item?.location
    ? `${item.location.lng},${item.location.lat}`
    : "";

  return {
    id: item?.id || `poi-${index}`,
    name: item?.name || "未命名地点",
    address: item?.address || "",
    type: item?.type || "",
    location,
    tel: item?.tel || "",
    businessArea: item?.businessArea || "",
    rating: item?.rating || "",
    cost: item?.cost || "",
    opentime: item?.opentime || "",
    photo: item?.photos?.[0]?.url || "",
    distance: item?.distance || ""
  };
}

export default function DayRecommendationsPanel({ activeDay, activeStops, onAddStop }) {
  const [kind, setKind] = useState("play");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedByDay, setSavedByDay] = useState({});
  const [amapReady, setAmapReady] = useState(false);
  const placeSearchRef = useRef(null);
  const autoCompleteRef = useRef(null);

  const anchorName = useMemo(() => getStopName(activeStops[activeStops.length - 1] || activeDay.stops?.[activeDay.stops.length - 1] || activeDay.title), [activeDay, activeStops]);
  const anchorCoord = useMemo(() => {
    const last = activeStops[activeStops.length - 1];
    const first = activeStops[0];
    return getStopCoord(last) || getStopCoord(first) || null;
  }, [activeStops]);
  const currentSaved = savedByDay[activeDay.id] || [];
  const amapKey = process.env.NEXT_PUBLIC_AMAP_KEY;
  const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;

  useEffect(() => {
    setSavedByDay(loadDayRecommendations());
  }, []);

  useEffect(() => {
    if (!amapKey) {
      setAmapReady(false);
      return;
    }

    let disposed = false;
    window._AMapSecurityConfig = securityCode ? { securityJsCode: securityCode } : window._AMapSecurityConfig || {};

    import("@amap/amap-jsapi-loader")
      .then(({ default: AMapLoader }) =>
        AMapLoader.load({
          key: amapKey,
          version: "2.0",
          plugins: ["AMap.PlaceSearch", "AMap.AutoComplete"]
        })
      )
      .then((AMap) => {
        if (disposed) return;
        placeSearchRef.current = new AMap.PlaceSearch({
          pageSize: 12,
          pageIndex: 1,
          citylimit: false,
          extensions: "all"
        });
        autoCompleteRef.current = new AMap.AutoComplete({
          city: "全国",
          citylimit: false
        });
        setAmapReady(true);
      })
      .catch(() => {
        if (disposed) return;
        placeSearchRef.current = null;
        autoCompleteRef.current = null;
        setAmapReady(false);
      });

    return () => {
      disposed = true;
      placeSearchRef.current = null;
      autoCompleteRef.current = null;
      setAmapReady(false);
    };
  }, [amapKey, securityCode]);

  useEffect(() => {
    setQuery(buildDefaultKeyword(kind));
    setResults([]);
    setTips([]);
    setError("");
  }, [activeDay.id, kind]);

  useEffect(() => {
    const keyword = query.trim();
    if (!keyword || !amapReady || !autoCompleteRef.current) {
      setTips([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setTipsLoading(true);
      try {
        const autoTips = await new Promise((resolve, reject) => {
          autoCompleteRef.current.search(keyword, (status, result) => {
            if (status !== "complete") {
              reject(new Error(result?.info || "autocomplete failed"));
              return;
            }

            const list = (result?.tips || [])
              .filter((item) => item?.name)
              .map((item, index) => ({
                id: item.id || `tip-${index}`,
                name: item.name,
                district: item.district || "",
                address: item.address || "",
                location: item.location || "",
                type: item.type || ""
              }));
            resolve(list);
          });
        });
        if (!cancelled) setTips(autoTips || []);
      } catch {
        if (!cancelled) setTips([]);
      } finally {
        if (!cancelled) setTipsLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [amapReady, query]);

  async function runSearch(nextKeyword = query) {
    const trimmed = nextKeyword.trim();
    const keywordToSearch = trimmed || buildDefaultKeyword(kind);

    if (!amapReady || !placeSearchRef.current) {
      setError("高德搜索尚未就绪");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const searchResult = await new Promise((resolve, reject) => {
        const callback = (status, result) => {
          if (status !== "complete") {
            reject(new Error(result?.info || "搜索失败"));
            return;
          }

          const pois = (result?.poiList?.pois || []).map(normalizePoi).filter((item) => item.location);
          resolve(pois);
        };

        if (anchorCoord) {
          placeSearchRef.current.searchNearBy(keywordToSearch, anchorCoord, 12000, callback);
          return;
        }

        placeSearchRef.current.search(keywordToSearch, callback);
      });

      const filtered = searchResult.filter((item) =>
        kind === "food"
          ? /餐饮|美食|咖啡|茶馆|小吃|火锅|烧烤|甜品|酒吧/.test(`${item.type} ${item.name}`)
          : /景点|风景|公园|古镇|古城|博物馆|观景|步道|湖|山|峡谷|湿地|乐园/.test(`${item.type} ${item.name}`)
      );

      setResults(filtered.length ? filtered : searchResult);
    } catch (nextError) {
      setResults([]);
      setError(nextError?.message || "搜索失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!amapReady) return;
    runSearch(buildDefaultKeyword(kind));
  }, [amapReady, kind, activeDay.id]);

  function persistSaved(nextList) {
    const next = { ...savedByDay, [activeDay.id]: nextList };
    setSavedByDay(next);
    saveDayRecommendations(next);
  }

  function savePoi(poi) {
    if (currentSaved.some((item) => item.id === poi.id)) return;
    persistSaved([...currentSaved, { ...poi, kind }]);
  }

  function removeSaved(id) {
    persistSaved(currentSaved.filter((item) => item.id !== id));
  }

  function addToRoadbook(poi) {
    const stop = normalizePoiAsStop(poi, kind);
    if (!stop.coord) return;
    onAddStop?.(stop);
    savePoi(poi);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-accent/20 bg-accent/10 px-4 py-4 text-sm leading-7 text-white/82">
        <div className="text-[11px] uppercase tracking-[0.24em] text-accent/80">高德候选搜索</div>
        <div className="mt-2 text-lg font-semibold text-white">先搜一批，再由你决定加什么进当天路线</div>
        <p className="mt-3 text-sm leading-7 text-white/72">
          当前会优先围绕 <span className="text-white">{anchorName}</span> 附近搜索。适合找当天顺路的好玩和好吃，不直接替你拍板。
        </p>
        <div className="mt-3 text-xs text-white/52">{amapReady ? "高德搜索已连接" : "正在加载高德搜索能力"}</div>
      </section>

      <div className="flex flex-wrap gap-2">
        {[
          { id: "play", label: "找好玩", icon: MapPinned },
          { id: "food", label: "找好吃", icon: UtensilsCrossed }
        ].map((option) => {
          const Icon = option.icon;
          const active = kind === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setKind(option.id)}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm transition ${
                active
                  ? "border-accent/35 bg-accent/12 text-accent"
                  : "border-white/10 bg-white/5 text-white/72 hover:bg-white/10"
              }`}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
      </div>

      <section className="panel-soft rounded-[24px] p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="min-w-0 flex-1">
            <div className="rounded-2xl border border-white/10 bg-[#1b1714] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/46">搜索关键词</div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={buildDefaultKeyword(kind)}
                className="mt-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/28"
              />
            </div>
            {tips.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {tips.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setQuery(item.name);
                      runSearch(item.name);
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/72 transition hover:bg-white/10"
                  >
                    {item.name}
                  </button>
                ))}
                {tipsLoading ? <span className="px-2 py-2 text-xs text-white/45">联想中...</span> : null}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => runSearch()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4 text-sm text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? "搜索中" : "搜索候选"}
          </button>
        </div>
      </section>

      <section className="panel-soft rounded-[24px] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/46">已选清单</div>
            <div className="mt-2 text-lg font-semibold text-white">当天已保留的候选</div>
          </div>
          <div className={`rounded-full border px-3 py-1 text-xs tracking-[0.16em] ${toneForKind(kind)}`}>{currentSaved.length} 项</div>
        </div>

        {currentSaved.length ? (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {currentSaved.map((item) => (
              <article key={item.id} className="rounded-[20px] border border-white/10 bg-[#1f1915]/75 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-white">{item.name}</div>
                    <div className="mt-1 text-xs text-white/55">{item.address || item.businessArea || "高德返回结果"}</div>
                  </div>
                  <button type="button" onClick={() => removeSaved(item.id)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 transition hover:bg-white/10">
                    移除
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState text="先搜，再把合适的地点留下来。留下来的点会跟着当天面板走，不用每次重新找。" />
          </div>
        )}
      </section>

      <section className="panel-soft rounded-[24px] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/46">高德结果</div>
            <div className="mt-2 text-lg font-semibold text-white">搜索后再选，不预设答案</div>
          </div>
          <div className={`rounded-full border px-3 py-1 text-xs tracking-[0.16em] ${toneForKind(kind)}`}>{kind === "food" ? "好吃" : "好玩"}</div>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{error}</div> : null}

        {results.length ? (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {results.map((poi) => {
              const alreadySaved = currentSaved.some((item) => item.id === poi.id);
              return (
                <article key={poi.id} className="rounded-[20px] border border-white/10 bg-[#1f1915]/75 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold text-white">{poi.name}</div>
                    {poi.distance ? (
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] tracking-[0.16em] text-white/60">
                        {`${poi.distance} m`}
                      </div>
                    ) : null}
                    {poi.cost ? (
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] tracking-[0.16em] text-white/60">
                        {`人均 ${poi.cost}`}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-white/72">
                    <div>{poi.address || poi.businessArea || "地址待补充"}</div>
                    {poi.type ? <div className="text-white/52">{poi.type}</div> : null}
                    {poi.opentime ? <div className="text-white/52">{poi.opentime}</div> : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => addToRoadbook(poi)}
                      disabled={!poi.location}
                      className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      加入当天停靠点
                    </button>
                    <button
                      type="button"
                      onClick={() => savePoi(poi)}
                      disabled={alreadySaved}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/72 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {alreadySaved ? "已加入清单" : "先留着"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState text={loading ? "正在从高德拉候选结果。" : "先搜一批结果，再决定哪些值得加进当天路线。"} />
          </div>
        )}
      </section>
    </div>
  );
}
