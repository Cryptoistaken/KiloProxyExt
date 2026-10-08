import { activeProfile, load, save } from "../shared/store.js";
import { Message } from "../shared/messages.js";
import * as auth from "./auth.js";
import * as proxy from "./proxy.js";
import * as toolbar from "./toolbar.js";

const REJECTED = "The proxy refused the username or password.";
const OVERRIDDEN = "Another extension is controlling your proxy settings.";

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

  auth.arm(profile);
  await proxy.engage(profile);
  const status = await proxy.inspect(profile);
  await commit({
    activeId: profile.id,
    lastId: profile.id,
    since: Date.now(),
    fault: status === "overridden" ? OVERRIDDEN : null,
  });
}

async function disconnect() {
  auth.arm(null);
  await proxy.release();
  await commit({ activeId: null, since: null, fault: null });
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
}

async function reportRejected() {
  const { activeId } = await load();
  if (activeId) await commit({ fault: REJECTED });
}

// ── Wiring (must happen synchronously at worker start) ──────────────
auth.listen({ onRejected: () => enqueue(reportRejected) });

const handlers = {
  [Message.CONNECT]: ({ id }) => connect(id),
  [Message.DISCONNECT]: () => disconnect(),
};

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  const handle = handlers[message?.type];
  if (!handle) return;
  enqueue(() => handle(message)).then(
    () => respond({ ok: true }),
    (error) => respond({ ok: false, error: error.message })
  );
  return true; // reply asynchronously
});

chrome.runtime.onStartup.addListener(() => enqueue(sync));
enqueue(sync);
