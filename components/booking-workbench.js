"use client";

import { useEffect, useMemo, useState } from "react";
import { BedDouble, CalendarRange, CarFront, CheckCircle2, Copy, ExternalLink, Plane, Ticket } from "lucide-react";
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

function BookingAssistant({ itemId, assistant, portal, onOpenPortal, onUpdateState }) {
  if (!assistant) return null;

  function openPortal() {
    onOpenPortal?.(itemId);
    window.open(portal.href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-4 rounded-[18px] border border-accent/18 bg-accent/8 px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#f0cb96]">预订助手</div>
      <div className="mt-2 text-sm leading-7 text-white/74">
        按下面顺序操作：先复制住宿地点和日期，再打开携程。如果携程默认按定位展示，直接粘贴即可。
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {assistant.location ? <CopyFieldButton label="住宿地点" value={assistant.location} /> : null}
        {assistant.checkIn ? <CopyFieldButton label="入住日期" value={assistant.checkIn} /> : null}
        {assistant.checkOut ? <CopyFieldButton label="离店日期" value={assistant.checkOut} /> : null}
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
          复制地点并打开携程
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
    </div>
  );
}

function BookingCard({ itemId, title, meta, fields, rationale, portals, assistant, bookingState, onOpenPortal, onUpdateState }) {
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

      <BookingAssistant itemId={itemId} assistant={assistant} portal={portals[0]} onOpenPortal={onOpenPortal} onUpdateState={onUpdateState} />

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
          {bookingPlan.accommodation.map((stay) => (
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
              assistant={{
                location: stay.stayKeyword || stay.city,
                checkIn: stay.checkinDate || "",
                checkOut: stay.checkoutDate || ""
              }}
              bookingState={bookingState[stay.id]}
              onOpenPortal={markPortalOpened}
              onUpdateState={updateItemState}
            />
          ))}
        </div>
      );
    }

    if (activeTab === "transport") {
      return (
        <div className="space-y-4">
          {bookingPlan.transport.map((item) => (
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
              assistant={null}
              bookingState={bookingState[item.id]}
              onOpenPortal={markPortalOpened}
              onUpdateState={updateItemState}
            />
          ))}
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
          第一版先不做站内下单，而是把路书转成“可预订清单”，再跳到携程官方对应入口。等后面确认合作方式或开放能力，再考虑商品搜索、价格回填和订单回写。
        </div>

        <div className="mt-4 rounded-[20px] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-white/68">
          现在支持的“即时返还”是返回页面后的本地回填：你从携程回来后，可以立刻把该任务标成“已预订”，并记录订单号和备注。真正的自动回传订单状态，需要携程 / Trip.com 提供正式的订单接口、Webhook 或合作回调。
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
