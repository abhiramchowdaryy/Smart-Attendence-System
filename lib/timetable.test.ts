// Unit tests for lib/timetable.ts — run: node --test lib/timetable.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatTime,
  groupByDay,
  DAY_NAMES,
  type TimetableSlot,
} from "./timetable.ts";

test("formatTime: 24h → 12h with AM/PM", () => {
  assert.equal(formatTime("09:00:00"), "9:00 AM");
  assert.equal(formatTime("09:00"), "9:00 AM");
  assert.equal(formatTime("13:30"), "1:30 PM");
  assert.equal(formatTime("00:15"), "12:15 AM");
  assert.equal(formatTime("12:00"), "12:00 PM");
});

test("DAY_NAMES: 1-indexed maps day_of_week directly", () => {
  assert.equal(DAY_NAMES[1], "Monday");
  assert.equal(DAY_NAMES[6], "Saturday");
});

function slot(
  id: string,
  day: number,
  start: string,
  end = "10:00"
): TimetableSlot {
  return {
    id,
    course_code: "C" + id,
    course_name: "Course " + id,
    day_of_week: day,
    start_time: start,
    end_time: end,
    section: "A",
  };
}

test("groupByDay: 6 buckets, sorted by start time", () => {
  const days = groupByDay([
    slot("1", 1, "10:00"),
    slot("2", 1, "09:00"),
    slot("3", 3, "11:00"),
  ]);
  assert.equal(days.length, 6);
  // Monday sorted ascending by start.
  assert.deepEqual(days[0].map((s) => s.id), ["2", "1"]);
  // Wednesday.
  assert.deepEqual(days[2].map((s) => s.id), ["3"]);
  // Empty days.
  assert.deepEqual(days[1], []);
  assert.deepEqual(days[5], []);
});

test("groupByDay: out-of-range days are ignored", () => {
  const days = groupByDay([slot("1", 7, "09:00"), slot("2", 0, "09:00")]);
  assert.deepEqual(days.flat(), []);
});
