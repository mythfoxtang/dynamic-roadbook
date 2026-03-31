import { PHOTO_CREDITS } from "@/lib/photo-credits";
import { PLACE_META, SCENE_META } from "@/lib/place-data";

const ROUTE_SCENE_HINTS = [
  { keyword: "雪山", scene: "ice" },
  { keyword: "珠峰", scene: "ice" },
  { keyword: "冈仁波齐", scene: "plateau" },
  { keyword: "玛旁雍措", scene: "lake" },
  { keyword: "班公湖", scene: "lake" },
  { keyword: "佩枯错", scene: "lake" },
  { keyword: "赛里木湖", scene: "lake" },
  { keyword: "峡谷", scene: "desert" },
  { keyword: "喀什", scene: "desert" },
  { keyword: "叶城", scene: "desert" },
  { keyword: "休整", scene: "city" }
];

function parseDayIndex(segment) {
  const match = segment.match(/Day\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function parseDate(segment) {
  const match = segment.match(/\((\d{4}\.\d{2}\.\d{2})\)/);
  return match ? match[1].replaceAll(".", "-") : null;
}

function normalizeLine(rawLine) {
  return rawLine.replace(/[（]/g, "(").replace(/[）]/g, ")").replace(/\s+/g, " ").trim();
}

function parseDistance(line) {
  const match = line.match(/(\d+)\s*km/i);
  return match ? Number(match[1]) : 0;
}

function parseHours(line) {
  const match = line.match(/(\d+(?:\.\d+)?)\s*h/i);
  return match ? Number(match[1]) : 0;
}

function routeBody(line) {
  return line
    .replace(/^Day\s*\d+/i, "")
    .replace(/\(\d{4}\.\d{2}\.\d{2}\)/, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\d+\s*km/gi, "")
    .replace(/\d+(?:\.\d+)?\s*h/gi, "")
    .replace(/^看日出\s+/, "")
    .replace(/^想从.*?回也行\s+/, "")
    .replace(/\s+住/g, "-")
    .trim();
}

function splitStops(routeText) {
  return routeText
    .split("-")
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferScene(routeText, highlights) {
  const fromHighlights = highlights.find((item) => item.scene)?.scene;
  if (fromHighlights) return fromHighlights;
  const hint = ROUTE_SCENE_HINTS.find((item) => routeText.includes(item.keyword));
  return hint ? hint.scene : "plateau";
}

function estimateAltitude(stops) {
  const known = stops
    .map((stop) => PLACE_META[stop]?.altitude)
    .filter((value) => typeof value === "number");

  if (known.length === 0) return 1800;
  return Math.round(known.reduce((sum, value) => sum + value, 0) / known.length);
}

function altitudeFactor(altitude) {
  if (altitude >= 4500) return 1.85;
  if (altitude >= 3800) return 1.55;
  if (altitude >= 2800) return 1.25;
  if (altitude >= 1500) return 1.1;
  return 0.95;
}

function buildTitle(stops, rawRoute) {
  if (stops.length <= 1) return rawRoute;
  return `${stops[0]} -> ${stops[stops.length - 1]}`;
}

function classifyRisk(fatigue) {
  if (fatigue >= 12) return "critical";
  if (fatigue >= 8) return "high";
  if (fatigue >= 4.5) return "medium";
  return "low";
}

function buildHighlights(stops) {
  return stops
    .map((stop) => {
      const meta = PLACE_META[stop];
      if (!meta) return null;
      return {
        name: stop,
        altitude: meta.altitude,
        scene: meta.scene,
        summary: meta.summary,
        image: meta.image,
        coord: meta.coord,
        credit: meta.creditKey ? PHOTO_CREDITS[meta.creditKey] : null
      };
    })
    .filter(Boolean);
}

export function computeFatigueIndex(distance, hours, altitude) {
  const factor = altitudeFactor(altitude);
  return Number((((distance || 0) / 100) * ((hours || 0) / 5) * factor).toFixed(2));
}

export function parseRoadbookText(source) {
  const lines = source
    .split(/\n+/)
    .map(normalizeLine)
    .filter(Boolean);

  return lines.map((line, index) => {
    const day = parseDayIndex(line) ?? index + 1;
    const date = parseDate(line);
    const distance = parseDistance(line);
    const hours = parseHours(line);
    const routeText = routeBody(line);
    const stops = splitStops(routeText);
    const highlights = buildHighlights(stops);
    const estimatedAltitude = estimateAltitude(stops);
    const fatigue = computeFatigueIndex(distance, hours, estimatedAltitude);
    const sceneKey = inferScene(routeText, highlights);
    const scene = SCENE_META[sceneKey];
    const title = buildTitle(stops, routeText);
    const isRestDay = /休整|整备|转转|徒步/.test(line) || (!distance && !hours);

    return {
      id: `day-${day}`,
      day,
      date,
      raw: line,
      title,
      routeText,
      stops,
      distance,
      hours,
      estimatedAltitude,
      altitudeFactor: altitudeFactor(estimatedAltitude),
      fatigue,
      fatigueLevel: classifyRisk(fatigue),
      isRestDay,
      scene,
      highlights,
      statusLabel: isRestDay ? "HALT / RECOVERY" : fatigue >= 12 ? "REDLINE" : "STAGE ACTIVE"
    };
  });
}
