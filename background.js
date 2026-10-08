// KiloProxyExt background (MANUAL ONLY): no server, buttons apply directly.
// Proxy auth MUST stay a SYNC onAuthRequired listener with ['blocking']
// — async/asyncBlocking never answers in MV3.
const creds = {};
const pending = {};

chrome.webRequest.onAuthRequired.addListener(
  (e) => {
    if (!e.isProxy) return;
    if (pending[e.requestId]) return { cancel: true };
    const c = creds[`${e.challenger.host}:${e.challenger.port}`];
    if (c) {
      pending[e.requestId] = 1;
      return { authCredentials: { username: c.username, password: c.password } };
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
chrome.webRequest.onCompleted.addListener(
  (e) => { delete pending[e.requestId]; }, { urls: ["<all_urls>"] });
chrome.webRequest.onErrorOccurred.addListener(
  (e) => { delete pending[e.requestId]; }, { urls: ["<all_urls>"] });

let lastConfig = { mode: "direct" };

async function updateBadge() {
  try {
    if (lastConfig.mode === "proxy") {
      await chrome.action.setBadgeText({ text: "ON" });
      await chrome.action.setBadgeBackgroundColor({ color: "#1a7f37" });
      await chrome.action.setTitle({
        title: `KiloProxyExt: CONNECTED via ${lastConfig.host || ""}:${lastConfig.port || ""}` });
    } else {
      await chrome.action.setBadgeText({ text: "OFF" });
      await chrome.action.setBadgeBackgroundColor({ color: "#666" });
      await chrome.action.setTitle({ title: "KiloProxyExt: DISCONNECTED (direct)" });
    }
  } catch (e) {}
}

async function applyConfig(c) {
  for (const k of Object.keys(creds)) delete creds[k];
  for (const k of Object.keys(pending)) delete pending[k];
  lastConfig = c;
  // Same super-proxy host:port + new login reuses the OLD login's live
  // sockets unless we drop them first — otherwise egress stays on the
  // previous user and never re-authenticates as the new one.
  try {
    await chrome.proxy.settings.set({ scope: "regular", value: { mode: "direct" } });
  } catch (e) {}
  await new Promise((r) => setTimeout(r, 300));
  if (c.mode === "proxy" && c.host && c.port) {
    creds[`${c.host}:${c.port}`] = { username: c.user || "", password: c.pass || "" };
    try { await chrome.storage.local.set({ lastProxy: c, savedConfig: c }); } catch (e) {}
    await chrome.proxy.settings.set({
      scope: "regular",
      value: {
        mode: "fixed_servers",
        rules: {
          singleProxy: { scheme: "http", host: c.host, port: c.port },
          bypassList: []
        }
      }
    });
  } else {
    try { await chrome.storage.local.set({ savedConfig: { mode: "direct" } }); } catch (e) {}
    await chrome.proxy.settings.set({ scope: "regular", value: { mode: "direct" } });
  }
  await updateBadge();
}

async function reconnectConfig() {
  try {
    const s = await chrome.storage.local.get("lastProxy");
    if (s.lastProxy && s.lastProxy.host) return { mode: "proxy", ...s.lastProxy };
  } catch (e) {}
  if (lastConfig.mode === "proxy" && lastConfig.host) return lastConfig;
  throw new Error("No saved proxy to connect with — paste host:port:user:pass first.");
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "getStatus") {
      let effective = null;
      try { effective = await chrome.proxy.settings.get({ incognito: false }); } catch (e) {}
      let lastProxy = null;
      try { lastProxy = (await chrome.storage.local.get("lastProxy")).lastProxy || null; } catch (e) {}
      sendResponse({ ok: true, config: lastConfig, effective, lastProxy });
    } else if (msg.type === "connect") {
      const cfg = msg.config && msg.config.host
        ? { mode: "proxy", ...msg.config }
        : await reconnectConfig();
      await applyConfig(cfg);
      sendResponse({ ok: true, config: lastConfig });
    } else if (msg.type === "disconnect") {
      await applyConfig({ mode: "direct" });
      sendResponse({ ok: true, config: lastConfig });
    } else {
      sendResponse({ ok: false, error: "unknown message" });
    }
  })();
  return true; // async response
});

// Restore last state on worker startup (worker restarts lose memory).
(async () => {
  try {
    const s = await chrome.storage.local.get("savedConfig");
    if (s.savedConfig) lastConfig = s.savedConfig;
  } catch (e) {}
  await applyConfig(lastConfig);
})();
