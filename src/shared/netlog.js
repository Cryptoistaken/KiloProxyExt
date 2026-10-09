/** Pure helpers for the connection log (who went through the proxy). No chrome APIs. */

/** Max entries kept in memory. */
export const LOG_CAP = 50;

/**
 * @typedef {Object} LogEntry
 * @property {number} t        Epoch ms when the request finished.
 * @property {string} method   HTTP method (may be empty).
 * @property {string} host     Destination hostname only (no path, no query).
 * @property {number|string} status  HTTP status, or "error".
 */

/** Hostname of a URL, or "" when unparseable. */
export const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

/** Append an entry, keeping at most `cap` (oldest dropped). */
export const appendLog = (entries, entry, cap = LOG_CAP) => [...entries, entry].slice(-cap);
