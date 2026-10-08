import { load, save } from "./lib/store.js";
import { authKey } from "./lib/parse.js";

// ── Proxy authentication ────────────────────────────────────────────
// Must be a synchronous, top-level, blocking listener: async variants
// never answer in MV3. Credentials therefore live in memory.
let creds = null; // { key, username, password }
const answered = new Set(); // requestIds already answered (stops retry loops)

chrome.webRequest.onAuthRequired.addListener(
  (e) => {
    if (!e.isProxy || !creds) return;
    if (creds.key !== authKey(e.challenger.host, e.challenger.port)) return;
    if (answered.has(e.requestId)) return { cancel: true };
    answered.add(e.requestId);
    return { authCredentials: { username: creds.username, password: creds.password } };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
const forget = (e) => answered.delete(e.requestId);
chrome.webRequest.onCompleted.addListener(forget, { urls: ["<all_urls>"] });
chrome.webRequest.onErrorOccurred.addListener(forget, { urls: ["<all_urls>"] });

// ── Applying a profile ──────────────────────────────────────────────
const setProxy = (value) => chrome.proxy.settings.set({ scope: "regular", value });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apply(profile) {
  creds = null;
  answered.clear();
  // Drop to direct first so live sockets authenticated as the previous
  // login aren't reused when switching users on the same host.
  await setProxy({ mode: "direct" });
  if (profile) {
    await sleep(250);
    creds = {
      key: authKey(profile.host, profile.port),
      username: profile.user || "",
      password: profile.pass || "",
    };
    await setProxy({
      mode: "fixed_servers",
      rules: {
        singleProxy: { scheme: profile.scheme || "http", host: profile.host, port: profile.port },
        bypassList: ["<local>"],
      },
    });
  }
  await renderBadge(profile);
}

async function renderBadge(profile) {
  await chrome.action.setBadgeText({ text: profile ? "ON" : "" });
  if (profile) await chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
  await chrome.action.setTitle({
    title: profile ? `KiloProxy: ${profile.name || profile.host}` : "KiloProxy: direct",
  });
}

async function activate(id) {
  const { profiles } = await load();
  const profile = id ? profiles.find((p) => p.id === id) : null;
  if (id && !profile) throw new Error("Profile not found");
  await apply(profile);
  await save({ activeId: profile ? profile.id : null });
}

// ── Messaging ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type !== "activate") return;
  activate(msg.id ?? null).then(
    () => reply({ ok: true }),
    (err) => reply({ ok: false, error: String(err.message || err) })
  );
  return true;
});

// Restore after browser start / worker restart (memory is lost, Chrome's
// proxy setting is not, so only re-arm credentials + badge).
async function restore() {
  const { profiles, activeId } = await load();
  const p = profiles.find((x) => x.id === activeId);
  if (p) {
    creds = { key: authKey(p.host, p.port), username: p.user || "", password: p.pass || "" };
  }
  await renderBadge(p);
}
restore();
chrome.runtime.onStartup.addListener(restore);
