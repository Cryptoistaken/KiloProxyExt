import { Message, request } from "../shared/messages.js";
import { activeProfile, save } from "../shared/store.js";
import { addressOf, labelOf } from "../shared/profile.js";
import { $ } from "./dom.js";
import * as editor from "./editor.js";
import { formatDuration, pickTarget } from "./status.js";

const el = {
  orb: $("#orb"),
  status: $("#status"),
  detail: $("#detail"),
  endpoint: $("#r-endpoint"),
  identity: $("#r-identity"),
  uptime: $("#r-uptime"),
  count: $("#count"),
  add: $("#add"),
  list: $("#list"),
  empty: $("#empty"),
  template: $("#row-template"),
};

export function init(app) {
  el.orb.addEventListener("click", () => togglePower(app));
  el.add.addEventListener("click", () => editor.open(app));
  el.list.addEventListener("click", (event) => onRowClick(app, event));
  setInterval(() => renderUptime(app), 1000);
}

export function render(app, status) {
  const { state } = app;
  const active = activeProfile(state);
  const target = active ?? pickTarget(state);

  el.status.textContent = status.label;
  el.detail.textContent = status.detail;
  el.orb.setAttribute(
    "aria-label",
    active ? "Disconnect" : target ? `Connect to ${labelOf(target)}` : "Add a proxy"
  );

  setValue(el.endpoint, active && addressOf(active));
  setValue(el.identity, active && (active.user || "none"));
  renderUptime(app);

  el.count.textContent = state.profiles.length;
  el.empty.hidden = state.profiles.length > 0;
  el.list.replaceChildren(...state.profiles.map((p) => row(p, p.id === state.activeId)));
}

// ── Readout ─────────────────────────────────────────────────────────
function setValue(element, text) {
  element.textContent = text || "—";
  element.toggleAttribute("data-empty", !text);
}

function renderUptime({ state }) {
  const live = activeProfile(state) && state.since;
  setValue(el.uptime, live && formatDuration(Date.now() - state.since));
}

// ── Power button ────────────────────────────────────────────────────
function togglePower(app) {
  if (activeProfile(app.state)) return app.run(() => request(Message.DISCONNECT));
  const target = pickTarget(app.state);
  if (!target) return editor.open(app);
  return connect(app, target);
}

const connect = (app, profile) => app.run(() => request(Message.CONNECT, { id: profile.id }));

// ── Rows ────────────────────────────────────────────────────────────
function row(profile, active) {
  const item = el.template.content.firstElementChild.cloneNode(true);
  item.dataset.id = profile.id;
  item.toggleAttribute("data-active", active);
  $(".row__name", item).textContent = labelOf(profile);
  $(".row__addr", item).textContent =
    addressOf(profile) + (profile.user ? ` · ${profile.user}` : "");
  $(".chip", item).textContent = profile.scheme;
  return item;
}

function onRowClick(app, event) {
  const item = event.target.closest(".row");
  const profile = app.state.profiles.find((p) => p.id === item?.dataset.id);
  if (!profile) return;

  const button = event.target.closest("[data-action]");
  switch (button?.dataset.action) {
    case "edit":
      return editor.open(app, editor.fromProfile(profile));
    case "delete":
      return confirmDelete(app, button, profile);
    default: {
      const connected = profile.id === app.state.activeId && !app.state.fault;
      return connected ? undefined : connect(app, profile);
    }
  }
}

// Deleting takes two clicks: the first arms the button for a few seconds.
let armed = null; // { button, timer }

function disarm() {
  if (!armed) return;
  clearTimeout(armed.timer);
  armed.button.removeAttribute("data-armed");
  armed = null;
}

function confirmDelete(app, button, profile) {
  if (armed?.button === button) {
    disarm();
    return app.run(() => remove(app.state, profile));
  }
  disarm();
  button.dataset.armed = "";
  armed = { button, timer: setTimeout(disarm, 3000) };
}

async function remove({ profiles, activeId, lastId }, profile) {
  if (profile.id === activeId) await request(Message.DISCONNECT);
  await save({
    profiles: profiles.filter((p) => p.id !== profile.id),
    lastId: lastId === profile.id ? null : lastId,
  });
}
