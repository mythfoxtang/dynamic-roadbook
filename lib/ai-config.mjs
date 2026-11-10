import { randomBytes } from "node:crypto";
import { readTravelPrivate, writeTravelPrivate } from './travel-vault.mjs';

export const AI_COOKIE = "roadbook_ai_session";
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-flash";
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
const durable = ['development','production'].includes(process.env.NODE_ENV);
const upgradingExistingSessions = Boolean(globalThis.__roadbookAiSessions);
const sessions = globalThis.__roadbookAiSessions || (globalThis.__roadbookAiSessions = new Map(durable ? readTravelPrivate('ai-sessions', []).filter(([,s])=>s.expiresAt>Date.now()) : []));
function persistAiSessions(){if(durable)writeTravelPrivate('ai-sessions',[...sessions]);}
// Preserve an already configured browser session when upgrading the running server.
if(durable && upgradingExistingSessions && sessions.size && !globalThis.__aiSessionsMigrated){persistAiSessions();globalThis.__aiSessionsMigrated=true;}

export class AiError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const configured = (value) => Boolean(value && !/^your_/i.test(value));
export function validateAiInput(body) {
  if (!body || typeof body.apiKey !== "string" || !/^[\x21-\x7E]{10,512}$/.test(body.apiKey.trim())) throw new AiError("请填写有效的 DeepSeek API Key");
  const model = typeof body.model === "string" ? body.model.trim() : DEFAULT_DEEPSEEK_MODEL;
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model)) throw new AiError("请填写有效的模型名称");
  return { provider: "DeepSeek", apiKey: body.apiKey.trim(), baseUrl: DEEPSEEK_BASE_URL, model };
}
export function saveAiSession(config, previousId, now = Date.now()) {
  for (const [id, item] of sessions) if (item.expiresAt <= now) sessions.delete(id);
  if (previousId) sessions.delete(previousId);
  if (sessions.size >= 200) sessions.delete(sessions.keys().next().value);
  const id = randomBytes(32).toString("hex");
  sessions.set(id, { ...config, expiresAt: now + SESSION_SECONDS * 1000 });
  persistAiSessions();
  return id;
}
export function deleteAiSession(id) { sessions.delete(id); persistAiSessions(); }
export function resolveAiConfig(id, env = process.env, now = Date.now()) {
  const session = sessions.get(id);
  if (session && session.expiresAt > now) return { provider: session.provider, apiKey: session.apiKey, baseUrl: session.baseUrl, model: session.model, source: "session" };
  if (id) sessions.delete(id);
  if (configured(env.DEEPSEEK_API_KEY)) return { provider: "DeepSeek", apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL, baseUrl: DEEPSEEK_BASE_URL, source: "environment" };
  if (configured(env.DASHSCOPE_API_KEY)) return { provider: "DashScope", apiKey: env.DASHSCOPE_API_KEY, model: env.DASHSCOPE_MODEL || "qwen-plus", baseUrl: env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1", source: "environment" };
  return null;
}
export function publicAiConfig(config) {
  return config ? { configured: true, provider: config.provider, model: config.model, source: config.source, baseUrl: config.baseUrl } : { configured: false, provider: "DeepSeek", model: DEFAULT_DEEPSEEK_MODEL, baseUrl: DEEPSEEK_BASE_URL };
}
export function aiUpstreamError(status, provider = "DeepSeek") {
  const message = { 401: "API Key 无效，请重新填写", 402: "账户余额不足，请在官方平台充值", 403: "账户没有此接口的访问权限", 404: "模型或接口不存在，请检查模型名称", 429: "请求频率过高，请稍后再试" }[status] || "接口暂时不可用，请稍后重试";
  return new AiError(`${provider}：${message}`, status >= 400 && status < 500 ? status : 502);
}
export async function checkDeepSeek(config, fetchImpl = fetch) {
  let response;
  try { response = await fetchImpl(`${DEEPSEEK_BASE_URL}/models`, { headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) }); }
  catch { throw new AiError("DeepSeek 连接超时或网络不可用，请稍后重试", 502); }
  if (!response.ok) throw aiUpstreamError(response.status);
  const data = await response.json().catch(() => null);
  if (!Array.isArray(data?.data)) throw new AiError("DeepSeek 返回的模型列表无效", 502);
  const models = data.data.map((item) => item?.id).filter((id) => typeof id === "string");
  if (!models.includes(config.model)) throw new AiError(`当前账号未返回模型 ${config.model}，请改填可用模型名称：${models.slice(0, 10).join("、") || "无"}`);
  return models;
}

// Both existing assistants use the same authenticated server-side transport.
export function createAiFetch(config, fetchImpl = fetch) {
  return async (url, options) => {
    const payload = JSON.parse(options.body);
    if (config.provider === "DeepSeek") payload.thinking = { type: "disabled" };
    let response;
    try { response = await fetchImpl(url, { ...options, body: JSON.stringify(payload), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(90000) }); }
    catch { throw new AiError(`${config.provider} 连接超时或网络不可用，请稍后重试`, 502); }
    if (!response.ok) throw aiUpstreamError(response.status, config.provider);
    return response;
  };
}
