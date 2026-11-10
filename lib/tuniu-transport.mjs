import { createHash } from "node:crypto";
import { TravelError } from "./travel-core.mjs";
const budgets = globalThis.__tuniuBudgets || (globalThis.__tuniuBudgets = new Map());
const dateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const TOOL_NAMES = {
  hotel: { search: ["tuniuHotelSearch", "tuniu_hotel_search"], detail: ["tuniuHotelDetail", "tuniu_hotel_detail"], book: ["tuniuHotelCreateOrder", "tuniu_hotel_create_order"] },
  flight: { search: ["searchLowestPriceFlight"], detail: ["multiCabinDetails"], requirements: ["getBookingRequiredInfo"], book: ["saveOrder"], cancel: ["cancelOrder"] },
  train: { search: ["searchLowestPriceTrain"], detail: ["queryTrainDetail"], book: ["bookTrain"], order: ["queryTrainOrderDetail"], cancel: ["cancelOrder"] },
};
export function quotaState(credential, now = Date.now()) {
  const key = createHash("sha256").update(credential.secret).digest("hex");
  let state = budgets.get(key);
  if (!state || state.date !== dateKey()) { state = { date: dateKey(), day: 0, minute: [] }; budgets.set(key, state); }
  state.minute = state.minute.filter((n) => now - n < 60000);
  return { state, usedToday: state.day, remainingToday: Math.max(0, 50 - state.day), usedLastMinute: state.minute.length, retryAfter: state.minute.length >= 5 ? Math.ceil((60000 - (now - state.minute[0])) / 1000) : 0 };
}
function consume(credential) {
  const quota = quotaState(credential);
  if (quota.remainingToday < 1) throw new TravelError("本地记录的途牛每日 50 次请求预算已用完，请明天再试", 429, "DAILY_QUOTA");
  if (quota.retryAfter) throw new TravelError(`查询较频繁，请 ${quota.retryAfter} 秒后继续。已有结果仍可本地筛选，不消耗额度。`, 429, "MINUTE_QUOTA", { retryAfter: quota.retryAfter });
  quota.state.day++; quota.state.minute.push(Date.now());
}
export function parseRpc(text, id) {
  try { const parsed = JSON.parse(text); if (parsed.id === id) return parsed; } catch { /* Try SSE below. */ }
  const events = text.replace(/\r\n/g, "\n").split(/\n\n/);
  for (const event of events) {
    const payload = event.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (!payload || payload === "[DONE]") continue;
    try { const data = JSON.parse(payload); if (data.id === id) return data; } catch { /* Ignore unrelated SSE notifications. */ }
  }
  throw new TravelError("途牛响应不是可识别的 JSON / SSE 数据", 502, "MALFORMED_RESPONSE");
}
export function unpackTool(result) {
  if (result?.isError) throw new TravelError("供应商工具执行失败，请检查参数、授权和当前库存", 502, "PROVIDER_TOOL_ERROR");
  let data = result?.structuredContent;
  if (!data || typeof data !== "object") {
    const texts = (result?.content || []).filter((c) => c.type === "text").map((c) => c.text);
    for (const text of texts) {
      try { data = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); break; } catch { /* Some tools intentionally return requirements text. */ }
    }
    if (!data) return { text: texts.join("\n") };
  }
  // The live flight server wraps a JSON string in {result: "..."}, unlike its public examples.
  for (let depth = 0; depth < 3 && data && typeof data === "object" && typeof data.result === "string"; depth++) {
    try { data = JSON.parse(data.result); }
    catch { return { text: data.result }; }
  }
  if (data === null || typeof data !== "object") throw new TravelError("供应商返回了无法解析的业务结构", 502, "MALFORMED_TOOL_RESULT");
  if (data.success === false || data.successCode === false) throw new TravelError("供应商未返回成功结果，请调整条件或检查产品权限", 502, "PROVIDER_BUSINESS_ERROR");
  return data;
}
export async function tuniuRpc(credential, domain, method, params, { fetchImpl = fetch, countQuota = true } = {}) {
  if (!["hotel", "flight", "train"].includes(domain)) throw new TravelError("不支持的供应商服务");
  if (countQuota) consume(credential);
  const id = Date.now();
  const url = `https://openapi.tuniu.cn/${credential.type === "oauth" ? "hybrid/mcp" : "mcp"}/${domain}`;
  const auth = credential.type === "oauth" ? { Authorization: `Bearer ${credential.secret}` } : { apiKey: credential.secret };
  let response;
  try { response = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...auth }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params: params || {} }), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(60000) }); }
  catch { throw new TravelError("供应商连接超时或网络不可用；交易请求不会自动重试", 502, "NETWORK_ERROR"); }
  if (!response.ok) throw new TravelError(response.status === 401 ? "途牛授权失效或 Key 无效，请重新连接" : response.status === 429 ? "供应商请求额度不足，请稍后继续" : `供应商返回 HTTP ${response.status}，请稍后再试`, response.status === 401 ? 401 : response.status === 429 ? 429 : 502, "PROVIDER_HTTP_ERROR");
  const text = await response.text();
  if (text.length > 8000000) throw new TravelError("供应商返回数据过大", 502, "RESPONSE_TOO_LARGE");
  const rpc = parseRpc(text, id);
  if (rpc.error) throw new TravelError("供应商协议调用失败，请重新检查可用工具与权限", 502, "PROVIDER_RPC_ERROR");
  return rpc.result;
}
export function findTool(tools, domain, action) {
  const aliases = TOOL_NAMES[domain]?.[action] || [];
  const simplify = (s) => String(s).replace(/_/g, "").toLowerCase();
  return tools.find((tool) => aliases.some((name) => simplify(name) === simplify(tool.name)));
}
export async function listTuniuTools(credential, domain, options) {
  const result = await tuniuRpc(credential, domain, "tools/list", {}, options);
  if (!Array.isArray(result?.tools)) throw new TravelError("供应商工具列表不完整", 502, "MISSING_TOOLS");
  return result.tools;
}
export async function callTuniu(credential, domain, action, args, tools, options) {
  const tool = findTool(tools, domain, action);
  if (!tool) throw new TravelError(`账号未开放 ${domain} / ${action} 工具`, 409, "MISSING_CAPABILITY");
  const properties = tool.inputSchema?.properties;
  if (properties) for (const key of Object.keys(args)) if (!(key in properties)) throw new TravelError(`供应商当前 ${action} 工具不接受参数 ${key}，需要核对实际协议`, 409, "SCHEMA_MISMATCH");
  return unpackTool(await tuniuRpc(credential, domain, "tools/call", { name: tool.name, arguments: args }, options));
}
