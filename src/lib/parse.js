// Parse a proxy string into { host, port, user, pass }, or null.
// Accepted: host:port, host:port:user:pass (pass may contain ':'),
// user:pass@host:port, optional scheme:// prefix, [ipv6] hosts.

const validPort = (n) => Number.isInteger(n) && n > 0 && n <= 65535;
const unbracket = (h) => h.replace(/^\[|\]$/g, "");

export function parseProxy(input) {
  const s = String(input ?? "").trim().replace(/^\w+:\/\//, "");
  if (!s || /\s/.test(s)) return null;

  const at = s.lastIndexOf("@");
  if (at > 0) {
    const cred = s.slice(0, at);
    const target = s.slice(at + 1);
    const ci = cred.indexOf(":");
    const hp = splitHostPort(target);
    if (ci < 1 || !hp) return null;
    return { ...hp, user: cred.slice(0, ci), pass: cred.slice(ci + 1) };
  }

  const v6 = s.match(/^(\[[^\]]+\]):(\d+)(?::([^:]*)(?::(.*))?)?$/);
  if (v6) {
    const port = Number(v6[2]);
    return validPort(port)
      ? { host: unbracket(v6[1]), port, user: v6[3] ?? "", pass: v6[4] ?? "" }
      : null;
  }

  const [host, p, user = "", ...rest] = s.split(":");
  const port = Number(p);
  if (!host || !validPort(port)) return null;
  return { host, port, user, pass: rest.join(":") };
}

function splitHostPort(t) {
  const i = t.lastIndexOf(":");
  if (i < 1) return null;
  const host = unbracket(t.slice(0, i));
  const port = Number(t.slice(i + 1));
  return host && validPort(port) ? { host, port } : null;
}

export const authKey = (host, port) => `${host}:${port}`;
