/**
 * Jalali (Persian / Solar Hijri) calendar helpers.
 *
 * The arithmetic conversion is implemented here instead of relying on
 * `Intl.DateTimeFormat`, so a Persian date picker behaves identically on
 * engines with a reduced ICU build. The 33-year cycle table matches the
 * reference algorithm used by `toLocaleDateString("fa-IR")`.
 */

export type JalaliDate = { jy: number; jm: number; jd: number };

const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const PERSIAN_WEEKDAYS = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
  2192, 2262, 2324, 2394, 2456,
];

const div = (a: number, b: number) => ~~(a / b);
const mod = (a: number, b: number) => a - ~~(a / b) * b;

function jalCal(jy: number) {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;
  for (let i = 0; i < bl; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

/** Gregorian calendar date → Julian day number (Fliegel & Van Flandern). */
const g2d = (gy: number, gm: number, gd: number) => {
  const a = Math.floor((14 - gm) / 12);
  const yy = gy + 4800 - a;
  const mm = gm + 12 * a - 3;
  return (
    gd +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  );
};

/** Julian day number → Gregorian calendar date. */
const d2g = (jdn: number) => {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    gy: 100 * b + d - 4800 + Math.floor((m + 2) / 12),
    gm: m + 3 - 12 * Math.floor((m + 2) / 12),
    gd: e - Math.floor((153 * m + 2) / 5) + 1,
  };
};

/** Persian year/month/day → Julian day number. */
export function jalaliToDayNumber(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

/** Julian day number → Persian year/month/day. */
export function dayNumberToJalali(jdn: number): JalaliDate {
  const g = d2g(jdn);
  let jy = g.gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(g.gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185)
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

/** Persian leap years close the cycle with 30 days in Esfand. */
export const isJalaliLeap = (jy: number) => jalCal(jy).leap === 0;

export const jalaliMonthLength = (jy: number, jm: number) =>
  jm <= 6 ? 31 : jm <= 11 ? 30 : isJalaliLeap(jy) ? 30 : 29;

/** Local-time Date at noon → avoids DST/day-shift edge cases. */
export function dateToJalali(date: Date): JalaliDate {
  return dayNumberToJalali(
    g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()),
  );
}

export function jalaliToDate(jy: number, jm: number, jd: number): Date {
  const g = d2g(jalaliToDayNumber(jy, jm, jd));
  return new Date(g.gy, g.gm - 1, g.gd, 12, 0, 0, 0);
}

/** `YYYY-MM-DD` (proleptic Gregorian, local wall time) from a Persian date. */
export function jalaliToIso(jy: number, jm: number, jd: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const g = d2g(jalaliToDayNumber(jy, jm, jd));
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

/** Parses `YYYY-MM-DD` (or a full ISO timestamp) into a Persian date. */
export function isoToJalali(value?: string | null): JalaliDate | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? dateToJalali(date) : null;
  }
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0);
  return Number.isFinite(date.getTime()) ? dateToJalali(date) : null;
}

/** Weekday index where 0 = Saturday (the Iranian week start). */
export const persianWeekdayIndex = (date: Date) => (date.getDay() + 1) % 7;

const faDigits = (value: string | number) =>
  String(value).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

/** «۱۹ آبان ۱۴۰» */
export function formatJalali(value?: string | Date | null, withTime = false) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const { jy, jm, jd } = dateToJalali(date);
  const text = `${faDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${faDigits(jy)}`;
  if (!withTime) return text;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${text} · ${faDigits(`${hh}:${mm}`)}`;
}

/** «۱۴۰۵/۰۸/۱۹» */
export function formatJalaliNumeric(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const { jy, jm, jd } = dateToJalali(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return faDigits(`${jy}-${pad(jm)}-${pad(jd)}`);
}

/**
 * Persian day label for a stored date, read from its `YYYY-MM-DD` part only.
 * Panel forms store a day and the API stores day bounds such as
 * `2026-11-10T23:59:59.999Z`; formatting the instant would show the following
 * day to anyone east of UTC, so date fields go through this instead.
 */
export function formatJalaliDay(value?: string | Date | null) {
  if (!value) return "";
  let day: string;
  if (typeof value === "string") {
    day = value.slice(0, 10);
  } else {
    const pad = (n: number) => String(n).padStart(2, "0");
    day = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
      value.getDate(),
    )}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return formatJalali(value);
  // Noon keeps the local Date constructors away from daylight-saving edges.
  return formatJalali(new Date(`${day}T12:00:00`));
}

export const persianMonthNames = PERSIAN_MONTHS;
export const persianWeekDayNames = PERSIAN_WEEKDAYS;
/** Single-letter weekday labels for compact calendar headers. */
export const persianWeekDayShort = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
export const toPersianDigits = faDigits;
export { faDigits };
