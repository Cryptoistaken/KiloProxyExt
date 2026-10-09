import { activeProfile, load, save } from "../shared/store.js";
import { Message } from "../shared/messages.js";
import * as auth from "./auth.js";
import * as netlog from "./netlog.js";
import * as proxy from "./proxy.js";
import * as toolbar from "./toolbar.js";
import { isBypassed, verifyExit } from "./verify.js";

const REJECTED = "The proxy refused the username or password.";
const OVERRIDDEN = "Another extension is controlling your proxy settings.";
const LOST = "The proxy setting was changed outside KiloProxy.";
const BYPASSED = "Exit IP matches direct: traffic is bypassing the proxy.";

/** Faults this worker owns (safe to set and clear itself). */
const OWN_FAULTS = new Set([OVERRIDDEN, LOST, BYPASSED]);

/** Re-verify a connection verified longer ago than this. */
const REVERIFY_MS = 5 * 60 * 1000;

// ── Serialise everything that changes state ─────────────────────────
let tail = Promise.resolve();
function enqueue(task) {
  const run = tail.then(task);
  tail = run.catch(() => {});
  return run;
}

// ── State → toolbar ─────────────────────────────────────────────────
async function render() {
  const state = await load();
  await toolbar.render(activeProfile(state), state.fault);
}

async function commit(patch) {
  await save(patch);
  await render();
}

// ── Actions ─────────────────────────────────────────────────────────
async function connect(id) {
  const { profiles } = await load();
  const profile = profiles.find((p) => p.id === id);
  if (!profile) throw new Error("That proxy no longer exists.");

  // Measure the direct IP first: the same fetch after engaging must differ.
  const directIp = await verifyExit({ timeoutMs: 8000 });

  auth.arm(profile);
  netlog.clear();
  await proxy.engage(profile);
  const status = await proxy.inspect(profile);
  await commit({
    activeId: profile.id,
    lastId: profile.id,
    since: Date.now(),
    fault: status === "overridden" ? OVERRIDDEN : null,
    directIp,
    exitIp: null,
    verifiedAt: null,
  });
  netlog.setActive(true);
  enqueue(verifyCurrent);
}

/**
 * Confirm the live connection really routes through the proxy and record
 * the exit IP. Flags it when the exit matches the direct IP (bypass);
 * leaves faults from refused logins untouched.
 * @returns {Promise<string|null>} the exit IP, or null when unverified.
 */
async function verifyCurrent() {
  const state = await load();
  const profile = activeProfile(state);
  if (!profile) return null;
  const ip = await verifyExit();
  const fresh = await load();
  if (fresh.activeId !== profile.id) return null; // user moved on
  const patch = { exitIp: ip, verifiedAt: ip ? Date.now() : null };
  if (isBypassed(ip, fresh.directIp)) patch.fault = BYPASSED;
  await commit(patch);
  return ip;
}

async function disconnect() {
  auth.arm(null);
  netlog.setActive(false);
  await proxy.release();
  await commit({ activeId: null, since: null, fault: null, directIp: null, exitIp: null, verifiedAt: null });
}

/**
 * Make the browser match the saved state. Runs on every worker start:
 * memory is empty then, and after a browser restart Chrome may have
 * dropped our proxy setting. Never touches the setting unless it drifted.
 */
async function sync() {
  const state = await load();
  const profile = activeProfile(state);
  auth.arm(profile);
  netlog.setActive(!!profile);

  if (!profile) {
    if (state.activeId) await save({ activeId: null, since: null }); // profile vanished
    return render();
  }
  let status = await proxy.inspect(profile);
  if (status === "drifted") {
    await proxy.reassert(profile);
    status = await proxy.inspect(profile);
  }
  if (status === "overridden") await save({ fault: OVERRIDDEN });
  await render();
  if (!state.verifiedAt || Date.now() - state.verifiedAt > REVERIFY_MS) enqueue(verifyCurrent);
}

async function reportRejected() {
  const { activeId } = await load();
  if (activeId) await commit({ fault: REJECTED });
}

/**
 * Watchdog: when something else changes the proxy setting while we are
 * connected, self-heal (re-assert) or say so. Runs serialised after any
 * in-flight connect/disconnect, so our own intermediate states converge
 * instead of faulting.
 */
function watchProxy() {
  chrome.proxy.settings.onChange.addListener(() => enqueue(settleDrift));
}

async function settleDrift() {
  const state = await load();
  const profile = activeProfile(state);
  if (!profile) return;
  const status = await proxy.inspect(profile);
  if (status === "overridden") {
    if (state.fault !== OVERRIDDEN) await commit({ fault: OVERRIDDEN });
    return;
  }
  if (status === "drifted") {
    await proxy.reassert(profile);
    if ((await proxy.inspect(profile)) !== "ok") {
      await commit({ fault: LOST });
      return;
    }
  }
  if (OWN_FAULTS.has(state.fault)) await commit({ fault: null });
}

// ── Wiring (must happen synchronously at worker start) ──────────────
auth.listen({ onRejected: () => enqueue(reportRejected) });
netlog.listen();
watchProxy();

const handlers = {
  [Message.CONNECT]: ({ id }) => connect(id),
  [Message.DISCONNECT]: () => disconnect(),
  [Message.VERIFY]: () => verifyCurrent().then((ip) => ({ ip })),
  [Message.LOGS]: async () => ({ logs: netlog.recent() }),
  [Message.CLEAR_LOGS]: async () => {
    netlog.clear();
    return {};
  },
};

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  const handle = handlers[message?.type];
  if (!handle) return;
  enqueue(() => handle(message)).then(
    (result) => respond({ ok: true, ...(result ?? {}) }),
    (error) => respond({ ok: false, error: error.message })
  );
  return true; // reply asynchronously
});

chrome.runtime.onStartup.addListener(() => enqueue(sync));
enqueue(sync);
