import { test } from "node:test";
import assert from "node:assert/strict";
import { sameOrigin } from "./ai-request.js";

function request(headers, url = "http://127.0.0.1:3010/api/ai/config/") {
  return new Request(url, { method: "POST", headers });
}
test("same-origin browser requests survive proxy scheme and internal hostname changes", () => {
  assert.doesNotThrow(() => sameOrigin(request({ origin: "https://travel.example", "sec-fetch-site": "same-origin", host: "127.0.0.1:3010" })));
});
test("preserved public Host works when request URL is internal", () => {
  assert.doesNotThrow(() => sameOrigin(request({ origin: "http://localhost:3010", host: "localhost:3010" })));
});
test("preserved HTTPS Host and forwarded protocol work behind TLS termination", () => {
  assert.doesNotThrow(() => sameOrigin(request({ origin: "https://travel.example", host: "travel.example", "x-forwarded-proto": "https" })));
});
test("original direct requests and server clients still work", () => {
  assert.doesNotThrow(() => sameOrigin(request({ origin: "http://127.0.0.1:3010" })));
  assert.doesNotThrow(() => sameOrigin(request({})));
});
test("cross-site requests are rejected even with spoofed forwarded headers", () => {
  for (const headers of [
    { origin: "https://evil.example", "sec-fetch-site": "cross-site", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" },
    { origin: "https://evil.example", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" },
    { origin: "http://127.0.0.1:3010", "sec-fetch-site": "cross-site" },
    { origin: "http://127.0.0.1:3010", "sec-fetch-site": "same-site" }
  ]) assert.throws(() => sameOrigin(request(headers)), (error) => error.status === 403);
});
test("opaque, malformed, non-HTTP and path-bearing origins are rejected", () => {
  for (const origin of ["null", "invalid", "file://", "https://travel.example/path", "https://user@travel.example", "https://travel.example,https://evil.example"]) {
    assert.throws(() => sameOrigin(request({ origin, "sec-fetch-site": "same-origin" })), (error) => error.status === 403);
  }
});
test("ports remain distinct and forwarded-host alone is not trusted", () => {
  assert.throws(() => sameOrigin(request({ origin: "http://localhost:3000", host: "localhost:3010" })), (error) => error.status === 403);
  assert.throws(() => sameOrigin(request({ origin: "http://evil.example", host: "localhost:3010", "x-forwarded-host": "evil.example" })), (error) => error.status === 403);
});
