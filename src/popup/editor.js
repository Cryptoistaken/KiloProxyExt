import { Message, request } from "../shared/messages.js";
import { parseProxy } from "../shared/parse.js";
import { addressOf, countryOf, parsePort, switchCountry } from "../shared/profile.js";
import { save } from "../shared/store.js";
import { $, icon } from "./dom.js";

const form = $("#editor");
const fields = form.elements;
const hint = $("#hint");
const reveal = $("#reveal");

/** @type {import("../shared/store.js").Draft} */
const BLANK = Object.freeze({
  editing: null, paste: "", name: "", scheme: "http", host: "", port: "", user: "", pass: "", country: "",
});

/** The profile being edited, or null when adding a new one. */
let editing = null;

/** Form contents for editing an existing profile. */
export const fromProfile = (p) => ({
  editing: p.id, paste: "", name: p.name, scheme: p.scheme,
  host: p.host, port: String(p.port), user: p.user, pass: p.pass,
  country: countryOf(p.user) ?? "",
});

export function init(app) {
  // Mirror every keystroke so closing the popup never loses what was typed.
  form.addEventListener("input", () => save({ draft: read() }));
  fields.paste.addEventListener("input", () => onPaste());
  fields.country.addEventListener("input", () => onCountry());

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    app.run(() => submit(app));
  });
  $("#back").addEventListener("click", () => close(app));
  $("#cancel").addEventListener("click", () => close(app));
  form.addEventListener("keydown", (event) => event.key === "Escape" && close(app));
  reveal.addEventListener("click", () => setRevealed(fields.pass.type === "password"));
}

/** Show the editor, pre-filled with `draft` (blank by default). */
export function open(app, draft = BLANK) {
  draft = { ...draft, country: countryOf(draft.user) ?? draft.country ?? "" };
  editing = draft.editing;
  write(draft);
  showHint(draft.paste);
  setRevealed(false);
  $("#editor-title").textContent = editing ? "Edit proxy" : "New proxy";
  $("#save").textContent = editing ? "Save changes" : "Save proxy";
  app.go("editor");
  (editing ? fields.name : fields.paste).focus();
}

function close(app) {
  save({ draft: null });
  app.go("home");
}

// ── Form ↔ draft ────────────────────────────────────────────────────
function read() {
  return {
    editing,
    paste: fields.paste.value,
    name: fields.name.value,
    scheme: fields.scheme.value,
    host: fields.host.value,
    port: fields.port.value,
    user: fields.user.value,
    pass: fields.pass.value,
    country: fields.country.value,
  };
}

function write(draft) {
  for (const [key, value] of Object.entries(draft)) {
    if (key !== "editing") fields[key].value = value;
  }
}

function onPaste() {
  const parsed = parseProxy(fields.paste.value);
  if (parsed) {
    write({ ...parsed, port: String(parsed.port) });
    fields.country.value = countryOf(parsed.user) ?? "";
  }
  showHint(fields.paste.value);
}

function onCountry() {
  const cc = fields.country.value.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return;
  const next = switchCountry(fields.user.value, cc);
  if (next !== null && next !== fields.user.value) fields.user.value = next;
}

function showHint(text) {
  hint.replaceChildren();
  hint.toggleAttribute("data-bad", false);
  if (!text.trim()) return;

  const parsed = parseProxy(text);
  if (parsed) {
    hint.append(icon("i-check"), `Detected ${addressOf(parsed)}${parsed.user ? ` · ${parsed.user}` : ""}`);
  } else {
    hint.toggleAttribute("data-bad", true);
    hint.append(icon("i-alert"), "Unrecognised. Try host:port:user:pass");
  }
}

function setRevealed(visible) {
  fields.pass.type = visible ? "text" : "password";
  const label = visible ? "Hide password" : "Show password";
  reveal.setAttribute("aria-label", label);
  reveal.title = label;
  $("use", reveal).setAttribute("href", visible ? "#i-eye-off" : "#i-eye");
}

// ── Saving ──────────────────────────────────────────────────────────
function toProfile() {
  const host = fields.host.value.trim();
  const port = parsePort(fields.port.value.trim());
  if (!host) throw new Error("Enter a host.");
  if (!port) throw new Error("Port must be a number from 1 to 65535.");
  return {
    id: editing ?? crypto.randomUUID(),
    name: fields.name.value.trim(),
    scheme: fields.scheme.value,
    host,
    port,
    user: fields.user.value,
    pass: fields.pass.value,
  };
}

async function submit(app) {
  const profile = toProfile();
  const { profiles, activeId } = app.state;
  const exists = profiles.some((p) => p.id === profile.id);
  await save({
    profiles: exists ? profiles.map((p) => (p.id === profile.id ? profile : p)) : [...profiles, profile],
    draft: null,
  });
  // Re-apply so edits to the live proxy take effect straight away.
  if (profile.id === activeId) await request(Message.CONNECT, { id: profile.id });
  app.go("home");
}
