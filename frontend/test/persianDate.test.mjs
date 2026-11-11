import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";

// The Persian calendar helpers drive every date field in the panels, so the
// conversion is checked against the platform's own Persian calendar instead of
// a frozen table of examples.
const source = await fs.readFile(
  new URL("../../shared/persianDate.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
});
const {
  dateToJalali,
  jalaliToDate,
  jalaliToIso,
  isoToJalali,
  jalaliMonthLength,
  isJalaliLeap,
  formatJalali,
  formatJalaliDay,
  formatJalaliNumeric,
  persianWeekdayIndex,
  toPersianDigits,
} = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);

/** Latin digits to Persian digits, so expectations never embed literals. */
const fa = (text) =>
  String(text).replace(/[0-9]/g, (d) => toPersianDigits(Number(d)));

const icu = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  numberingSystem: "latn",
  timeZone: "UTC",
});
const icuJalali = (date) => {
  const parts = {};
  for (const { type, value } of icu.formatToParts(date)) parts[type] = value;
  return { jy: +parts.year, jm: +parts.month, jd: +parts.day };
};

test("every day from 1850 to 2100 matches the platform Persian calendar", () => {
  let checked = 0;
  for (
    let t = Date.UTC(1850, 0, 1);
    t <= Date.UTC(2100, 0, 1);
    t += 86400000 * 11
  ) {
    const date = new Date(t);
    const mine = dateToJalali(
      new Date(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        12,
      ),
    );
    assert.deepEqual(mine, icuJalali(date), date.toISOString());
    checked += 1;
  }
  assert.ok(checked > 7000, `expected a wide sweep, got ${checked} days`);
});

test("picking a Persian day and reading it back is lossless", () => {
  for (let jy = 1370; jy <= 1420; jy++)
    for (let jm = 1; jm <= 12; jm++)
      for (let jd = 1; jd <= jalaliMonthLength(jy, jm); jd++) {
        const back = dateToJalali(jalaliToDate(jy, jm, jd));
        assert.deepEqual(back, { jy, jm, jd }, `${jy}-${jm}-${jd}`);
      }
});

test("month lengths follow the Persian leap rule", () => {
  assert.equal(jalaliMonthLength(1405, 1), 31);
  assert.equal(jalaliMonthLength(1405, 7), 30);
  assert.equal(isJalaliLeap(1403), true);
  assert.equal(jalaliMonthLength(1403, 12), 30);
  assert.equal(jalaliMonthLength(1405, 12), 29);
});

test("ISO helpers round-trip and stay zero padded", () => {
  assert.equal(jalaliToIso(1405, 8, 19), "2026-11-10");
  assert.deepEqual(isoToJalali("2026-11-10"), { jy: 1405, jm: 8, jd: 19 });
  assert.deepEqual(isoToJalali("2026-11-10T21:30:00.000Z"), {
    jy: 1405,
    jm: 8,
    jd: 19,
  });
  assert.equal(isoToJalali(""), null);
  assert.equal(isoToJalali(null), null);
});

test("labels render in Persian digits and month names", () => {
  const date = new Date(2026, 10, 10, 9, 5);
  // 19 Aban 1405 in the Persian calendar.
  assert.equal(formatJalali(date), fa("19") + " آبان " + fa("1405"));
  assert.equal(
    formatJalali(date, true),
    fa("19") + " آبان " + fa("1405") + " · " + fa("09:05"),
  );
  assert.equal(formatJalaliNumeric("2026-11-10"), fa("1405-08-19"));
  assert.equal(formatJalali(null), "");
});

test("the Persian week starts on Saturday", () => {
  assert.equal(persianWeekdayIndex(new Date(2026, 10, 7)), 0); // Saturday
  assert.equal(persianWeekdayIndex(new Date(2026, 10, 10)), 3); // Tuesday
  assert.equal(persianWeekdayIndex(new Date(2026, 10, 13)), 6); // Friday
});

test("a stored day keeps its label in every time zone", () => {
  const day = jalaliToIso(1405, 8, 19); // 2026-11-10
  const endOfDay = `${day}T23:59:59.999Z`;
  const expected = formatJalaliDay(day);
  const zone = process.env.TZ;
  try {
    for (const tz of ["UTC", "Asia/Tehran", "America/Los_Angeles"]) {
      process.env.TZ = tz;
      assert.equal(formatJalaliDay(endOfDay), expected, `drifted in ${tz}`);
      // The day itself stays where the picker put it.
      assert.equal(
        formatJalaliDay(day),
        fa("19") + " آبان " + fa("1405"),
        `wrong day in ${tz}`,
      );
    }
    // Formatting the instant instead of the day is exactly the bug above.
    process.env.TZ = "Asia/Tehran";
    assert.notEqual(formatJalaliDay(endOfDay), formatJalali(new Date(endOfDay)));
  } finally {
    process.env.TZ = zone;
  }
  assert.equal(formatJalaliDay(null), "");
});
