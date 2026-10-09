import { Message, request } from "../shared/messages.js";
import { $ } from "./dom.js";

/** Entries fetched from the background worker on entry. Memory only. */
let entries = [];

const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour12: false });

export function init(app) {
  $("#logs-btn").addEventListener("click", () =>
    app.run(async () => {
      await refresh();
      app.go("logs");
    })
  );
  $("#logs-back").addEventListener("click", () => app.go("home"));
  $("#reverify").addEventListener("click", () =>
    app.run(async () => {
      await request(Message.VERIFY);
      await refresh();
    })
  );
  $("#clear-logs").addEventListener("click", () =>
    app.run(async () => {
      await request(Message.CLEAR_LOGS);
      entries = [];
    })
  );
}

async function refresh() {
  const reply = await request(Message.LOGS);
  entries = reply.logs ?? [];
}

export function render(app) {
  const { state } = app;
  $("#l-exit").textContent = state.exitIp ?? (state.activeId ? "unverified" : "—");
  $("#l-direct").textContent = state.directIp ?? "—";
  $("#l-verified").textContent = state.verifiedAt ? fmtTime(state.verifiedAt) : "—";
  $("#log-list").replaceChildren(...entries.slice().reverse().map(row));
  $("#logs-empty").hidden = entries.length > 0;
}

function row(entry) {
  const li = document.createElement("li");
  li.className = "log-row";
  const time = document.createElement("span");
  time.className = "log-row__time";
  time.textContent = fmtTime(entry.t);
  const host = document.createElement("span");
  host.className = "log-row__host";
  host.textContent = entry.host;
  const status = document.createElement("span");
  status.className = "log-row__status";
  status.textContent = String(entry.status);
  li.append(time, host, status);
  return li;
}
