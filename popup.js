const $ = (id) => document.getElementById(id);
const dot = $("dot"), status = $("status"), sub = $("sub"), err = $("err");
const quick = $("quick"), parsed = $("parsed");
const host = $("host"), port = $("port"), user = $("user"), pass = $("pass");
const conn = $("conn"), dis = $("dis");

// Accepts:
//   host:port:user:pass   (pass may itself contain ':')
//   host:port             (no auth)
//   user:pass@host:port   (+ optional http:// / socks5:// prefix)
function parseProxyString(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/\s+/g, "");
  if (!s) return null;
  s = s.replace(/^(https?|socks5h?|socks4a?|proxy):\/\//i, "");
  if (s.includes("@")) {
    const at = s.lastIndexOf("@");
    const left = s.slice(0, at), right = s.slice(at + 1);
    const ci = left.indexOf(":");
    if (ci <= 0) return null;
    const u = left.slice(0, ci), pw = left.slice(ci + 1);
    const hp = right.split(":");
    if (hp.length < 2) return null;
    const p = Number(hp.pop());
    const h = hp.join(":").replace(/^\[|\]$/g, "");
    if (!h || !u || !Number.isInteger(p) || p <= 0 || p > 65535) return null;
    return { host: h, port: p, user: u, pass: pw };
  }
  let m = s.match(/^\[([^\]]+)\]:(\d+):([^:]*):([\s\S]*)$/);
  if (m) {
    const p = Number(m[2]);
    if (!Number.isInteger(p) || p <= 0 || p > 65535 || !m[3]) return null;
    return { host: m[1], port: p, user: m[3], pass: m[4] };
  }
  const parts = s.split(":");
  if (parts.length < 2) return null;
  if (parts.length === 2) {
    const p = Number(parts[1]);
    if (!parts[0] || !Number.isInteger(p) || p <= 0 || p > 65535) return null;
    return { host: parts[0], port: p, user: "", pass: "" };
  }
  if (parts.length === 3) {
    const p = Number(parts[1]);
    if (!parts[0] || !Number.isInteger(p) || p <= 0 || p > 65535) return null;
    return { host: parts[0], port: p, user: parts[2], pass: "" };
  }
  const h = parts[0], p = Number(parts[1]), u = parts[2], pw = parts.slice(3).join(":");
  if (!h || !u || !Number.isInteger(p) || p <= 0 || p > 65535) return null;
  return { host: h, port: p, user: u, pass: pw };
}

function fillForm(c) {
  host.value = c.host || "";
  port.value = c.port || "";
  user.value = c.user || "";
  pass.value = c.pass || "";
}

// --- draft persistence: popup unloads on click-out, so keep inputs ---
let restoring = true;
async function saveDraft() {
  if (restoring) return;
  try {
    await chrome.storage.local.set({ popupDraft: {
      quick: quick.value, host: host.value, port: port.value,
      user: user.value, pass: pass.value
    }});
  } catch (e) {}
}
async function restoreDraft() {
  try {
    const d = (await chrome.storage.local.get("popupDraft")).popupDraft;
    if (d) {
      quick.value = d.quick || "";
      host.value = d.host || "";
      port.value = d.port || "";
      user.value = d.user || "";
      pass.value = d.pass || "";
      if (quick.value) showParsed();
    }
  } catch (e) {}
  restoring = false;
}
// quickFilled = paste box is the source of truth. Any hand-edit below
// flips to manual so Connect uses the edited fields, not the old paste.
let quickFilled = false;
quick.addEventListener("input", () => {
  const v = quick.value;
  if (!v.trim()) { parsed.textContent = ""; quickFilled = false; saveDraft(); return; }
  const c = parseProxyString(v);
  if (c) {
    fillForm(c);
    quickFilled = true;
    parsed.textContent = `Detected ${c.host}:${c.port} · user ${c.user || "(none)"} — editing any field below overrides this`;
    parsed.style.color = "#1a7f37";
  } else if (v.includes(":")) {
    quickFilled = false;
    parsed.textContent = "Unrecognized format — want host:port:user:pass";
    parsed.style.color = "#d33";
  } else {
    quickFilled = false;
    parsed.textContent = "";
  }
  saveDraft();
});
[host, port, user, pass].forEach((el) =>
  el.addEventListener("input", () => {
    // user took over manually — pasted string no longer wins
    if (quickFilled) {
      quickFilled = false;
      parsed.textContent = "Manual edit — Connect will use the fields below.";
      parsed.style.color = "#555";
    }
    saveDraft();
  }));

function showParsed() {
  const v = quick.value;
  if (!v.trim()) { parsed.textContent = ""; return; }
  const c = parseProxyString(v);
  if (c) {
    parsed.textContent = `Detected ${c.host}:${c.port} · user ${c.user || "(none)"}`;
    parsed.style.color = "#1a7f37";
    quickFilled = true;
  } else if (v.includes(":")) {
    parsed.textContent = "Unrecognized format — want host:port:user:pass";
    parsed.style.color = "#d33";
  } else {
    parsed.textContent = "";
  }
}

function send(msg) {
  return new Promise((res, rej) => {
    try {
      chrome.runtime.sendMessage(msg, (r) => {
        if (chrome.runtime.lastError) rej(new Error(chrome.runtime.lastError.message));
        else if (!r || !r.ok) rej(new Error((r && r.error) || "failed"));
        else res(r);
      });
    } catch (e) { rej(e); }
  });
}

// Last resort: apply proxy from the popup itself if the worker is asleep.
// Auth resumes once the worker wakes (it restores savedConfig on startup).
async function popupApply(body) {
  try {
    await chrome.storage.local.set({
      savedConfig: body,
      lastProxy: body.mode === "proxy" ? body : undefined
    });
  } catch (e) {}
  if (body.mode === "proxy") {
    await chrome.proxy.settings.set({ scope: "regular", value: { mode: "fixed_servers",
      rules: { singleProxy: { scheme: "http", host: body.host, port: body.port }, bypassList: [] } } });
  } else {
    await chrome.proxy.settings.set({ scope: "regular", value: { mode: "direct" } });
  }
}

let firstFill = true;
async function refresh() {
  let s = null;
  try {
    s = await send({ type: "getStatus" });
  } catch (e) {
    // worker asleep: read local truth directly
    try {
      const store = await chrome.storage.local.get(["savedConfig", "lastProxy"]);
      const local = store.savedConfig || { mode: "direct" };
      s = { ok: true, config: local, lastProxy: store.lastProxy || null, workerAsleep: true };
    } catch (e2) {
      dot.className = "dot err";
      status.textContent = "Extension error";
      err.textContent = String(e.message || e);
      return;
    }
  }
  try {
    err.textContent = "";
    const c = s.config || {};
    // Fill inputs ONCE only — never wipe what the user pasted/typed.
    if (firstFill && !quick.value && !host.value && !port.value && !user.value && !pass.value) {
      const src = c.mode === "proxy" ? c : (s.lastProxy || c);
      if (src.host) fillForm(src);
    }
    firstFill = false;

    if (c.mode === "proxy") {
      dot.className = "dot on";
      status.textContent = "Connected";
      sub.textContent = `${c.host || ""}:${c.port || ""} · user ${c.user || "(none)"}`;
    } else {
      dot.className = "dot off";
      status.textContent = "Disconnected";
      sub.textContent = "Direct connection (no proxy)";
    }
    // NOTE: Connect stays enabled on purpose so you can switch proxy
    // without disconnecting first. Never auto-disable buttons here.
  } catch (e) {
    dot.className = "dot err";
    status.textContent = "Extension error";
    err.textContent = String(e.message || e);
  }
}

let busy = false;
conn.onclick = async () => {
  if (busy) return;
  busy = true;
  conn.disabled = true;
  err.textContent = "";
  status.textContent = "Connecting…";
  try {
    // Pasted string wins ONLY if untouched since autofill.
    // Any hand-edit flips quickFilled off, so the fields below are used.
    const q = quickFilled ? parseProxyString(quick.value) : null;
    const cfg = q || {
      host: host.value.trim(), port: Number(port.value) || 0,
      user: user.value, pass: pass.value
    };
    if (!cfg.host || !cfg.port) throw new Error("Paste host:port:user:pass up top, or fill host + port.");
    const body = { mode: "proxy", host: cfg.host, port: cfg.port,
                   user: cfg.user || "", pass: cfg.pass || "" };
    try {
      await send({ type: "connect", config: body });
    } catch (e) {
      await popupApply(body); // worker asleep -> apply from popup directly
    }
    // keep values visible (do NOT wipe); clear only the paste box
    quick.value = "";
    quickFilled = false;
    parsed.textContent = "";
    fillForm(body);
    await saveDraft();
    await refresh();
    err.textContent = "";
  } catch (e) {
    err.textContent = "Connect failed: " + String(e.message || e);
    status.textContent = "Connect failed";
  } finally {
    busy = false;
    conn.disabled = false;
  }
};

dis.onclick = async () => {
  if (busy) return;
  busy = true;
  dis.disabled = true;
  err.textContent = "";
  try {
    try {
      await send({ type: "disconnect" });
    } catch (e) {
      await popupApply({ mode: "direct" });
    }
    await refresh();
  } catch (e) {
    err.textContent = "Disconnect failed: " + String(e.message || e);
  } finally {
    busy = false;
    dis.disabled = false;
  }
};

(async () => {
  await restoreDraft();
  await refresh();
  setInterval(refresh, 2000);
})();
