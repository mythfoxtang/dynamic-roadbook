import { createHash } from "node:crypto";
import { listTuniuTools, findTool, quotaState } from "./tuniu-transport.mjs";
import { TravelError } from "./travel-core.mjs";
const connections = globalThis.__travelConnections || (globalThis.__travelConnections = new Map());
export function credentialId(credential) { return createHash("sha256").update(credential.type + credential.secret).digest("hex"); }
export function accountOwner(credential) { return createHash("sha256").update(credential.providerUserId ? `https://openapi.tuniu.cn|${credential.providerUserId}` : credential.type + credential.secret).digest("hex"); }
export async function inspectTravelAccount(credential, options = {}) {
  const cached = connections.get(credentialId(credential));
  const domains = options.domains || ["hotel", "flight", "train"];
  if (!options.refresh && cached && domains.every((d) => cached.domains[d]?.ok && Date.now() - cached.domains[d].checkedAt < 3600000)) return cached;
  const state = { domains: { ...cached?.domains }, checkedAt: Date.now() };
  for (const domain of domains) {
    try {
      const tools = await listTuniuTools(credential, domain, options);
      state.domains[domain] = { tools, checkedAt:Date.now(), ok: Boolean(findTool(tools, domain, "search")), search: Boolean(findTool(tools, domain, "search")), detail: Boolean(findTool(tools, domain, "detail")), book: Boolean(findTool(tools, domain, "book")), cancel: Boolean(findTool(tools, domain, "cancel")) };
    } catch (error) { state.domains[domain] = { ok: false, message: error.message, status:error.status, code:error.code, retryAfter:error.retryAfter, tools: [] }; }
  }
  connections.set(credentialId(credential), state);
  return state;
}
export async function getTravelTools(credential, domain, options) {
  const state = await inspectTravelAccount(credential, { ...options, domains:[domain] });
  if (!state.domains[domain]?.ok) throw new TravelError(state.domains[domain]?.message || "该账号暂未开放所需查询权限", state.domains[domain]?.status || 409, state.domains[domain]?.code || "MISSING_CAPABILITY", {retryAfter:state.domains[domain]?.retryAfter});
  return state.domains[domain].tools;
}
export function publicConnection(credential) {
  if (!credential) return { connected: false, provider: "途牛", domains: {}, paymentMode: "supplier_checkout" };
  const state = connections.get(credentialId(credential));
  return { connected: true, provider: "途牛", authType: credential.type, fromEnvironment: Boolean(credential.fromEnvironment), checkedAt: state?.checkedAt || null, domains: state ? Object.fromEntries(Object.entries(state.domains).map(([domain, { tools, ...capabilities }]) => [domain, capabilities])) : {}, quota: (({ usedToday, remainingToday, usedLastMinute, retryAfter }) => ({ usedToday, remainingToday, usedLastMinute, retryAfter }))(quotaState(credential)), paymentMode: "supplier_checkout" };
}
