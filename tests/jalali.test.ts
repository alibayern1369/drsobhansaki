import test from "node:test";
import assert from "node:assert/strict";
import {
  gregorianFromJalali,
  jalaliParts,
  daysInJalaliMonth,
  parsePersianTime,
  formatJalali,
} from "../src/lib/jalali";
test("Jalali Nowruz conversion and leap year boundaries", () => {
  assert.equal(gregorianFromJalali(1405, 1, 1), "2026-03-21");
  assert.equal(gregorianFromJalali(1403, 12, 30), "2025-03-20");
  assert.equal(gregorianFromJalali(1404, 12, 30), null);
  assert.equal(daysInJalaliMonth(1403, 12), 30);
  assert.equal(daysInJalaliMonth(1404, 12), 29);
  assert.deepEqual(jalaliParts(new Date("2026-03-21T00:00:00Z")), {
    year: 1405,
    month: 1,
    day: 1,
  });
});
test("Iranian time input accepts Persian digits and rejects invalid hours", () => {
  assert.equal(parsePersianTime("۱۴:۳۰"), "14:30");
  assert.equal(parsePersianTime("٢٣:٥٩"), "23:59");
  assert.equal(parsePersianTime("۲۴:۰۰"), null);
  assert.equal(parsePersianTime("۱۲:۶۰"), null);
  assert.match(formatJalali("2026-03-20T21:00:00Z"), /۱۴۰۵/);
});
