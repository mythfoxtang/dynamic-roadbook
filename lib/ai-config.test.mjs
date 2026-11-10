import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAiInput, saveAiSession, resolveAiConfig, publicAiConfig, deleteAiSession, checkDeepSeek, createAiFetch, SESSION_SECONDS } from "./ai-config.mjs";
const config = validateAiInput({ apiKey: "test-key-not-a-real-secret", model: "deepseek-flash" });

test("configuration fixes official URL and rejects invalid keys and models", () => {
  assert.equal(config.baseUrl, "https://api.deepseek.com");
  for (const body of [null, {}, { apiKey: "short" }, { apiKey: "test-key\nmalicious" }, { apiKey: config.apiKey, model: "../../evil" }]) assert.throws(() => validateAiInput(body));
});
test("session IDs are opaque, isolated, expire, and public status never contains a key", () => {
  const id = saveAiSession(config, null, 1000);
  assert.match(id, /^[a-f0-9]{64}$/);
  const current = resolveAiConfig(id, {}, 2000);
  assert.equal(current.apiKey, config.apiKey);
  assert.ok(!JSON.stringify(publicAiConfig(current)).includes(config.apiKey));
  assert.equal(resolveAiConfig("another-browser", {}, 2000), null);
  assert.equal(resolveAiConfig(id, {}, 1000 + SESSION_SECONDS * 1000), null);
});
test("session overrides env; clearing restores permanent env config", () => {
  const env = { DEEPSEEK_API_KEY: "permanent-test-key", DEEPSEEK_MODEL: "deepseek-v4-pro", DASHSCOPE_API_KEY: "legacy-key" };
  const id = saveAiSession(config);
  assert.equal(resolveAiConfig(id, env).source, "session");
  deleteAiSession(id);
  assert.equal(resolveAiConfig(id, env).apiKey, env.DEEPSEEK_API_KEY);
  assert.equal(resolveAiConfig(id, env).model, "deepseek-v4-pro");
  assert.equal(resolveAiConfig(null, {}), null);
});
test("replacing a session invalidates the old key and supports legacy env", () => {
  const id = saveAiSession(config);
  const next = saveAiSession(config, id);
  assert.equal(resolveAiConfig(id, {}), null);
  assert.equal(resolveAiConfig(next, {}).provider, "DeepSeek");
  deleteAiSession(next);
  assert.equal(resolveAiConfig(null, { DASHSCOPE_API_KEY: "legacy-key" }).provider, "DashScope");
});
test("connection test only requests official models with Bearer auth and no cache", async () => {
  const models = await checkDeepSeek(config, async (url, options) => {
    assert.equal(url, "https://api.deepseek.com/models");
    assert.equal(options.headers.Authorization, `Bearer ${config.apiKey}`);
    assert.equal(options.cache, "no-store"); assert.equal(options.redirect, "error");
    assert.equal(options.body, undefined);
    return { ok: true, json: async () => ({ data: [{ id: config.model }] }) };
  });
  assert.deepEqual(models, [config.model]);
});
test("connection errors redact upstream bodies and identify invalid keys and missing models", async () => {
  await assert.rejects(checkDeepSeek(config, async () => ({ ok: false, status: 401, json: () => assert.fail("do not expose upstream response") })), (error) => error.status === 401 && !error.message.includes(config.apiKey));
  await assert.rejects(checkDeepSeek(config, async () => ({ ok: true, json: async () => ({ data: [{ id: "another-model" }] }) })), (error) => error.status === 400);
});
test("both assistants can use official JSON chat transport with bounded request time", async () => {
  const transport = createAiFetch(config, async (url, options) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    const payload = JSON.parse(options.body);
    assert.deepEqual(payload.thinking, { type: "disabled" });
    assert.equal(payload.model, config.model); assert.ok(options.signal);
    return { ok: true };
  });
  await transport(`${config.baseUrl}/chat/completions`, { body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: "test" }] }) });
});
test("generation balance/network failures stay explicit", async () => {
  const failing = createAiFetch(config, async () => ({ ok: false, status: 402 }));
  await assert.rejects(failing("https://api.deepseek.com/chat/completions", { body: "{}" }), (error) => error.status === 402);
  const timeout = createAiFetch(config, async () => { throw new Error("network detail with private key"); });
  await assert.rejects(timeout("https://api.deepseek.com/chat/completions", { body: "{}" }), (error) => error.status === 502 && !error.message.includes("private key"));
});
