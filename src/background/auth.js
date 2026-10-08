import { endpointKey } from "../shared/profile.js";

const ALL = { urls: ["<all_urls>"] };

/** Login for the proxy we are routing through. Memory only; rebuilt on every worker start. */
let login = null; // { key, username, password, reported }

/** Requests already answered once. Being challenged again means the login was refused. */
const answered = new Set();

/**
 * Set (or clear) the credentials offered to the proxy.
 * @param {import("../shared/profile.js").Profile | null} profile
 */
export function arm(profile) {
  answered.clear();
  login = profile && {
    key: endpointKey(profile.host, profile.port),
    username: profile.user,
    password: profile.pass,
    reported: false,
  };
}

/**
 * Answer proxy authentication challenges. Call synchronously at worker start.
 *
 * The handler has to stay synchronous and `blocking`: the async variants
 * never answer for proxy auth in Manifest V3.
 *
 * @param {{ onRejected: () => void }} hooks  `onRejected` fires once per `arm()`.
 */
export function listen({ onRejected }) {
  chrome.webRequest.onAuthRequired.addListener(
    (details) => {
      if (!login || !details.isProxy) return;
      if (login.key !== endpointKey(details.challenger.host, details.challenger.port)) return;

      if (answered.has(details.requestId)) {
        if (!login.reported) {
          login.reported = true;
          onRejected();
        }
        return { cancel: true };
      }
      answered.add(details.requestId);
      return { authCredentials: { username: login.username, password: login.password } };
    },
    ALL,
    ["blocking"]
  );

  const settle = ({ requestId }) => answered.delete(requestId);
  chrome.webRequest.onCompleted.addListener(settle, ALL);
  chrome.webRequest.onErrorOccurred.addListener(settle, ALL);
}
