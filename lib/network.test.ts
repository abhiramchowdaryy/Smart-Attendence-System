// Unit tests for lib/network.ts + lib/attendance-status.ts
// run: node --test lib/network.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIp, normalizePrefixes, ipMatchesNetwork } from "./network.ts";
import { attendanceLabel } from "./attendance-status.ts";

test("clientIp: first hop of X-Forwarded-For", () => {
  assert.equal(clientIp("203.0.113.7, 10.0.0.1"), "203.0.113.7");
  assert.equal(clientIp(" 203.0.113.7 "), "203.0.113.7");
  assert.equal(clientIp(null), null);
  assert.equal(clientIp(""), null);
});

test("normalizePrefixes: trims and drops empties", () => {
  assert.deepEqual(normalizePrefixes([" 10.20. ", "", "  ", "203.0."]), [
    "10.20.",
    "203.0.",
  ]);
});

test("ipMatchesNetwork: prefix match, empty list disables", () => {
  assert.equal(ipMatchesNetwork("203.0.113.7", ["203.0."]), true);
  assert.equal(ipMatchesNetwork("203.0.113.7", ["10.20.", "203.0.113."]), true);
  assert.equal(ipMatchesNetwork("198.51.100.2", ["203.0."]), false);
  assert.equal(ipMatchesNetwork("203.0.113.7", []), false);
  assert.equal(ipMatchesNetwork(null, ["203.0."]), false);
});

test("attendanceLabel: the five PDF outcomes from flags", () => {
  assert.equal(attendanceLabel(false, false), "Present");
  assert.equal(attendanceLabel(true, false), "Late Entry");
  assert.equal(attendanceLabel(false, true), "Early Exit");
  assert.equal(attendanceLabel(true, true), "Partial");
});
