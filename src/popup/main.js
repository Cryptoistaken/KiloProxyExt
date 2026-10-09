import { DEFAULTS, load, watch } from "../shared/store.js";
import { $ } from "./dom.js";
import { describe } from "./status.js";
import * as editor from "./editor.js";
import * as home from "./home.js";
import * as logs from "./logs.js";

/**
 * State shared by the views. Only this module replaces `app.state`;
 * views read it and call `go`, `run` and `render`.
 */
const app = {
  state: structuredClone(DEFAULTS),
  view: "home", // "home" | "editor" | "logs"
  busy: false,
  error: "",
  go,
  run,
  render,
};

/** Switch view. */
function go(view) {
  app.view = view;
  app.error = "";
  render();
}

/** Run a user action: blocks re-entry, shows progress, surfaces errors. */
async function run(task) {
  if (app.busy) return;
  app.busy = true;
  app.error = "";
  render();
  try {
    await task();
  } catch (error) {
    app.error = error.message;
  } finally {
    app.state = await load();
    app.busy = false;
    render();
  }
}

function render() {
  const status = describe(app);
  document.body.dataset.state = status.key;
  document.body.dataset.view = app.view;
  $("#tag").textContent = status.tag;
  $("#notice").textContent = app.error;
  $("#notice").hidden = !app.error;
  home.render(app, status);
  if (app.view === "logs") logs.render(app);
}

async function boot() {
  app.state = await load();
  $("#version").textContent = `v${chrome.runtime.getManifest().version}`;
  home.init(app);
  editor.init(app);
  logs.init(app);

  // The background worker (and the editor's draft) write to storage; mirror it.
  watch((patch) => {
    app.state = { ...app.state, ...patch };
    if (Object.keys(patch).some((key) => key !== "draft")) render();
  });

  if (app.state.draft) editor.open(app, app.state.draft);
  else render();
}

boot();
