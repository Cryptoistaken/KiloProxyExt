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
