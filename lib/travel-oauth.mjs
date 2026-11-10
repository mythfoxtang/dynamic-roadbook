import { randomBytes, createHash } from "node:crypto";
import { TravelError } from "./travel-core.mjs";
const pending = globalThis.__travelOauthPending || (globalThis.__travelOauthPending = new Map());
const AUTH = "https://openapi.tuniu.cn";
const SCOPE = "openid profile user:basic capability:invoke";
export async function startTravelOAuth(origin, fetchImpl = fetch) {
  const redirectUri = `${origin}/api/travel/auth/callback/`;
  let registration;
  try {
    const response = await fetchImpl(`${AUTH}/oauth2/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "动态路书个人旅行规划", redirect_uris: [redirectUri], grant_types: ["authorization_code"], response_types: ["code"], token_endpoint_auth_method: "none", scope: SCOPE }), redirect: "error", signal: AbortSignal.timeout(15000) });
    registration = await response.json();
    if (!response.ok || !registration.client_id) throw new Error();
  } catch { throw new TravelError("官方动态授权注册暂不可用，可在途牛开放平台取得个人 API Key 后使用下方配置框", 502, "OAUTH_REGISTRATION_UNAVAILABLE"); }
  for (const [id, state] of pending) if (state.expiresAt < Date.now()) pending.delete(id);
  const state = randomBytes(32).toString("hex"), verifier = randomBytes(48).toString("base64url");
  pending.set(state, { verifier, clientId: registration.client_id, redirectUri, origin, expiresAt: Date.now() + 600000 });
  const url = new URL(`${AUTH}/oauth2/auth`);
  for (const [key, value] of Object.entries({ response_type: "code", client_id: registration.client_id, redirect_uri: redirectUri, scope: SCOPE, state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" })) url.searchParams.set(key, value);
  return { state, url: url.href };
}
export async function finishTravelOAuth(state, cookieState, code, fetchImpl = fetch) {
  const stored = pending.get(state);
  if (!state || state !== cookieState || !stored || stored.expiresAt < Date.now() || !code) throw new TravelError("登录状态无效或已过期，请重新发起途牛授权", 400, "OAUTH_STATE_INVALID");
  pending.delete(state);
  let response, data;
  try {
    response = await fetchImpl(`${AUTH}/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: stored.clientId, redirect_uri: stored.redirectUri, code, code_verifier: stored.verifier }), redirect: "error", signal: AbortSignal.timeout(15000) });
    data = await response.json();
  } catch { throw new TravelError("途牛授权交换失败，请重新连接", 502, "OAUTH_EXCHANGE_FAILED"); }
  if (!response.ok || !data.access_token) throw new TravelError("途牛未返回有效访问授权，请重新连接", 401, "OAUTH_TOKEN_INVALID");
  let providerUserId;
  try {
    const profile = await fetchImpl(`${AUTH}/userinfo`, { headers: { Authorization: `Bearer ${data.access_token}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    const identity = await profile.json(); if (profile.ok && identity.sub) providerUserId = String(identity.sub);
  } catch { /* Without a verified subject, isolate history by token instead of guessing identity. */ }
  return { origin: stored.origin, credential: { type: "oauth", secret: data.access_token, providerUserId, tokenExpiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 } };
}
