"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, LoaderCircle } from "lucide-react";

export default function AiSettings() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("deepseek-flash");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/ai/config/", { signal: abort.signal, cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("无法读取 AI 配置，请确认服务端已启动");
      const data = await response.json(); setStatus(data); if (data.provider === "DeepSeek") setModel(data.model);
    }).catch((err) => { if (!abort.signal.aborted) setError(err.message); });
    return () => abort.abort();
  }, []);

  async function submit(event) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/ai/config/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey, model }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "配置保存失败");
      setStatus(data); setApiKey(""); setMessage(data.message);
    } catch (err) { setError(err.message || "网络连接失败，请重试"); }
    finally { setLoading(false); }
  }
  async function clear() {
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/ai/config/", { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "清除失败");
      setStatus(data); setApiKey(""); setMessage(data.message);
    } catch (err) { setError(err.message || "网络连接失败"); }
    finally { setLoading(false); }
  }
  const fieldClass = "mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent";
  return <section aria-label="DeepSeek API 配置" className="panel rounded-[24px] p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-semibold text-white"><KeyRound className="h-5 w-5 text-accent" />DeepSeek API 配置</h2><span className="text-xs text-white/60">{status ? status.configured ? `当前：${status.provider} / ${status.model}` : "尚未配置 AI" : "读取配置中…"}</span></div>
    <p className="mt-3 text-sm leading-7 text-white/65">把你在 DeepSeek 官方平台创建的 API Key 填在下方，然后点击“保存并检测连接”。保存后，行程规划和当天 AI 助手会使用这项配置。</p>
    <p className="mt-3 text-sm leading-7 text-white/65">外网入口和本机入口的浏览器会话各自独立。若此处显示通义千问，旅行智能体仍需另配 DeepSeek。个人使用可在当前入口重新保存 Key；若要让外网用户共用，请由服务器管理员在 .env.local 设置 DEEPSEEK_API_KEY 和 DEEPSEEK_MODEL=deepseek-flash 后重启服务。共用配置会消耗服务器账号额度，不要把 Key 发给访客。</p>
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-[2fr,1fr]"><label className="block text-sm text-white/75">DeepSeek API Key<input required type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="在这里粘贴你的 API Key" minLength={10} maxLength={512} className={fieldClass} /></label><label className="block text-sm text-white/75">模型名称<input required value={model} onChange={(e) => setModel(e.target.value)} list="deepseek-models" maxLength={100} className={fieldClass} /><datalist id="deepseek-models"><option value="deepseek-flash" /><option value="deepseek-v4-pro" /></datalist></label></div>
      <p className="text-xs leading-6 text-white/50">官方地址：https://api.deepseek.com。配置加密保存在本机服务端，最长 30 天；服务重启可以恢复。浏览器仅保存会话凭证，不保存密钥。旧会话仍按原到期时间失效。</p>
      <div className="flex flex-wrap gap-3"><button disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-[#181410] disabled:opacity-50">{loading ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}{loading ? "处理中…" : "保存并检测连接"}</button><button type="button" disabled={loading || !status?.configured} onClick={clear} className="rounded-xl border border-white/20 px-4 py-3 text-sm text-white/75 disabled:opacity-40">清除会话配置</button><Link href="/agent/" className="rounded-xl border border-white/20 px-4 py-3 text-sm text-white/75">打开旅行智能体</Link></div>
    </form>
    <div aria-live="polite">{error ? <p role="alert" className="mt-4 text-sm leading-7 text-warning">{error}</p> : null}{message ? <p className="mt-4 text-sm leading-7 text-white/75">{message}</p> : null}</div>
  </section>;
}
