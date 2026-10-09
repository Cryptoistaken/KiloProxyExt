/**
 * A saved proxy.
 * @typedef {Object} Profile
 * @property {string} id
 * @property {string} name        Optional label; the host is shown when empty.
 * @property {"http"|"https"} scheme
 * @property {string} host
 * @property {number} port
 * @property {string} user
 * @property {string} pass
 */

export const isPort = (n) => Number.isInteger(n) && n >= 1 && n <= 65535;

/** Strict port parser: digits only (so "0x50" or "80.5" are rejected). Returns NaN when invalid. */
export const parsePort = (text) => {
  const n = /^\d{1,5}$/.test(text) ? Number(text) : NaN;
  return isPort(n) ? n : NaN;
};

/** Display name for a profile. */
export const labelOf = (p) => p.name || p.host;

/** `host:port`, bracketing IPv6 literals. */
export const addressOf = (p) => `${p.host.includes(":") ? `[${p.host}]` : p.host}:${p.port}`;

/** Stable key for matching an auth challenge to a profile. */
export const endpointKey = (host, port) =>
  `${host.replace(/^\[|\]$/g, "").toLowerCase()}:${port}`;

/** ISO country targeted by a Proxyrise-style username (res-cc, country-cc), or null. */
export const countryOf = (user) => {
  const m = /(?:^|-)res-([a-z]{2})(?:-|$)|country-([a-z]{2})/i.exec(String(user ?? ""));
  return (m && (m[1] || m[2]) || "").toLowerCase() || null;
};

export const isCountry = (cc) => /^[a-z]{2}$/i.test(String(cc ?? ""));

/**
 * Rewrite user to target country cc, preserving any suffix
 * (res-bd-sess-abc -> res-us-sess-abc). Empty user becomes res-cc.
 * Returns null when there is no recognised country slot or cc is bad.
 */
export const switchCountry = (user, cc) => {
  cc = String(cc ?? "").toLowerCase();
  if (!isCountry(cc)) return null;
  const text = String(user ?? "");
  if (!text) return "res-" + cc;
  if (/^res-[a-z]{2}(?![a-z])/i.test(text)) return text.replace(/^res-[a-z]{2}/i, "res-" + cc);
  if (/country-[a-z]{2}/i.test(text)) return text.replace(/country-[a-z]{2}/i, "country-" + cc);
  return null;
};
