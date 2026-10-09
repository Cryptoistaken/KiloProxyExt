import assert from "node:assert/strict";
import { test } from "node:test";
import { isBypassed, isIp } from "../src/background/verify.js";

test("isIp accepts dotted quads only", () => {
  assert.equal(isIp("103.73.185.61"), true);
  assert.equal(isIp("  1.2.3.4\n"), true);
  assert.equal(isIp(""), false);
  assert.equal(isIp("Forbidden"), false);
  assert.equal(isIp("2001:db8::1"), false);
});

test("isBypassed flags exit matching direct", () => {
  assert.equal(isBypassed("1.2.3.4", "1.2.3.4"), true);
  assert.equal(isBypassed("1.2.3.4", "5.6.7.8"), false);
  assert.equal(isBypassed(null, "5.6.7.8"), false);
  assert.equal(isBypassed("1.2.3.4", null), false);
});
