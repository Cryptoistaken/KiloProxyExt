const DIRECT = { mode: "direct" };

/** Time for Chrome to drop sockets that were authenticated as the previous login. */
const SOCKET_FLUSH_MS = 250;

const set = (value) => chrome.proxy.settings.set({ scope: "regular", value });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fixedServers = (p) => ({
  mode: "fixed_servers",
  rules: {
    singleProxy: { scheme: p.scheme, host: p.host, port: p.port },
    bypassList: ["<local>"],
  },
});

/**
 * Switch to a proxy. Going direct first matters: another login on the same
 * host:port would otherwise reuse the previous login's live sockets and
 * never re-authenticate.
 * @param {import("../shared/profile.js").Profile} profile
 */
export async function engage(profile) {
  await set(DIRECT);
  await sleep(SOCKET_FLUSH_MS);
  await set(fixedServers(profile));
}

/** Go direct. */
export const release = () => set(DIRECT);

/**
 * Re-apply a proxy Chrome has lost, without the direct gap of {@link engage}.
 * @param {import("../shared/profile.js").Profile} profile
 */
export const reassert = (profile) => set(fixedServers(profile));

/**
 * Compare Chrome's real proxy setting with what we expect.
 * @param {import("../shared/profile.js").Profile} profile
 * @returns {Promise<"ok" | "drifted" | "overridden">}
 *   `overridden`: another extension owns the setting, so ours has no effect.
 *   `drifted`: Chrome is not routing through `profile` (setting was reset).
 */
export async function inspect(profile) {
  const { levelOfControl, value } = await chrome.proxy.settings.get({});
  if (levelOfControl === "controlled_by_other_extensions") return "overridden";
  const target = value.rules?.singleProxy;
  const matches =
    value.mode === "fixed_servers" &&
    target?.host === profile.host &&
    target?.port === profile.port &&
    target?.scheme === profile.scheme;
  return matches ? "ok" : "drifted";
}
