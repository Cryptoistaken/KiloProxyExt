import { labelOf } from "../shared/profile.js";
import { activeProfile } from "../shared/store.js";

/**
 * What the popup shows for the current state. Pure, so it is easy to test.
 * `key` drives the theme (body[data-state]); the rest is copy.
 *
 * @param {{ state: import("../shared/store.js").State, busy: boolean }} app
 * @returns {{ key: "idle"|"busy"|"live"|"fault", tag: string, label: string, detail: string }}
 */
export function describe({ state, busy }) {
  const active = activeProfile(state);
  if (busy) {
    return { key: "busy", tag: "Linking", label: "Switching", detail: "Applying proxy settings…" };
  }
  if (!active) {
    const target = pickTarget(state);
    return {
      key: "idle",
      tag: "Direct",
      label: "Direct",
      detail: target ? `Tap power to connect · ${labelOf(target)}` : "Add a proxy to get started.",
    };
  }
  if (state.fault) return { key: "fault", tag: "Fault", label: "Fault", detail: state.fault };
  return { key: "live", tag: "Live", label: "Connected", detail: `Routing through ${labelOf(active)}` };
}

/** The profile the power button connects to when idle: the last used, else the first. */
export function pickTarget({ profiles, lastId }) {
  return profiles.find((p) => p.id === lastId) ?? profiles[0] ?? null;
}

/** `HH:MM:SS` */
export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}
