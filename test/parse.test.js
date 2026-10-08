import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProxy } from "../src/shared/parse.js";

const p = (host, port, user = "", pass = "") => ({ host, port, user, pass });

test("host:port", () => assert.deepEqual(parseProxy("gw.example.com:443"), p("gw.example.com", 443)));
test("host:port:user:pass", () =>
  assert.deepEqual(parseProxy("gw.example.com:443:res-cm:hunter2"), p("gw.example.com", 443, "res-cm", "hunter2")));
test("password may contain colons", () =>
  assert.deepEqual(parseProxy("h.io:80:u:pa:ss:word"), p("h.io", 80, "u", "pa:ss:word")));
test("user:pass@host:port", () => assert.deepEqual(parseProxy("u:p@h.io:8080"), p("h.io", 8080, "u", "p")));
test("password may contain @ in both forms", () => {
  assert.deepEqual(parseProxy("u:p@ss@h.io:8080"), p("h.io", 8080, "u", "p@ss"));
  assert.deepEqual(parseProxy("h.io:80:u:p@ss"), p("h.io", 80, "u", "p@ss"));
});
test("scheme prefix and surrounding whitespace are ignored", () =>
  assert.deepEqual(parseProxy("  http://u:p@h.io:3128\n"), p("h.io", 3128, "u", "p")));
test("IPv6 literals", () => {
  assert.deepEqual(parseProxy("[::1]:9:u:p"), p("::1", 9, "u", "p"));
  assert.deepEqual(parseProxy("u:p@[2001:db8::1]:8080"), p("2001:db8::1", 8080, "u", "p"));
});
test("rejects garbage", () => {
  for (const bad of ["", "   ", null, undefined, "host", "host:", ":80", "h:0", "h:65536", "h:0x50", "h:80.5", "a b:80"]) {
    assert.equal(parseProxy(bad), null, JSON.stringify(bad));
  }
});
