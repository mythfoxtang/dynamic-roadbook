function parseOrigin(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.origin !== value) return null;
    return url;
  } catch { return null; }
}

export function isSameOriginRequest(request) {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return false;
  const rawOrigin = request.headers.get("origin");
  if (!rawOrigin) return true; // Existing non-browser API clients do not send Origin.
  const origin = parseOrigin(rawOrigin);
  if (!origin) return false;
  // Browsers set this forbidden-to-script header using the public URL, before proxies
  // rewrite the host/scheme. Do not infer the public host from X-Forwarded-Host.
  if (site === "same-origin") return true;
  const internal = new URL(request.url);
  if (origin.origin === internal.origin) return true;
  const host = request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = ["http", "https"].includes(forwardedProtocol) ? `${forwardedProtocol}:` : internal.protocol;
  const publicOrigin = host && parseOrigin(`${protocol}//${host}`);
  return Boolean(publicOrigin && publicOrigin.origin === origin.origin);
}

export function requestUsesHttps(request) {
  // Call only after the request has passed isSameOriginRequest.
  const origin = parseOrigin(request.headers.get("origin"));
  return origin ? origin.protocol === "https:" : new URL(request.url).protocol === "https:";
}
