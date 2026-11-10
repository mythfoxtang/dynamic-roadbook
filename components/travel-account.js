"use client";
import { useEffect, useState } from "react";
export default function TravelAccount({ onStatus, liveStatus }) {
  const [status, setStatus] = useState(null), [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  function update(data) { setStatus(data); onStatus?.(data); }
  useEffect(() => { const abort = new AbortController(); fetch("/api/travel/account/", { cache: "no-store", signal: abort.signal }).then((r) => r.json()).then(update).catch(() => {}); return () => abort.abort(); }, []);
  useEffect(() => { if (liveStatus) setStatus(liveStatus); }, [liveStatus]);
  async function request(action) {
    setBusy(true); setError("");
    try {
      const response = await fetch(action === "login" ? "/api/travel/auth/start/" : "/api/travel/account/", { method: action === "delete" ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: action === "delete" ? undefined : JSON.stringify(action === "save" ? { apiKey } : { action }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "连接失败");
      if (data.url) { window.location.assign(data.url); return; }
      update(data); setApiKey("");
    } catch (e) { setError(e.message || "网络不可用，请稍后重试"); }
    finally { setBusy(false); }
  }
  return <section className="panel rounded-2xl p-5" aria-label="国内旅游供应商授权">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-white">连接你的途牛账号</h2><span className="text-xs text-white/60">{status?.connected ? "账号已连接" : "尚未连接正式货源"}</span></div>
    <p className="mt-2 text-sm leading-7 text-white/65">授权后查询国内机票与酒店。密钥只发给本站后端与途牛官方接口，不要粘贴到聊天里。</p>
    {status?.fromEnvironment ? <p className="mt-2 text-sm text-accent">当前已使用服务器配置的 Key，无需重复填写。断开浏览器会话后仍会使用服务器配置；彻底停用请清除服务器 TUNIU_API_KEY。</p> : null}
    <p className="mt-2 text-xs leading-6 text-white/55">没有账号：先点“登录途牛并授权”，在途牛官方页面按提示注册／登录，再同意授权。注册、短信验证码和实名资料由你本人在官方页面填写；返回本站后点“检测酒店和机票、高铁权限”。如果官方不接受本地回调，可在下方开放平台申请个人 Key。</p>
    <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => request("login")} className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-[#181410] disabled:opacity-50">登录途牛并授权</button><button type="button" disabled={busy || !status?.connected} onClick={() => request("inspect")} className="rounded-xl border border-white/20 px-4 py-3 text-sm text-white/80 disabled:opacity-40">检测酒店和机票、高铁权限</button><button type="button" disabled={busy || !status?.connected} onClick={() => request("delete")} className="rounded-xl border border-white/20 px-4 py-3 text-sm text-white/70 disabled:opacity-40">断开连接</button></div>
    <details className="mt-4 text-sm text-white/65"><summary className="cursor-pointer">已有途牛开放平台 API Key？在这里配置</summary><form className="mt-3 flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); request("save"); }}><label className="min-w-0 flex-1 text-xs">途牛 API Key<input required type="password" autoComplete="off" value={apiKey} minLength={8} maxLength={2048} onChange={(e) => setApiKey(e.target.value)} className="mt-2 w-full rounded-xl border border-white/20 bg-black/20 px-3 py-3 text-sm text-white outline-none focus:border-accent" /></label><button disabled={busy} className="self-end rounded-xl border border-accent/40 px-4 py-3 text-sm text-accent disabled:opacity-50">保存并检查三类权限</button></form><a href="https://open.tuniu.com/mcp" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-accent underline">途牛官方开放平台</a></details>
    {status?.connected ? <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/65">{["hotel", "flight", "train"].map((domain) => <span key={domain}>{domain === "hotel" ? "酒店" : domain === "train" ? "高铁" : "机票"}：{!status.domains?.[domain] ? "待检测权限" : status.domains?.[domain]?.ok ? `查询已通过 · ${status.domains[domain].book ? "账号开放创单工具" : "未开放创单工具"}` : status.domains?.[domain]?.message || "尚未开放"}</span>)}<span>本进程估算剩余 {status.quota?.remainingToday ?? "--"}/50 次／日；账号多 Key 共用的实际额度以途牛为准。</span></div> : null}
    <p className="mt-3 text-xs leading-6 text-white/50">连接凭据加密保存在本机未纳入 Git 的目录，可跨服务重启恢复，最长 12 小时或令牌有效期。官方接口当前付款需在途牛完成；站内付款尚未获授权，本站不冒充已支付或已出票。</p>
    {busy ? <p className="mt-3 text-sm text-white/65" role="status">正在连接官方接口…</p> : null}{error ? <p role="alert" className="mt-3 text-sm leading-7 text-warning">{error}</p> : null}
  </section>;
}
