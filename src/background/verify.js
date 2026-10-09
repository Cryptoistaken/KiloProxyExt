/**
 * Exit-IP verification: fetch a plain-text-IP endpoint and confirm what
 * comes back. Called before engaging (measures the direct IP) and after
 * (measures the proxy exit). No chrome APIs; `fetch` runs in the worker.
 */
const SOURCES = ["https://api.ipify.org", "https://checkip.amazonaws.com"];

/** True for dotted-quad IPv4 text. */
export const isIp = (text) => /^\d{1,3}(\.\d{1,3}){3}$/.test(String(text ?? "").trim());

async function fetchIp(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return isIp(text) ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** True when a verified exit equals the direct IP: traffic is bypassing the proxy. */
export const isBypassed = (ip, directIp) => !!ip && !!directIp && ip === directIp;

/** First working exit IP, or null when nothing answered. */
export async function verifyExit({ timeoutMs = 10000 } = {}) {
  for (const url of SOURCES) {
    const ip = await fetchIp(url, timeoutMs);
    if (ip) return ip;
  }
  return null;
}
