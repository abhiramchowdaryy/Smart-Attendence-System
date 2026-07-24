// Unit tests for lib/sms.ts — run: node --test lib/sms.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeIndianPhone, buildShortfallMessage } from "./sms.ts";

test("normalizeIndianPhone: accepts common Indian formats", () => {
  assert.equal(normalizeIndianPhone("9876543210"), "+919876543210");
  assert.equal(normalizeIndianPhone("09876543210"), "+919876543210");
  assert.equal(normalizeIndianPhone("+91 98765 43210"), "+919876543210");
  assert.equal(normalizeIndianPhone("91-9876543210"), "+919876543210");
  assert.equal(normalizeIndianPhone("98765-43210"), "+919876543210");
});

test("normalizeIndianPhone: rejects invalid numbers", () => {
  assert.equal(normalizeIndianPhone(""), null);
  assert.equal(normalizeIndianPhone(null), null);
  assert.equal(normalizeIndianPhone("12345"), null); // too short
  assert.equal(normalizeIndianPhone("1234567890"), null); // starts with 1
  assert.equal(normalizeIndianPhone("98765432100"), null); // 11 digits
});

test("buildShortfallMessage: fills the template and rounds the pct", () => {
  const msg = buildShortfallMessage({
    studentName: "Asha R",
    courseName: "Data Structures",
    officialPct: 61.4,
  });
  assert.match(msg, /Asha R/);
  assert.match(msg, /Data Structures/);
  assert.match(msg, /61%/);
  assert.match(msg, /75% requirement/);
  assert.match(msg, /PES University/);
});

test("buildShortfallMessage: honours a custom threshold", () => {
  const msg = buildShortfallMessage({
    studentName: "X",
    courseName: "Y",
    officialPct: 50,
    threshold: 80,
  });
  assert.match(msg, /80% requirement/);
});
