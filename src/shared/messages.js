/** Requests the popup can make of the background worker. */
export const Message = Object.freeze({
  CONNECT: "connect", // { id }  route traffic through a saved profile
  DISCONNECT: "disconnect", // go direct
});

/**
 * Send a request to the background worker.
 * @param {string} type  One of {@link Message}
 * @param {object} [payload]
 * @throws {Error} with the worker's message when it refuses or fails
 */
export async function request(type, payload = {}) {
  const reply = await chrome.runtime.sendMessage({ type, ...payload });
  if (!reply?.ok) throw new Error(reply?.error ?? "The background worker did not respond.");
}
