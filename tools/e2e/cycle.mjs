// Cycle test: connect/disconnect N times against a real proxy, fetch exit IP each live round.
// Run: PROXY_PASS='...' node tools/e2e/cycle.mjs   (optional CYCLES=8, PROXY_HOST/PORT/USER/SCHEME)
import { launch } from "/app/KiloProxyExt/tools/e2e/harness.mjs";

const HOST = process.env.PROXY_HOST || "gw.proxyrise.com";
const PORT = Number(process.env.PROXY_PORT || 443);
const USER = process.env.PROXY_USER || "res-bd";
const PASS = process.env.PROXY_PASS || "";
const SCHEME = (process.env.PROXY_SCHEME || "http").toLowerCase();
const CYCLES = Number(process.env.CYCLES || 6);
if (!PASS) { console.error("FAIL  missing PROXY_PASS env"); process.exit(1); }

let failed = 0;
const check = (n, ok, x = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  → " + x : ""}`); if (!ok) failed++; };

const { context, sw, extId } = await launch();
const ui = await context.newPage();
await ui.goto(`chrome-extension://${extId}/src/popup/index.html`);
const state = () => ui.evaluate(() => document.body.dataset.state);
const store = () => sw.evaluate(() => chrome.storage.local.get(null));
const waitState = (s, t = 15000) => ui.waitForFunction((s) => document.body.dataset.state === s, s, { timeout: t });
const fetchText = async (url, timeout = 25000) => {
  const p = await context.newPage();
  await p.goto(url, { timeout }).catch(() => null);
  const t = (await p.textContent("body").catch(() => "")).trim();
  await p.close();
  return t;
};

const direct = await fetchText("https://api.ipify.org");
check("direct baseline", /^\d+\.\d+\.\d+\.\d+$/.test(direct), direct);

await ui.click("#add");
await ui.fill("[name=paste]", `${HOST}:${PORT}:${USER}:${PASS}`);
await ui.fill("[name=name]", "Cycle test");
await ui.click(`label[for=scheme-${SCHEME}]`);
await ui.click("#save");
await ui.waitForFunction(() => document.body.dataset.view === "home");

for (let i = 1; i <= CYCLES; i++) {
  await ui.locator(".row__main").first().click();
  const becameLive = await waitState("live").then(() => true).catch(() => false);
  const s = await store();
  const ip = becameLive ? await fetchText("https://api.ipify.org") : "";
  const ok = becameLive && s.fault === null && /^\d+\.\d+\.\d+\.\d+$/.test(ip) && ip !== direct;
  check(`cycle ${i} on → proxied`, ok, `state=${await state()} fault=${s.fault} ip=${ip}`);
  await ui.click("#orb");
  await ui.waitForFunction(() => document.body.dataset.state === "idle", null, { timeout: 8000 }).catch(() => {});
  const back = await fetchText("https://api.ipify.org");
  check(`cycle ${i} off → direct`, back === direct, back);
}

await context.close();
process.exit(failed ? 1 : 0);
