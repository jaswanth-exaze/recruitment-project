/**
 * Runtime API base resolver used by every frontend page.
 *
 * Beginner Reading Guide:
 * 1) Read API base from window variables (highest priority).
 * 2) If not present, read from <meta name="api-base">.
 * 3) If page is opened via Live Server (5500+), auto-derive backend :5000.
 * 4) Fallback to same-origin, then localhost.
 * 5) Save resolved value into window.API_BASE / API_BASE_URL / PUBLIC_API_BASE.
 */
(function initRuntimeConfig(global) {
  const trimValue = (value) => String(value || "").trim();

  const fromWindow = trimValue(global.API_BASE || global.API_BASE_URL || global.PUBLIC_API_BASE);
  const metaApiBase = trimValue(
    document.querySelector('meta[name="api-base"]')?.getAttribute("content"),
  );
  const sameOrigin = trimValue(global.location?.origin);
  let derivedBase = "";

  if (!fromWindow && !metaApiBase && sameOrigin) {
    try {
      const parsed = new URL(sameOrigin);
      if (parsed.port === "5500" || parsed.port === "5501" || parsed.port === "5502") {
        derivedBase = `${parsed.protocol}//${parsed.hostname}:5000`;
      }
    } catch (error) {
      derivedBase = "";
    }
  }

  const apiBase = (fromWindow || metaApiBase || derivedBase || sameOrigin || "http://localhost:3000").replace(/\/+$/, "");

  global.API_BASE = apiBase;
  if (!global.API_BASE_URL) global.API_BASE_URL = apiBase;
  if (!global.PUBLIC_API_BASE) global.PUBLIC_API_BASE = apiBase;
})(window);
