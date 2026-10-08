import { parseProxy } from "../lib/parse.js";
import { load, save, newId } from "../lib/store.js";

const $ = (id) => document.getElementById(id);
const f = Object.fromEntries(
  ["paste", "name", "host", "port", "user", "pass", "scheme"].map((k) => [k, $(k)])
);
let state = { profiles: [], activeId: null };
let editingId = null;

// ── Rendering ───────────────────────────────────────────────────────
function render() {
  const active = state.profiles.find((p) => p.id === state.activeId);
  $("led").classList.toggle("on", !!active);
  $("state").textContent = active
    ? `Connected via ${active.name || active.host}`
    : "Direct connection";
  $("direct").disabled = !active;
  $("empty").hidden = state.profiles.length > 0;

  const list = $("list");
  list.replaceChildren(...state.profiles.map(renderItem));
}

function renderItem(p) {
  const li = document.createElement("li");
  li.className = "item" + (p.id === state.activeId ? " active" : "");

  const main = document.createElement("button");
  main.className = "main";
  main.title = p.id === state.activeId ? "Connected" : "Connect";
  const name = Object.assign(document.createElement("span"), {
    className: "name", textContent: p.name || p.host,
  });
  const sub = Object.assign(document.createElement("span"), {
    className: "sub",
    textContent: `${p.host}:${p.port}${p.user ? " · " + p.user : ""}`,
  });
  main.append(name, sub);
  main.onclick = () => activate(p.id);

  const edit = iconButton("✎", "Edit", () => startEdit(p));
  const del = iconButton("✕", "Delete", () => remove(p));
  li.append(main, edit, del);
  return li;
}

function iconButton(text, title, onclick) {
  const b = Object.assign(document.createElement("button"), {
    className: "icon", textContent: text, title, type: "button",
  });
  b.onclick = onclick;
  return b;
}

const showError = (msg = "") => ($("error").textContent = msg);

// ── Actions ─────────────────────────────────────────────────────────
function send(msg) {
  return new Promise((resolve, reject) =>
    chrome.runtime.sendMessage(msg, (r) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (!r?.ok) reject(new Error(r?.error || "Request failed"));
      else resolve(r);
    })
  );
}

async function activate(id) {
  showError();
  try {
    await send({ type: "activate", id });
    state = await load();
    render();
  } catch (e) {
    showError(e.message);
  }
}

async function remove(p) {
  if (p.id === state.activeId) await activate(null);
  state.profiles = state.profiles.filter((x) => x.id !== p.id);
  await save({ profiles: state.profiles });
  if (editingId === p.id) resetForm();
  render();
}

function startEdit(p) {
  editingId = p.id;
  Object.assign(f.name, { value: p.name || "" });
  f.host.value = p.host; f.port.value = p.port;
  f.user.value = p.user || ""; f.pass.value = p.pass || "";
  f.scheme.value = p.scheme || "http";
  f.paste.value = "";
  $("formTitle").textContent = "Edit proxy";
  $("submit").textContent = "Update";
  $("cancel").hidden = false;
}

function resetForm() {
  editingId = null;
  $("form").reset();
  setHint("");
  $("formTitle").textContent = "Add proxy";
  $("submit").textContent = "Save";
  $("cancel").hidden = true;
}

function setHint(text, bad = false) {
  $("hint").textContent = text;
  $("hint").classList.toggle("bad", bad);
}

// ── Form ────────────────────────────────────────────────────────────
f.paste.addEventListener("input", () => {
  const v = f.paste.value.trim();
  if (!v) return setHint("");
  const p = parseProxy(v);
  if (!p) return setHint("Use host:port:user:pass or user:pass@host:port", true);
  f.host.value = p.host; f.port.value = p.port;
  f.user.value = p.user; f.pass.value = p.pass;
  setHint(`Parsed ${p.host}:${p.port}`);
});

$("cancel").onclick = resetForm;
$("direct").onclick = () => activate(null);

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  showError();
  const port = Number(f.port.value);
  const profile = {
    id: editingId || newId(),
    name: f.name.value.trim(),
    scheme: f.scheme.value,
    host: f.host.value.trim(),
    port,
    user: f.user.value,
    pass: f.pass.value,
  };
  if (!profile.host || !Number.isInteger(port) || port < 1 || port > 65535) {
    return showError("Enter a valid host and port.");
  }
  const i = state.profiles.findIndex((p) => p.id === profile.id);
  if (i >= 0) state.profiles[i] = profile; else state.profiles.push(profile);
  await save({ profiles: state.profiles });
  // Editing the connected profile re-applies it so changes take effect.
  if (profile.id === state.activeId) await activate(profile.id);
  resetForm();
  state = await load();
  render();
});

(async () => {
  state = await load();
  render();
})();
