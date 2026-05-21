import { MapPinned, Plane, TrainFront, Users } from "lucide-react";

function kindMeta(kind) {
  if (kind === "flight") {
    return {
      label: "航班",
      tone: "border-sky-300/25 bg-sky-300/10 text-sky-100",
      icon: Plane
    };
  }

  if (kind === "train") {
    return {
      label: "列车",
      tone: "border-amber-300/25 bg-amber-300/10 text-amber-100",
      icon: TrainFront
    };
  }

  if (kind === "pickup" || kind === "meetup") {
    return {
      label: kind === "pickup" ? "接人" : "会合",
      tone: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
      icon: Users
    };
  }

  if (kind === "scenic") {
    return {
      label: "景点段",
      tone: "border-amber-200/25 bg-amber-200/10 text-amber-100",
      icon: MapPinned
    };
  }

  return {
    label: "行程",
    tone: "border-white/12 bg-white/8 text-white/80",
    icon: MapPinned
  };
}

function TransportSegmentCard({ segment }) {
  const meta = kindMeta(segment.kind);
  const Icon = meta.icon;
  const routeLabel = segment.from && segment.to
    ? `${segment.from} → ${segment.to}`
    : segment.title || segment.code || meta.label;
  const timeLabel = [segment.departureLabel, segment.arrivalLabel].filter(Boolean).join(" / ");
  const detailLine = [segment.fromDetail, segment.toDetail].filter(Boolean).join(" → ");
  const extraLine = [segment.duration ? `约 ${segment.duration}` : "", segment.via ? `经停 ${segment.via}` : ""].filter(Boolean).join(" · ");

  return (
    <article className="rounded-[20px] border border-white/10 bg-black/12 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${meta.tone}`}>
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </div>
        {segment.code ? <div className="text-sm font-semibold text-white">{segment.code}</div> : null}
      </div>

      <div className="mt-3 text-base font-semibold text-white">{routeLabel}</div>
      {segment.carrier ? <div className="mt-1 text-sm text-white/58">{segment.carrier}</div> : null}
      {timeLabel ? <div className="mt-3 text-sm text-white/74">{timeLabel}</div> : null}
      {detailLine ? <div className="mt-1 text-xs leading-5 text-white/52">{detailLine}</div> : null}
      {extraLine ? <div className="mt-2 text-xs leading-5 text-white/52">{extraLine}</div> : null}
      {segment.note ? <div className="mt-2 text-sm leading-6 text-white/65">{segment.note}</div> : null}
    </article>
  );
}

function DayEventCard({ event }) {
  const meta = kindMeta(event.kind);
  const Icon = meta.icon;

  return (
    <article className="rounded-[20px] border border-white/10 bg-white/6 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${meta.tone}`}>
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </div>
        {event.code ? <div className="text-sm font-semibold text-white">{event.code}</div> : null}
      </div>

      <div className="mt-3 text-base font-semibold text-white">{event.title}</div>
      {event.person ? <div className="mt-1 text-sm text-white/58">{event.person}</div> : null}
      {event.window ? <div className="mt-3 text-sm text-white/74">{event.window}</div> : null}
      {event.location ? <div className="mt-1 text-xs leading-5 text-white/52">{event.location}</div> : null}
      {event.note ? <div className="mt-2 text-sm leading-6 text-white/65">{event.note}</div> : null}
    </article>
  );
}

export default function DayLogisticsPanel({ segments = [], events = [], compact = false, title = "交通与会合" }) {
  if (!segments.length && !events.length) return null;

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">{title}</div>

      {segments.length ? (
        <div className={`mt-4 grid gap-3 ${compact ? "" : "xl:grid-cols-2"}`}>
          {segments.map((segment, index) => (
            <TransportSegmentCard key={`${segment.kind || "segment"}-${segment.code || segment.title || index}`} segment={segment} />
          ))}
        </div>
      ) : null}

      {events.length ? (
        <div className={`grid gap-3 ${segments.length ? "mt-4" : "mt-4"} ${compact ? "" : "xl:grid-cols-2"}`}>
          {events.map((event, index) => (
            <DayEventCard key={`${event.kind || "event"}-${event.code || event.title || index}`} event={event} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
