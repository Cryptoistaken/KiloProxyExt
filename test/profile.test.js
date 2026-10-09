import assert from "node:assert/strict";
import { test } from "node:test";
import { countryOf, switchCountry } from "../src/shared/profile.js";

test("countryOf reads res-cc usernames", () => {
  assert.equal(countryOf("res-bd"), "bd");
  assert.equal(countryOf("res-CM"), "cm");
  assert.equal(countryOf("res-us-sess-abc"), "us");
  assert.equal(countryOf("plain"), null);
  assert.equal(countryOf(""), null);
});

test("switchCountry swaps the code and keeps the suffix", () => {
  assert.equal(switchCountry("res-bd", "us"), "res-us");
  assert.equal(switchCountry("res-bd-sess-abc", "GB"), "res-gb-sess-abc");
  assert.equal(switchCountry("", "de"), "res-de");
  assert.equal(switchCountry("plain", "us"), null);
  assert.equal(switchCountry("res-bd", "xx1"), null);
});
