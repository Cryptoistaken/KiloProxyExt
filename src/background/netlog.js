import { appendLog, hostOf } from "../shared/netlog.js";

/**
 * In-memory log of requests seen while a proxy is engaged.
 * Memory only (cleared on worker restart); capped, hostnames only.
 */
let active = false;
let entries = [];

/** @param {boolean} on  Whether traffic is currently routed through a proxy. */
export const setActive = (on) => {
  active = !!on;
};

/**
 * Observe finished requests. Call synchronously at worker start.
 * Observation only: never blocks or modifies traffic.
 */
export function listen() {
  const push = (details, status) => {
    if (!active) return;
    const host = hostOf(details.url);
    if (!host) return;
    entries = appendLog(entries, {
      t: Date.now(),
      method: details.method || "",
      host,
      status,
    });
  };
  const filter = { urls: ["<all_urls>"] };
  chrome.webRequest.onCompleted.addListener((details) => push(details, details.statusCode), filter);
  chrome.webRequest.onErrorOccurred.addListener((details) => push(details, "error"), filter);
}

/** Copy of the entries, oldest first. */
export const recent = () => [...entries];

/** Drop all entries. */
export const clear = () => {
  entries = [];
};
