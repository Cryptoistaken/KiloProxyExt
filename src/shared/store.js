/**
 * Persistent state shared by the popup and the background worker.
 * Everything lives in `chrome.storage.local`.
 *
 * @typedef {import("./profile.js").Profile} Profile
 *
 * Unsaved editor contents. Chrome closes the popup whenever it loses focus,
 * so the form is mirrored here and restored on the next open.
 * @typedef {Object} Draft
 * @property {string|null} editing  id of the profile being edited, or null for a new one
 * @property {string} paste
 * @property {string} name
 * @property {"http"|"https"} scheme
 * @property {string} host
 * @property {string} port
 * @property {string} user
 * @property {string} pass
 *
 * @typedef {Object} State
 * @property {Profile[]} profiles
 * @property {string|null} activeId  Connected profile, or null when direct.
 * @property {string|null} lastId    Most recently connected profile (what the power button reconnects).
 * @property {number|null} since     Epoch ms when the current connection started.
 * @property {string|null} fault     Human-readable problem with the current connection.
 * @property {string|null} directIp  IP seen without the proxy (measured at connect).
 * @property {string|null} exitIp    Verified proxy exit IP, or null when unverified.
 * @property {number|null} verifiedAt Epoch ms of the last verification.
 * @property {Draft|null} draft
 */

/** @type {Readonly<State>} */
export const DEFAULTS = Object.freeze({
  profiles: [],
  activeId: null,
  lastId: null,
  since: null,
  fault: null,
  directIp: null,
  exitIp: null,
  verifiedAt: null,
  draft: null,
});

const KEYS = Object.keys(DEFAULTS);

/** @returns {Promise<State>} */
export async function load() {
  return { ...structuredClone(DEFAULTS), ...(await chrome.storage.local.get(KEYS)) };
}

/** @param {Partial<State>} patch */
export const save = (patch) => chrome.storage.local.set(patch);

/**
 * Call `listener` with the changed keys (as a partial State) on every update.
 * @param {(patch: Partial<State>) => void} listener
 */
export function watch(listener) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const patch = {};
    for (const key of KEYS) {
      if (key in changes) patch[key] = changes[key].newValue ?? structuredClone(DEFAULTS[key]);
    }
    if (Object.keys(patch).length) listener(patch);
  });
}

/** @param {Pick<State, "profiles"|"activeId">} state */
export const activeProfile = (state) =>
  state.profiles.find((p) => p.id === state.activeId) ?? null;
