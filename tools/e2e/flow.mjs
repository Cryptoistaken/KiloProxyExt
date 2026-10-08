// Drives the real popup against a live 407-auth proxy: connect, auth, fault, draft, delete, browser restart.
// Run: node tools/e2e/flow.mjs   (screenshots land in tools/e2e/shots/)
import { startProxy, launch, EXT } from "./harness.mjs";

let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  → " + extra : ""}`); if (!ok) failed++; };

const good = await startProxy({ port: 18080 });
const other = await startProxy({ port: 18081 });
let { context, sw, extId, dir } = await launch();
const errors = [];
const watchPage = (p) => { p.on("pageerror", (e) => errors.push("pageerror: " + e.message)); p.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text())); };

const POPUP = `chrome-extension://${extId}/src/popup/index.html`;
const ui = await context.newPage(); watchPage(ui);
await ui.goto(POPUP);
const state = () => ui.evaluate(() => document.body.dataset.state);
const view = () => ui.evaluate(() => document.body.dataset.view);
const text = (sel) => ui.locator(sel).first().evaluate((e) => e.textContent.trim());
const shot = (name) => ui.locator("body").screenshot({ path: new URL(`./shots/${name}.png`, import.meta.url).pathname });
const store = () => sw.evaluate(() => chrome.storage.local.get(null));
const proxyMode = () => sw.evaluate(() => chrome.proxy.settings.get({}));
const waitState = (s) => ui.waitForFunction((s) => document.body.dataset.state === s, s, { timeout: 8000 });
const fetchVia = async (url) => { const p = await context.newPage(); const r = await p.goto(url, { timeout: 8000 }).catch((e) => null); const t = (await p.textContent("body").catch(() => "")).trim().slice(0, 80); await p.close(); return t; };

// ── Add three proxies through the real UI ───────────────────────────
await ui.click("#add");
check("add opens editor", (await view()) === "editor");
await shot("02-editor-blank");

await ui.fill("[name=paste]", "127.0.0.1:18080:demo:s3cret");
check("paste fills host/port/user/pass",
  (await ui.inputValue("[name=host]")) === "127.0.0.1" && (await ui.inputValue("[name=port]")) === "18080" &&
  (await ui.inputValue("[name=user]")) === "demo" && (await ui.inputValue("[name=pass]")) === "s3cret");
check("paste shows detected hint", (await text("#hint")).includes("Detected 127.0.0.1:18080"), await text("#hint"));
await ui.fill("[name=name]", "Local gateway");
await shot("03-editor-pasted");
await ui.click("#save");
await ui.waitForFunction(() => document.body.dataset.view === "home");
check("save returns home with 1 row", (await ui.locator(".row").count()) === 1);

// Wrong password, fresh proxy origin → exercises the fault path later.
await ui.click("#add");
await ui.fill("[name=paste]", "user:WRONG@127.0.0.1:18081");
await ui.fill("[name=name]", "Bad login");
await ui.click("#save");
await ui.waitForFunction(() => document.body.dataset.view === "home");

await ui.click("#add"); await ui.fill("[name=paste]", "gw.proxyrise.com:443:res-cm:hunter2"); await ui.fill("[name=name]", "US Residential");
await ui.click("label[for=scheme-https]"); await ui.click("#save");
await ui.waitForFunction(() => document.body.dataset.view === "home");
check("3 rows saved", (await ui.locator(".row").count()) === 3);
check("scheme chip reflects HTTPS", (await ui.locator(".row .chip").nth(2).innerText()).toLowerCase() === "https");

// ── Connect through the proxy ───────────────────────────────────────
await ui.locator(".row__main").first().click();
await waitState("live");
const s1 = await store(); const pm = await proxyMode();
check("connect → live state", (await state()) === "live");
check("storage: activeId + since set", !!s1.activeId && typeof s1.since === "number" && s1.fault === null);
check("chrome proxy is fixed_servers 127.0.0.1:18080", pm.value.mode === "fixed_servers" && pm.value.rules.singleProxy.port === 18080 && pm.levelOfControl === "controlled_by_this_extension");
check("no error notice after connect", (await ui.locator("#notice").isHidden()), await text("#notice"));
check("hero says CONNECTED", (await text("#status")).toLowerCase() === "connected");
check("readout endpoint", (await text("#r-endpoint")) === "127.0.0.1:18080", await text("#r-endpoint"));
check("readout identity", (await text("#r-identity")) === "demo");
const u1 = await text("#r-uptime"); await ui.waitForTimeout(2100); const u2 = await text("#r-uptime");
check("uptime ticks", /^\d\d:\d\d:\d\d$/.test(u1) && u1 !== u2, `${u1} → ${u2}`);
check("active row highlighted", (await ui.locator(".row[data-active]").count()) === 1);
const badge = await sw.evaluate(() => chrome.action.getBadgeText({}));
check("toolbar badge ON", badge === "ON", badge);
const body = await fetchVia("http://hello.example.test/x");
check("traffic flows through authenticated proxy", body.startsWith("proxied http://hello.example.test/x as demo"), body);
await shot("04-live");

// ── Fault: proxy refuses the login ──────────────────────────────────
await ui.locator(".row__main").nth(1).click();
await waitState("live");
await fetchVia("http://rejected.example.test/");
await waitState("fault");
const s2 = await store();
check("fault state shown after refused login", (await state()) === "fault" && s2.fault?.includes("refused"), s2.fault);
check("badge shows ! on fault", (await sw.evaluate(() => chrome.action.getBadgeText({}))) === "!");
await shot("05-fault");

// ── Disconnect via power button ─────────────────────────────────────
await ui.click("#orb");
await waitState("idle");
const s3 = await store();
check("power button disconnects", s3.activeId === null && s3.since === null && s3.fault === null);
check("chrome proxy back to direct", (await proxyMode()).value.mode === "direct");
check("badge cleared", (await sw.evaluate(() => chrome.action.getBadgeText({}))) === "");
check("idle hint names last-used proxy", (await text("#detail")).includes("Bad login"), await text("#detail"));
await shot("06-idle-with-list");

// ── Power button reconnects last used ───────────────────────────────
await ui.click("#orb"); await waitState("fault").catch(() => {});
check("power button reconnects last-used", (await store()).activeId === s1.profiles[1].id);
await ui.click("#orb"); await waitState("idle");

// ── Edit + draft persistence ────────────────────────────────────────
await ui.locator("[data-action=edit]").nth(1).click();
check("edit opens prefilled editor", (await view()) === "editor" && (await ui.inputValue("[name=name]")) === "Bad login" && (await text("#editor-title")) === "Edit proxy");
await ui.fill("[name=pass]", "s3cret");
await ui.fill("[name=user]", "demo");
await ui.waitForTimeout(150);
await ui.reload();   // simulates Chrome closing/reopening the popup mid-edit
await ui.waitForFunction(() => document.body.dataset.view === "editor");
check("draft survives popup close", (await ui.inputValue("[name=pass]")) === "s3cret" && (await ui.inputValue("[name=name]")) === "Bad login" && (await text("#editor-title")) === "Edit proxy");
await ui.click("#save");
await ui.waitForFunction(() => document.body.dataset.view === "home");
const edited = (await store()).profiles[1];
check("edit saved in place (same id, new creds)", edited.id === s1.profiles[1].id && edited.user === "demo" && edited.pass === "s3cret");
check("draft cleared after save", (await store()).draft === undefined || (await store()).draft === null);

// ── Delete needs two clicks ─────────────────────────────────────────
const del = ui.locator("[data-action=delete]").nth(2);
await del.click();
check("first click arms delete", (await ui.locator(".row").count()) === 3 && (await del.getAttribute("data-armed")) !== null);
await del.click();
await ui.waitForFunction(() => document.querySelectorAll(".row").length === 2);
check("second click deletes", (await store()).profiles.length === 2);

// ── Height budget (Chrome popups cap at 600px) ──────────────────────
for (let i = 0; i < 4; i++) { await ui.click("#add"); await ui.fill("[name=paste]", `p${i}.example.net:80${i}:u:p`); await ui.fill("[name=name]", `Extra ${i}`); await ui.click("#save"); await ui.waitForFunction(() => document.body.dataset.view === "home"); }
const hHome = await ui.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
await ui.click("#add"); const hEdit = await ui.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
check("home ≤ 600px with 6 proxies", hHome <= 600, `${hHome}px`);
check("editor ≤ 600px", hEdit <= 600, `${hEdit}px`);
await ui.keyboard.press("Escape");
check("Escape leaves editor", (await view()) === "home");

// ── Browser restart: Chrome drops the setting → background must restore it ──
await ui.locator(".row__main").first().click(); await waitState("live");
const activeBefore = (await store()).activeId;
await context.close();
({ context, sw, extId } = await (async () => {
  const { chromium, CHROME } = await import("./harness.mjs");
  const c = await chromium.launchPersistentContext(dir, { executablePath: CHROME, headless: true, viewport: { width: 360, height: 700 }, deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const w = c.serviceWorkers()[0] ?? (await c.waitForEvent("serviceworker", { timeout: 15000 }));
  return { context: c, sw: w, extId: new URL(w.url()).host };
})());
await new Promise((r) => setTimeout(r, 1200));
const after = await sw.evaluate(() => chrome.proxy.settings.get({}));
check("restart: proxy setting re-asserted", after.value.mode === "fixed_servers" && after.value.rules.singleProxy.port === 18080 && after.levelOfControl === "controlled_by_this_extension", JSON.stringify(after.value.mode));
check("restart: active profile preserved", (await sw.evaluate(() => chrome.storage.local.get("activeId"))).activeId === activeBefore);
check("restart: badge restored", (await sw.evaluate(() => chrome.action.getBadgeText({}))) === "ON");
const body2 = await fetchVia("http://after-restart.example.test/");
check("restart: authenticated traffic flows again", body2.startsWith("proxied http://after-restart.example.test/ as demo"), body2);

console.log("\nconsole/page errors:", errors.length ? errors : "none");
console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
await context.close(); good.server.close(); other.server.close();
process.exit(failed ? 1 : 0);
