import assert from "node:assert/strict";
import { test } from "node:test";
import { LOG_CAP, appendLog, hostOf } from "../src/shared/netlog.js";

test("hostOf keeps the hostname only", () => {
  assert.equal(hostOf("https://ip-api.com/json/?x=1"), "ip-api.com");
  assert.equal(hostOf("http://127.0.0.1:18080/x"), "127.0.0.1");
  assert.equal(hostOf("not a url"), "");
});

test("appendLog caps at LOG_CAP, oldest dropped", () => {
  let entries = [];
  for (let i = 0; i < LOG_CAP + 5; i++) {
    entries = appendLog(entries, { t: i, method: "GET", host: `h${i}.io`, status: 200 });
  }
  assert.equal(entries.length, LOG_CAP);
  assert.equal(entries[0].host, "h5.io");
  assert.equal(entries.at(-1).host, `h${LOG_CAP + 4}.io`);
});
