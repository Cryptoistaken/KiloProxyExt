import { parsePort } from "./profile.js";

/**
 * Parse a pasted proxy string. Understands
 *   host:port                    host:port:user:pass   (pass may contain ":")
 *   user:pass@host:port          [ipv6]:port:user:pass
 * with or without a leading `scheme://`.
 *
 * @param {unknown} input
 * @returns {{host: string, port: number, user: string, pass: string} | null}
 */
export function parseProxy(input) {
  const text = String(input ?? "").trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  if (!text || /\s/.test(text)) return null;
  return parseAtForm(text) ?? parseColonForm(text);
}

/** `host:port` or `[v6]:port` */
function splitHostPort(target) {
  const i = target.lastIndexOf(":");
  if (i < 1) return null;
  const host = target.slice(0, i).replace(/^\[|\]$/g, "");
  const port = parsePort(target.slice(i + 1));
  return host && port ? { host, port } : null;
}

/** `user:pass@host:port` */
function parseAtForm(text) {
  const at = text.lastIndexOf("@");
  if (at < 1) return null;
  const credentials = text.slice(0, at);
  const colon = credentials.indexOf(":");
  const target = splitHostPort(text.slice(at + 1));
  if (colon < 1 || !target) return null;
  return { ...target, user: credentials.slice(0, colon), pass: credentials.slice(colon + 1) };
}

/** `host:port[:user[:pass]]` */
function parseColonForm(text) {
  let host;
  let rest;
  if (text.startsWith("[")) {
    const end = text.indexOf("]:");
    if (end < 0) return null;
    host = text.slice(1, end);
    rest = text.slice(end + 2);
  } else {
    const i = text.indexOf(":");
    if (i < 1) return null;
    host = text.slice(0, i);
    rest = text.slice(i + 1);
  }
  const [portText, user = "", ...pass] = rest.split(":");
  const port = parsePort(portText);
  return host && port ? { host, port, user, pass: pass.join(":") } : null;
}
