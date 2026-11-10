import { AiError, AI_COOKIE, resolveAiConfig } from "./ai-config.mjs";
import { isSameOriginRequest } from "./request-origin.mjs";

export function sameOrigin(request) {
  if (!isSameOriginRequest(request)) throw new AiError("不允许跨站修改 AI 配置或发起模型请求", 403);
}
export async function aiRequestBody(request) {
  sameOrigin(request);
  if (Number(request.headers.get("content-length")) > 150000) throw new AiError("请求内容过长", 413);
  const raw = await request.text();
  if (raw.length > 150000) throw new AiError("请求内容过长", 413);
  let body;
  try { body = JSON.parse(raw); } catch { throw new AiError("请求必须为有效 JSON"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AiError("请求内容须为 JSON 对象");
  return body;
}
export function requestAiConfig(request) {
  const config = resolveAiConfig(request.cookies.get(AI_COOKIE)?.value);
  if (!config) throw new AiError("尚未配置 AI，请在「DeepSeek API 配置」中填写 API Key 并保存", 503);
  return config;
}
export function safeAiError(error) {
  return { error: error instanceof AiError ? error.message : "AI 返回的结果无效，请稍后重试", status: error instanceof AiError ? error.status : 502 };
}
