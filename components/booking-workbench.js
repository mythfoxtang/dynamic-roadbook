"use client";

import { useEffect, useMemo, useState } from "react";
import { BedDouble, CalendarRange, CarFront, CheckCircle2, Copy, ExternalLink, LoaderCircle, Plane, Ticket } from "lucide-react";
import { buildBookingPlan } from "@/lib/booking-planner";
import { loadBookingState, saveBookingState } from "@/lib/booking-state-store";

function SectionTitle({ icon: Icon, kicker, title, meta }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-white/46">{kicker}</div>
        <div className="mt-2 text-xl font-semibold text-white">{title}</div>
      </div>
      {meta ? <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-[0.18em] text-white/60">{meta}</div> : null}
      <div className="rounded-2xl border border-white/10 bg-white/8 p-3 text-white/78">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function PortalButton({ portal, onOpen }) {
  return (
    <a
      href={portal.href}
      target="_blank"
      rel="noreferrer"
      onClick={onOpen}
      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2.5 text-sm text-white/82 transition hover:bg-white/12"
    >
      {portal.label}
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}

async function copyText(value) {
  if (!value || !navigator?.clipboard?.writeText) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function CopyFieldButton({ label, value }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-black/12 px-4 py-3 text-left transition hover:bg-black/18"
    >
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">{label}</div>
        <div className="mt-2 text-sm text-white/82">{value || "--"}</div>
      </div>
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs ${copied ? "bg-emerald-300/12 text-emerald-100" : "bg-white/8 text-white/72"}`}>
        <Copy className="h-3.5 w-3.5" />
        {copied ? "已复制" : "复制"}
      </div>
    </button>
  );
}

function riskClassName(risk) {
  if (risk === "高") return "border-warning/35 bg-warning/10 text-warning";
  if (risk === "中") return "border-accent/30 bg-accent/10 text-accent";
  return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
}

function SignalPill({ risk }) {
  return <div className={`rounded-full border px-3 py-1.5 text-xs ${riskClassName(risk)}`}>{`风险 ${risk || "--"}`}</div>;
}

function ProbeSummary({ probeState, kind, onRunProbe }) {
  const data = probeState.data;

  return (
    <div className="mt-4 rounded-[18px] border border-accent/18 bg-accent/8 px-4 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#f0cb96]">价格信号</div>
          <div className="mt-2 text-sm leading-7 text-white/74">
            {kind === "flight" ? "直接从携程航班列表抓取价格、航班号、起降时间和中转信息。" : "直接探一版真实酒店价格，先判断这个落脚点值不值得住。"}
          </div>
        </div>
        <button
          type="button"
          onClick={onRunProbe}
          disabled={probeState.loading}
          className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/12 px-4 py-2.5 text-sm text-accent transition hover:bg-accent/16 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {probeState.loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {probeState.loading ? "探测中" : kind === "flight" ? "查机票" : "探测价格"}
        </button>
      </div>

      {probeState.error ? (
        <div className="mt-4 rounded-[16px] border border-warning/30 bg-warning/10 px-4 py-3 text-sm leading-7 text-warning">
          {probeState.error}
        </div>
      ) : null}

      {data ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <SignalPill risk={data.risk} />
            <div className="text-sm text-white/65">{data.reason || "已抓到价格摘要"}</div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <PriceBox label="最低价" value={data.minPrice ? `¥${data.minPrice}` : "--"} />
            <PriceBox label="参考价" value={data.referencePrice ? `¥${data.referencePrice}` : "--"} />
            <PriceBox label={kind === "flight" ? "航班数" : "样本量"} value={kind === "flight" ? data.flightCount || data.flights?.length || 0 : data.sampleCount || 0} />
          </div>
          {kind === "flight" ? <FlightResults flights={data.flights || []} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function PriceBox({ label, value }) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-black/12 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">{label}</div>
      <div className="mt-2 text-lg text-white">{value}</div>
    </div>
  );
}

function FlightResults({ flights }) {
  if (!flights.length) return null;

  return (
    <div className="mt-4 space-y-3">
      {flights.slice(0, 6).map((flight) => (
        <div key={flight.id || `${flight.flightNo}-${flight.departureTime}-${flight.price}`} className="rounded-[16px] border border-white/10 bg-black/12 px-4 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">{[flight.airline, flight.flightNo].filter(Boolean).join(" · ") || "航班信息"}</div>
              <div className="mt-2 text-sm text-white/72">
                {`${flight.departureTime || "--"} -> ${flight.arrivalTime || "--"}${flight.duration ? ` · ${flight.duration}` : ""}`}
              </div>
              <div className="mt-1 text-xs leading-5 text-white/48">
                {[flight.departureAirport, flight.arrivalAirport, flight.stopInfo].filter(Boolean).join(" / ") || flight.rawText || "携程航班卡片"}
              </div>
            </div>
            <div className="text-lg text-white">{flight.price ? `¥${flight.price}` : "--"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BookingAssistant({ itemId, assistant, portal, onOpenPortal, onUpdateState, probeState, onRunProbe }) {
  if (!assistant) return null;

  function openPortal() {
    onOpenPortal?.(itemId);
    window.open(portal.href, "_blank", "noopener,noreferrer");
  }

  const isFlight = assistant.kind === "flight";

  return (
    <div className="mt-4 rounded-[18px] border border-accent/18 bg-accent/8 px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#f0cb96]">预订助手</div>
      <div className="mt-2 text-sm leading-7 text-white/74">
        {isFlight ? "先查一版携程实时航班，确认价格、时间和中转，再打开携程做最终下单。" : "先复制住宿地点和日期，再打开携程。需要判断价格时，可以先跑价格探针。"}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {assistant.location ? <CopyFieldButton label="住宿地点" value={assistant.location} /> : null}
        {assistant.checkIn ? <CopyFieldButton label="入住日期" value={assistant.checkIn} /> : null}
        {assistant.checkOut ? <CopyFieldButton label="离店日期" value={assistant.checkOut} /> : null}
        {assistant.from ? <CopyFieldButton label="出发地" value={assistant.from} /> : null}
        {assistant.to ? <CopyFieldButton label="到达地" value={assistant.to} /> : null}
        {assistant.date ? <CopyFieldButton label="出发日期" value={assistant.date} /> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            if (assistant.location) await copyText(assistant.location);
            openPortal();
          }}
          className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/12 px-4 py-2.5 text-sm text-accent transition hover:bg-accent/16"
        >
          {isFlight ? "打开携程机票" : "复制地点并打开携程"}
          <ExternalLink className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onUpdateState(itemId, { status: "opened" })}
          className="rounded-full border border-white/10 bg-white/6 px-4 py-2.5 text-sm text-white/72 transition hover:bg-white/10"
        >
          我已完成搜索
        </button>
      </div>

      <ProbeSummary kind={assistant.kind || "hotel"} probeState={probeState} onRunProbe={onRunProbe} />
    </div>
  );
}

function StrategyPanel({ strategy }) {
  if (!strategy) return null;

  return (
    <div className="mt-4 rounded-[18px] border border-[#e3b56e]/18 bg-[#e3b56e]/8 px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#f0cb96]">预订策略</div>
          <div className="mt-2 text-sm leading-7 text-white/74">{strategy.reason}</div>
        </div>
        <div className="rounded-full border border-[#e3b56e]/25 bg-[#e3b56e]/10 px-3 py-1.5 text-xs text-[#f0cb96]">{`风险 ${strategy.risk || "--"}`}</div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <PriceBox label="下单窗口" value={strategy.bookingWindow || "--"} />
        <PriceBox label="退改建议" value={strategy.refundPolicy || "--"} />
        <PriceBox label="落点策略" value={strategy.locationStrategy || "--"} />
      </div>
    </div>
  );
}

function BookingCard({ itemId, title, meta, fields, rationale, portals, assistant, strategy, bookingState, onOpenPortal, onUpdateState, probeState, onRunProbe }) {
  const state = bookingState?.status || "todo";
  const orderRef = bookingState?.orderRef || "";
  const note = bookingState?.note || "";
  const openedAt = bookingState?.openedAt || "";
  const updatedAt = bookingState?.updatedAt || "";

  return (
    <article className="panel-soft rounded-[24px] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-lg font-semibold text-white">{title}</div>
          {meta ? <div className="mt-1 text-sm text-white/52">{meta}</div> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {portals.map((portal) => (
            <PortalButton key={`${title}-${portal.href}`} portal={portal} onOpen={() => onOpenPortal(itemId)} />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {fields.map((field) => (
          <div key={`${title}-${field.label}`} className="rounded-[18px] border border-white/10 bg-black/12 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">{field.label}</div>
            <div className="mt-2 text-sm leading-6 text-white/78">{field.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[18px] border border-dashed border-white/12 bg-black/10 px-4 py-4 text-sm leading-7 text-white/68">
        {rationale}
      </div>

      <StrategyPanel strategy={strategy} />

      <BookingAssistant
        itemId={itemId}
        assistant={assistant}
        portal={portals[0]}
        onOpenPortal={onOpenPortal}
        onUpdateState={onUpdateState}
        probeState={probeState}
        onRunProbe={onRunProbe}
      />

      <div className="mt-4 rounded-[18px] border border-white/10 bg-black/12 px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">返回回填</div>
            <div className="mt-2 text-sm text-white/76">
              {state === "booked" ? "已回填为已预订" : state === "opened" ? "已跳转到携程，等待用户返回确认" : "尚未跳转或回填"}
            </div>
            {openedAt ? <div className="mt-1 text-xs text-white/48">{`最近跳转：${openedAt}`}</div> : null}
            {updatedAt ? <div className="mt-1 text-xs text-white/48">{`最近更新：${updatedAt}`}</div> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onUpdateState(itemId, { status: "opened" })}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                state === "opened" ? "border-accent/35 bg-accent/12 text-accent" : "border-white/10 bg-white/6 text-white/72 hover:bg-white/10"
              }`}
            >
              我已去预订
            </button>
            <button
              type="button"
              onClick={() => onUpdateState(itemId, { status: "booked" })}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                state === "booked" ? "border-emerald-300/25 bg-emerald-300/12 text-emerald-100" : "border-white/10 bg-white/6 text-white/72 hover:bg-white/10"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              已预订
            </button>
            <button
              type="button"
              onClick={() => onUpdateState(itemId, { status: "todo", orderRef: "", note: "" })}
              className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/72 transition hover:bg-white/10"
            >
              重置
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <div className="mb-2 text-sm text-white/72">订单号 / 参考号</div>
            <input
              className="w-full rounded-[16px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
              placeholder="例如：酒店确认号、航班订单号"
              value={orderRef}
              onChange={(event) => onUpdateState(itemId, { orderRef: event.target.value })}
            />
          </label>
          <label className="block">
            <div className="mb-2 text-sm text-white/72">备注</div>
            <input
              className="w-full rounded-[16px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
              placeholder="例如：已比价，准备今晚下单"
              value={note}
              onChange={(event) => onUpdateState(itemId, { note: event.target.value })}
            />
          </label>
        </div>
      </div>
    </article>
  );
}

export default function BookingWorkbench({ days }) {
  const [activeTab, setActiveTab] = useState("hotel");
  const [bookingState, setBookingState] = useState({});
  const [hotelProbeByItem, setHotelProbeByItem] = useState({});
  const [flightProbeByItem, setFlightProbeByItem] = useState({});
  const bookingPlan = useMemo(() => buildBookingPlan(days), [days]);

  useEffect(() => {
    setBookingState(loadBookingState());
  }, []);

  function persist(nextState) {
    setBookingState(nextState);
    saveBookingState(nextState);
  }

  function nowLabel() {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date());
  }

  function updateItemState(itemId, patch) {
    const current = bookingState[itemId] || {};
    persist({
      ...bookingState,
      [itemId]: {
        ...current,
        ...patch,
        updatedAt: nowLabel()
      }
    });
  }

  function markPortalOpened(itemId) {
    const current = bookingState[itemId] || {};
    persist({
      ...bookingState,
      [itemId]: {
        ...current,
        status: current.status === "booked" ? "booked" : "opened",
        openedAt: nowLabel(),
        updatedAt: nowLabel()
      }
    });
  }

  async function runHotelProbe(itemId, assistant) {
    if (!assistant?.location || !assistant?.checkIn || !assistant?.checkOut) return;

    setHotelProbeByItem((current) => ({
      ...current,
      [itemId]: { loading: true, data: current[itemId]?.data || null, error: "" }
    }));

    try {
      const response = await fetch("/api/hotel-price-probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: assistant.city || assistant.location,
          keyword: assistant.location,
          checkIn: assistant.checkIn,
          checkOut: assistant.checkOut
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "酒店探针失败");
      setHotelProbeByItem((current) => ({ ...current, [itemId]: { loading: false, data, error: "" } }));
    } catch (error) {
      setHotelProbeByItem((current) => ({
        ...current,
        [itemId]: { loading: false, data: null, error: error?.message || "酒店探针失败" }
      }));
    }
  }

  async function runFlightProbe(itemId, assistant) {
    if (!assistant?.from || !assistant?.to || !assistant?.date) return;

    setFlightProbeByItem((current) => ({
      ...current,
      [itemId]: { loading: true, data: current[itemId]?.data || null, error: "" }
    }));

    try {
      const response = await fetch("/api/flight-price-probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: assistant.from,
          to: assistant.to,
          date: assistant.date
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "机票探针失败");
      setFlightProbeByItem((current) => ({ ...current, [itemId]: { loading: false, data, error: "" } }));
    } catch (error) {
      setFlightProbeByItem((current) => ({
        ...current,
        [itemId]: { loading: false, data: null, error: error?.message || "机票探针失败" }
      }));
    }
  }

  const sections = [
    { id: "hotel", label: "酒店", icon: BedDouble, count: bookingPlan.accommodation.length },
    { id: "transport", label: "交通", icon: Plane, count: bookingPlan.transport.length },
    { id: "car", label: "租车", icon: CarFront, count: bookingPlan.carRental ? 1 : 0 },
    { id: "ticket", label: "门票", icon: Ticket, count: bookingPlan.tickets.length }
  ];

  function renderSection() {
    if (activeTab === "hotel") {
      return (
        <div className="space-y-4">
          {bookingPlan.accommodation.map((stay) => {
            const assistant = {
              kind: "hotel",
              city: stay.city || "",
              location: stay.stayKeyword || stay.city,
              checkIn: stay.checkinDate || "",
              checkOut: stay.checkoutDate || ""
            };

            return (
              <BookingCard
                key={stay.id}
                itemId={stay.id}
                title={`${stay.city} · ${stay.nights} 晚`}
                meta={`DAY ${stay.coveredDays[0]}-${stay.coveredDays[stay.coveredDays.length - 1]}`}
                fields={[
                  { label: "入住", value: stay.checkinDate || "--" },
                  { label: "退房", value: stay.checkoutDate || "--" },
                  { label: "建议城市 / 落点", value: stay.city },
                  { label: "携程搜索关键词", value: stay.stayKeyword || stay.city },
                  { label: "对应路书天数", value: stay.coveredDays.join(" / ") }
                ]}
                rationale={stay.rationale}
                portals={[stay.portal]}
                assistant={assistant}
                strategy={stay.bookingStrategy}
                bookingState={bookingState[stay.id]}
                onOpenPortal={markPortalOpened}
                onUpdateState={updateItemState}
                probeState={hotelProbeByItem[stay.id] || { loading: false, data: null, error: "" }}
                onRunProbe={() => runHotelProbe(stay.id, assistant)}
              />
            );
          })}
        </div>
      );
    }

    if (activeTab === "transport") {
      return (
        <div className="space-y-4">
          {bookingPlan.transport.map((item) => {
            const assistant = {
              kind: "flight",
              from: item.from,
              to: item.to,
              date: item.date || ""
            };

            return (
              <BookingCard
                key={item.id}
                itemId={item.id}
                title={item.title}
                meta={`DAY ${item.day}`}
                fields={[
                  { label: "日期", value: item.date || "--" },
                  { label: "交通类型", value: item.type },
                  { label: "出发地", value: item.from },
                  { label: "到达地", value: item.to }
                ]}
                rationale={item.rationale}
                portals={[item.portal]}
                assistant={assistant}
                strategy={item.bookingStrategy}
                bookingState={bookingState[item.id]}
                onOpenPortal={markPortalOpened}
                onUpdateState={updateItemState}
                probeState={flightProbeByItem[item.id] || { loading: false, data: null, error: "" }}
                onRunProbe={() => runFlightProbe(item.id, assistant)}
              />
            );
          })}
        </div>
      );
    }

    if (activeTab === "car") {
      if (!bookingPlan.carRental) return null;

      return (
        <BookingCard
          itemId={bookingPlan.carRental.id}
          title={bookingPlan.carRental.title}
          meta="全程自驾方案"
          fields={[
            { label: "取车城市", value: bookingPlan.carRental.pickupCity },
            { label: "取车日期", value: bookingPlan.carRental.pickupDate || "--" },
            { label: "还车城市", value: bookingPlan.carRental.returnCity },
            { label: "还车日期", value: bookingPlan.carRental.returnDate || "--" },
            { label: "预估用车时长", value: `${bookingPlan.carRental.durationDays} 天` }
          ]}
          rationale={bookingPlan.carRental.rationale}
          portals={[bookingPlan.carRental.portal]}
          assistant={null}
          bookingState={bookingState[bookingPlan.carRental.id]}
          onOpenPortal={markPortalOpened}
          onUpdateState={updateItemState}
          probeState={{ loading: false, data: null, error: "" }}
          onRunProbe={() => {}}
        />
      );
    }

    return (
      <div className="space-y-4">
        {bookingPlan.tickets.map((item) => (
          <BookingCard
            key={item.id}
            itemId={item.id}
            title={item.title}
            meta={`DAY ${item.day}`}
            fields={[
              { label: "计划日期", value: item.date || "--" },
              { label: "对应住宿城市", value: item.city },
              { label: "建议动作", value: "提前确认门票 / 预约 / 玩乐产品" }
            ]}
            rationale={item.rationale}
            portals={item.portals}
            assistant={null}
            bookingState={bookingState[item.id]}
            onOpenPortal={markPortalOpened}
            onUpdateState={updateItemState}
            probeState={{ loading: false, data: null, error: "" }}
            onRunProbe={() => {}}
          />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="panel rounded-[24px] p-4 sm:p-5 sm:rounded-[28px]">
        <SectionTitle icon={CalendarRange} kicker="预订执行台" title="按路书生成预订任务" meta={`${bookingPlan.dateRange.startLabel} - ${bookingPlan.dateRange.endLabel}`} />

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="panel-soft rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/46">酒店任务</div>
            <div className="mt-2 text-lg text-white">{bookingPlan.accommodation.length} 段</div>
          </div>
          <div className="panel-soft rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/46">交通任务</div>
            <div className="mt-2 text-lg text-white">{bookingPlan.transport.length} 段</div>
          </div>
          <div className="panel-soft rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/46">租车任务</div>
            <div className="mt-2 text-lg text-white">{bookingPlan.carRental ? "1 段" : "0 段"}</div>
          </div>
          <div className="panel-soft rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/46">门票任务</div>
            <div className="mt-2 text-lg text-white">{bookingPlan.tickets.length} 个</div>
          </div>
        </div>

        <div className="mt-4 rounded-[20px] border border-dashed border-[#e3b56e]/28 bg-[#e3b56e]/6 px-4 py-4 text-sm leading-7 text-white/68">
          第一版先不做站内下单，而是把路书转成可预订清单。酒店和机票都可以先跑携程探针，拿到价格信号后再决定是否跳转下单。
        </div>
      </div>

      <div className="panel rounded-[24px] p-4 sm:p-5 sm:rounded-[28px]">
        <div className="flex flex-wrap gap-2">
          {sections.map((section) => {
            const Icon = section.icon;
            const active = section.id === activeTab;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveTab(section.id)}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm transition ${
                  active
                    ? "border-accent/35 bg-accent/12 text-accent"
                    : "border-white/10 bg-white/5 text-white/72 hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4" />
                {`${section.label} · ${section.count}`}
              </button>
            );
          })}
        </div>

        <div className="mt-5">{renderSection()}</div>
      </div>
    </section>
  );
}
