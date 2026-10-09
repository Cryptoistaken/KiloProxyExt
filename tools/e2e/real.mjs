// Easy real-proxy test: loads the unpacked extension, adds gw.proxyrise,
// connects through the popup UI, and compares exit IP direct vs proxied.
// Run: PROXY_PASS='...' node tools/e2e/real.mjs   (optional PROXY_HOST/PORT/USER/SCHEME)
// Never logs the password.
import { launch } from "./harness.mjs";

const HOST = process.env.PROXY_HOST || "gw.proxyrise.com";
const PORT = Number(process.env.PROXY_PORT || 443);
const USER = process.env.PROXY_USER || "res-bd";
const PASS = process.env.PROXY_PASS || "";
const SCHEME = (process.env.PROXY_SCHEME || "http").toLowerCase();
if (!PASS) { console.error("FAIL  missing PROXY_PASS env"); process.exit(1); }
if (!["http", "https"].includes(SCHEME)) { console.error("FAIL  PROXY_SCHEME must be http|https"); process.exit(1); }

let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  → " + extra : ""}`); if (!ok) failed++; };
const mask = (s) => s.slice(0, 60).replace(PASS, "***");

const { context, sw, extId } = await launch();
const POPUP = `chrome-extension://${extId}/src/popup/index.html`;
const ui = await context.newPage();
await ui.goto(POPUP);
const state = () => ui.evaluate(() => document.body.dataset.state);
const text = (sel) => ui.locator(sel).first().evaluate((e) => e.textContent.trim());
const store = () => sw.evaluate(() => chrome.storage.local.get(null));
const waitState = (s, t = 15000) => ui.waitForFunction((s) => document.body.dataset.state === s, s, { timeout: t });
const fetchText = async (url, timeout = 25000) => {
  const p = await context.newPage();
  await p.goto(url, { timeout }).catch(() => null);
  const t = (await p.textContent("body").catch(() => "")).trim();
  await p.close();
  return t;
};

// direct baseline first (no proxy yet)
const directIp = await fetchText("https://api.ipify.org");
check("direct ipify reachable", /^\d+\.\d+\.\d+\.\d+/.test(directIp), mask(directIp));

// add profile through the real UI paste box
await ui.click("#add");
await ui.fill("[name=paste]", `${HOST}:${PORT}:${USER}:${PASS}`);
const gotHost = await ui.inputValue("[name=host]");
const gotPort = await ui.inputValue("[name=port]");
check("paste fills host/port/user", gotHost === HOST && gotPort === String(PORT), `${gotHost}:${gotPort}`);
await ui.fill("[name=name]", "Real test");
await ui.click(`label[for=scheme-${SCHEME}]`);
await ui.click("#save");
await ui.waitForFunction(() => document.body.dataset.view === "home");
check("1 row saved", (await ui.locator(".row").count()) === 1);

// connect
await ui.locator(".row__main").first().click();
await waitState("live").catch(() => {});
check("connect → live", (await state()) === "live", await state());
const s1 = await store();
check("no fault after connect", s1.fault === null, String(s1.fault));
check("badge ON", (await sw.evaluate(() => chrome.action.getBadgeText({}))) === "ON");

// exit IP through proxy
const proxiedIp = await fetchText("https://api.ipify.org");
check("proxied ipify reachable", /^\d+\.\d+\.\d+\.\d+/.test(proxiedIp), mask(proxiedIp));
check("proxied IP differs from direct", proxiedIp !== directIp && /^\d+\.\d+\.\d+\.\d+/.test(proxiedIp), `direct=${directIp} proxy=${proxiedIp}`);
const infoRaw = await fetchText("https://ipinfo.io/json");
let country = "";
try { country = JSON.parse(infoRaw).country || ""; } catch {}
check("ipinfo country present", !!country, mask(infoRaw).slice(0, 120));
console.log(`INFO  direct=${directIp} proxy=${proxiedIp} country=${country}`);
await ui.screenshot({ path: new URL("./shots/real-live.png", import.meta.url).pathname }).catch(() => {});

// disconnect → direct again
await ui.click("#orb");
await ui.waitForFunction(() => document.body.dataset.state === "idle", null, { timeout: 8000 }).catch(() => {});
const backIp = await fetchText("https://api.ipify.org");
check("disconnect back to direct", backIp === directIp, `now=${backIp} direct=${directIp}`);

await context.close();
process.exit(failed ? 1 : 0);
