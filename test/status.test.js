import assert from "node:assert/strict";
import { test } from "node:test";
import { describe, formatDuration, pickTarget } from "../src/popup/status.js";

const profiles = [
  { id: "a", name: "Alpha", scheme: "http", host: "a.io", port: 1, user: "", pass: "" },
  { id: "b", name: "", scheme: "http", host: "b.io", port: 2, user: "", pass: "" },
];
const state = (patch = {}) => ({ profiles, activeId: null, lastId: null, since: null, fault: null, draft: null, ...patch });

test("formatDuration", () => {
  assert.equal(formatDuration(0), "00:00:00");
  assert.equal(formatDuration(61_000), "00:01:01");
  assert.equal(formatDuration(3_725_000), "01:02:05");
  assert.equal(formatDuration(-5), "00:00:00");
});

test("pickTarget prefers the last used profile, else the first", () => {
  assert.equal(pickTarget(state({ lastId: "b" })).id, "b");
  assert.equal(pickTarget(state()).id, "a");
  assert.equal(pickTarget(state({ profiles: [] })), null);
});

test("describe covers idle / live / fault / busy", () => {
  assert.equal(describe({ state: state(), busy: false }).key, "idle");
  assert.match(describe({ state: state({ profiles: [] }), busy: false }).detail, /Add a proxy/);
  assert.equal(describe({ state: state({ activeId: "a" }), busy: false }).key, "live");
  assert.match(describe({ state: state({ activeId: "b" }), busy: false }).detail, /b\.io/); // falls back to host
  const fault = describe({ state: state({ activeId: "a", fault: "nope" }), busy: false });
  assert.deepEqual([fault.key, fault.detail], ["fault", "nope"]);
  assert.equal(describe({ state: state({ activeId: "a" }), busy: true }).key, "busy");
});
