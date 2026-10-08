// E2E helpers: an auth-requiring HTTP proxy + Chromium with the unpacked extension loaded.
// Needs playwright-core and a Chromium build. Override locations with:
//   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core   CHROME_PATH=/path/to/chrome
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_CORE || "/root/.local/share/mise/installs/node/24.21.0/lib/node_modules/@playwright/mcp/node_modules/playwright-core";
export const EXT = path.resolve(new URL("../..", import.meta.url).pathname);
export const { chromium } = require(PW);

export const CHROME = process.env.CHROME_PATH || path.join(os.homedir(), ".cache/ms-playwright/chromium-1228/chrome-linux64/chrome");

/** Proxy that answers 407 unless Basic creds match. Records every request. */
export function startProxy({ port = 18080, user = "demo", pass = "s3cret", realm = "kilo" } = {}) {
  const log = [];
  const server = http.createServer((req, res) => {
    const h = req.headers["proxy-authorization"] || "";
    const [u, ...p] = Buffer.from(h.replace(/^Basic\s+/i, ""), "base64").toString().split(":");
    const ok = h && u === user && p.join(":") === pass;
    log.push({ url: req.url, auth: h ? (ok ? "ok" : "bad") : "none" });
    if (!ok) {
      res.writeHead(407, { "Proxy-Authenticate": `Basic realm="${realm}"`, "Content-Length": 0 });
      return res.end();
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(`proxied ${req.url} as ${u}`);
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r({ server, log, port })));
}

export async function launch(extPath = EXT, { headless = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kilo-prof-"));
  const context = await chromium.launchPersistentContext(dir, {
    executablePath: CHROME,
    headless,
    viewport: { width: 360, height: 700 },
    deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
  });
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 15000 });
  const extId = new URL(sw.url()).host;
  return { context, sw, extId, dir };
}
