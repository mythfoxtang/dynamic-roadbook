"use client";

import { useMemo, useState } from "react";
import { Bot, Camera, LoaderCircle, Mail, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";

const AI_ACTIONS = [
  {
    id: "replan",
    label: "重排行程",
    description: "根据今天的实时进度，判断后面哪些点保留、缩短或放弃。",
    icon: RefreshCw,
    prompt: "请基于今天的实时进度、路线长度、定位建议和剩余停靠点，给我一版务实的后续安排。优先明确保留哪些点、哪些点压缩停留、哪些点建议今天放弃，并说明原因。"
  },
  {
    id: "summary",
    label: "今日总结",
    description: "把当天路线、实际进度和照片线索整理成清楚的日总结。",
    icon: Sparkles,
    prompt: "请基于今天的路线、实际到达/出发记录、定位信息和照片摘要，整理一版今日总结。先给简洁版，再给稍微细一点的版本。"
  },
  {
    id: "family",
    label: "发给家人",
    description: "生成一段适合发给爸妈看的消息，语气自然，不要太官方。",
    icon: Mail,
    prompt: "请根据今天的路线、实际进度和照片内容，写一段适合发给家人看的消息。语气自然、放心、别太官话，重点说今天到了哪、状态怎么样、接下来大概怎么走。"
  },
  {
    id: "photos",
    label: "照片整理",
    description: "根据当天照片和景点，给照片备注、标题和筛选建议。",
    icon: Camera,
    prompt: "请根据今天的照片摘要和路线节点，帮我做照片整理建议。包括哪些照片适合重点保留、每类照片可以起什么标题、备注怎么写更自然。"
  },
  {
    id: "risk",
    label: "风险提醒",
    description: "判断今天后半程的时间、强度和节奏风险，给出保守建议。",
    icon: ShieldAlert,
    prompt: "请结合今天的实时进度、剩余路线和停靠点，判断今天后半程的主要风险。重点看时间是否过晚、路线是否过长、节奏是否过紧，并给出保守建议。"
  }
];

export default function TripAiPanel({ context }) {
  const [selectedActionId, setSelectedActionId] = useState(AI_ACTIONS[0].id);
  const [note, setNote] = useState("");
  const [result, setResult] = useState("");
  const [resultTitle, setResultTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedAction = useMemo(
    () => AI_ACTIONS.find((item) => item.id === selectedActionId) ?? AI_ACTIONS[0],
    [selectedActionId]
  );

  async function runAction(action) {
    if (!action || isLoading) return;

    const userPrompt = note.trim()
      ? `${action.prompt}\n\n补充说明：${note.trim()}`
      : action.prompt;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/trip-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: userPrompt }],
          context
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "AI 请求失败");

      setResult(data?.reply || "这次没有拿到有效结果。");
      setResultTitle(action.label);
    } catch (error) {
      setErrorMessage(error?.message || "AI 请求失败");
    } finally {
      setIsLoading(false);
    }
  }

  function clearResult() {
    setResult("");
    setResultTitle("");
    setErrorMessage("");
    setNote("");
  }

  return (
    <section className="panel rounded-[24px] p-4 sm:p-5 sm:rounded-[28px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/50">AI 行程助手</div>
          <div className="mt-2 text-xl font-semibold text-white">点一个动作，直接出建议</div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            现在先不走自由对话，收口成几个稳定动作。基于当天路线、实时进度、定位和照片，直接给你分析结果。
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
          placeholder="可选补充，比如：我今天 15:40 才从这个点离开，或者想优先保留哪几个景点。"
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
            生成建议
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 p-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">分析结果</div>
        {isLoading ? (
          <div className="mt-4 rounded-[22px] border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-white/75">
            <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />
            正在结合当前路线、进度和照片生成建议...
          </div>
        ) : result ? (
          <div className="mt-4 rounded-[22px] border border-accent/20 bg-accent/10 px-4 py-4">
            <div className="mb-3 text-sm font-medium text-accent">{resultTitle}</div>
            <div className="whitespace-pre-wrap text-sm leading-7 text-white/84">{result}</div>
          </div>
        ) : (
          <div className="mt-4 text-sm leading-6 text-white/58">
            先选一个动作，再点“生成建议”。这块会显示 AI 的分析结果。
          </div>
        )}
      </div>
    </section>
  );
}
