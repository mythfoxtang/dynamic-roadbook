"use client";

import { useMemo, useState } from "react";
import { Bot, Camera, CheckCircle2, LoaderCircle, Mail, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { runTripAssistantAction } from "@/lib/trip-assistant";

const AI_ACTIONS = [
  {
    id: "replan",
    label: "重排当天路线",
    description: "基于今天的驾驶强度和停靠点，生成一版可直接应用的保守重排方案。",
    icon: RefreshCw,
    placeholder: "例如：白沙一定要保留，最后一个点如果太赶可以删。"
  },
  {
    id: "summary",
    label: "今日总结",
    description: "把今天的路线、停靠点和照片线索整理成清晰总结。",
    icon: Sparkles,
    placeholder: "例如：想要一版简洁版，再给一版细一点的。"
  },
  {
    id: "family",
    label: "发给家人",
    description: "生成一段适合发给家人的报平安消息。",
    icon: Mail,
    placeholder: "例如：语气轻松一点，不要太官方。"
  },
  {
    id: "photos",
    label: "照片整理",
    description: "根据当天照片摘要和停靠点，给出标题和保留建议。",
    icon: Camera,
    placeholder: "例如：优先筛出适合发朋友圈的照片。"
  },
  {
    id: "risk",
    label: "风险提醒",
    description: "判断今天后半程的时间、里程和疲劳风险。",
    icon: ShieldAlert,
    placeholder: "例如：如果今天想赶到落脚点，哪些地方要克制。"
  }
];

export default function TripAiPanel({ context, onApplyPatch }) {
  const [selectedActionId, setSelectedActionId] = useState(AI_ACTIONS[0].id);
  const [note, setNote] = useState("");
  const [result, setResult] = useState("");
  const [patch, setPatch] = useState(null);
  const [resultTitle, setResultTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [applyState, setApplyState] = useState("idle");

  const selectedAction = useMemo(
    () => AI_ACTIONS.find((item) => item.id === selectedActionId) ?? AI_ACTIONS[0],
    [selectedActionId]
  );

  async function runAction(action) {
    if (!action || isLoading) return;

    setIsLoading(true);
    setErrorMessage("");
    setApplyState("idle");
    setPatch(null);

    try {
      const data = runTripAssistantAction({
        actionId: action.id,
        note,
        context
      });

      setResult(data?.reply || "这次没有拿到有效结果。");
      setPatch(data?.patch || null);
      setResultTitle(action.label);
    } catch (error) {
      setErrorMessage(error?.message || "行程助手执行失败");
    } finally {
      setIsLoading(false);
    }
  }

  function clearResult() {
    setResult("");
    setPatch(null);
    setResultTitle("");
    setErrorMessage("");
    setNote("");
    setApplyState("idle");
  }

  function applyPatch() {
    if (!patch) return;
    onApplyPatch?.(patch);
    setApplyState("applied");
  }

  return (
    <section className="panel rounded-[24px] p-4 sm:p-5 sm:rounded-[28px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/50">AI 行程助手</div>
          <div className="mt-2 text-xl font-semibold text-white">先分析，再决定是否应用修改</div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            静态发布版会在浏览器本地生成建议。重排动作会返回结构化 patch，确认后可以直接应用到当天路线。
          </p>
        </div>
        <button
          type="button"
          onClick={clearResult}
          className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/72 transition hover:bg-white/10"
        >
          清空结果
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {AI_ACTIONS.map((item) => {
          const Icon = item.icon;
          const active = item.id === selectedActionId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedActionId(item.id)}
              className={`rounded-[22px] border p-4 text-left transition ${
                active
                  ? "border-accent/40 bg-accent/12 shadow-[0_12px_40px_rgba(213,161,90,0.12)]"
                  : "border-white/10 bg-white/5 hover:bg-white/8"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{item.label}</div>
                  <div className="mt-2 text-sm leading-6 text-white/65">{item.description}</div>
                </div>
                <div className={`rounded-2xl border p-2 ${active ? "border-accent/35 bg-accent/10 text-accent" : "border-white/10 bg-white/5 text-white/70"}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-[24px] border border-white/10 bg-black/15 p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/50">
          <Bot className="h-4 w-4" />
          当前动作
        </div>
        <div className="mt-3 text-lg font-semibold text-white">{selectedAction.label}</div>
        <div className="mt-2 text-sm leading-6 text-white/68">{selectedAction.description}</div>

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={selectedAction.placeholder}
          rows={3}
          className="mt-4 w-full rounded-[22px] border border-white/10 bg-white/8 px-4 py-4 text-sm text-white placeholder:text-white/35 outline-none"
        />

        {errorMessage ? <div className="mt-3 text-sm text-amber-200">{errorMessage}</div> : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => runAction(selectedAction)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            生成结果
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 p-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">分析结果</div>
        {isLoading ? (
          <div className="mt-4 rounded-[22px] border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-white/75">
            <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />
            正在分析当天路线和执行状态...
          </div>
        ) : result ? (
          <div className="mt-4 rounded-[22px] border border-accent/20 bg-accent/10 px-4 py-4">
            <div className="mb-3 text-sm font-medium text-accent">{resultTitle}</div>
            <div className="whitespace-pre-wrap text-sm leading-7 text-white/84">{result}</div>

            {patch ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={applyPatch}
                  disabled={applyState === "applied"}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/12 px-4 py-2.5 text-sm text-emerald-100 transition hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {applyState === "applied" ? "已应用到当天路线" : "应用到当天路线"}
                </button>
                <div className="text-xs text-white/58">
                  {patch.operations?.length ? `本次会执行 ${patch.operations.length} 个结构化修改动作。` : "本次没有结构化 patch。"}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 text-sm leading-6 text-white/58">
            先选一个动作，再点“生成结果”。如果是重排行程，确认后可以直接应用。
          </div>
        )}
      </div>
    </section>
  );
}
