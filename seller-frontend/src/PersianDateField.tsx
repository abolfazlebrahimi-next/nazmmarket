import { useEffect, useRef, useState } from "react";
import {
  dateToJalali,
  formatJalali,
  jalaliMonthLength,
  jalaliToDate,
  jalaliToIso,
  isoToJalali,
  persianMonthNames,
  persianWeekDayShort,
  toPersianDigits,
} from "../../shared/persianDate";

type Props = {
  /** Chosen day as a Gregorian `YYYY-MM-DD` string, or empty when unset. */
  value?: string | null;
  onChange: (iso: string | null) => void;
  /** First selectable day, `YYYY-MM-DD` (inclusive) — e.g. today for a deadline. */
  minIso?: string;
  /** Last selectable day, `YYYY-MM-DD` (inclusive) — e.g. today for a birth date. */
  maxIso?: string;
  hint?: string;
  placeholder?: string;
};

/**
 * Jalali date picker used wherever a panel needs a Persian date instead of a
 * native Gregorian `<input type="date">`. The emitted value stays Gregorian
 * `YYYY-MM-DD`, so the API contract is unchanged and only the presentation is
 * Persian. Density comes from `--jd-*` custom properties in
 * shared/persianDateField.css, which each panel overrides once; the component
 * itself is copied per panel because the panels build independently.
 */
export default function PersianDateField({
  value,
  onChange,
  minIso,
  maxIso,
  hint,
  placeholder = "انتخاب تاریخ",
}: Props) {
  const today = dateToJalali(new Date());
  const selected = parseIso(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(
    () => selected ?? { jy: today.jy, jm: today.jm, jd: today.jd },
  );
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // While closed the header follows the chosen day, so the trigger and the
  // calendar never disagree after a pick from another month.
  const { jy: year, jm: month } = open ? view : (selected ?? view);
  const days = jalaliMonthLength(year, month);
  // Persian weeks start on Saturday: getDay() 6 (Sat) must map to index 0.
  const firstWeekday = (jalaliToDate(year, month, 1).getDay() + 1) % 7;
  const blocked = (iso: string) =>
    Boolean((minIso && iso < minIso) || (maxIso && iso > maxIso));

  const pick = (jd: number) => {
    onChange(jalaliToIso(year, month, jd));
    setOpen(false);
  };
  const shiftMonth = (delta: number) =>
    setView((v) => {
      const total = (v.jy - 1300) * 12 + (v.jm - 1) + delta;
      return {
        jy: 1300 + Math.floor(total / 12),
        jm: (((total % 12) + 12) % 12) + 1,
        jd: 1,
      };
    });

  return (
    <div className="naz-jalali" ref={box}>
      <button
        type="button"
        className={`naz-jalali-trigger${value ? " has-value" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (selected) setView(selected);
          setOpen((o) => !o);
        }}
      >
        <span className="naz-jalali-value">
          {value ? formatJalali(new Date(`${value}T12:00:00`)) : placeholder}
        </span>
        <span className="naz-jalali-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M8 3v4M16 3v4M3 11h18" />
          </svg>
        </span>
      </button>
      {value ? (
        <button
          type="button"
          className="naz-jalali-clear"
          aria-label="پاک کردن تاریخ"
          onClick={() => onChange(null)}
        >
          ×
        </button>
      ) : null}
      {open ? (
        <div
          className="naz-jalali-pop"
          role="dialog"
          aria-label="انتخاب تاریخ شمسی"
        >
          <div className="naz-jalali-head">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="ماه قبل"
            >
              ›
            </button>
            <div className="naz-jalali-title">
              <b>{persianMonthNames[month - 1]}</b>
              <span>{toPersianDigits(year)}</span>
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="ماه بعد"
            >
              ‹
            </button>
          </div>
          <div className="naz-jalali-grid naz-jalali-week" aria-hidden="true">
            {persianWeekDayShort.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="naz-jalali-grid naz-jalali-days">
            {Array.from({ length: firstWeekday }).map((_, index) => (
              <span key={`blank-${index}`} aria-hidden="true" />
            ))}
            {Array.from({ length: days }).map((_, index) => {
              const jd = index + 1,
                iso = jalaliToIso(year, month, jd),
                isSelected =
                  selected?.jy === year &&
                  selected?.jm === month &&
                  selected?.jd === jd,
                isToday =
                  today.jy === year &&
                  today.jm === month &&
                  today.jd === jd;
              return (
                <button
                  key={jd}
                  type="button"
                  disabled={blocked(iso)}
                  className={`${isSelected ? "is-selected" : ""}${isToday ? " is-today" : ""}`}
                  onClick={() => pick(jd)}
                >
                  {toPersianDigits(jd)}
                </button>
              );
            })}
          </div>
          <div className="naz-jalali-foot">
            <button
              type="button"
              disabled={blocked(jalaliToIso(today.jy, today.jm, today.jd))}
              onClick={() => {
                setView(today);
                onChange(jalaliToIso(today.jy, today.jm, today.jd));
                setOpen(false);
              }}
            >
              امروز
            </button>
            <span>{hint ?? ""}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Reads a `YYYY-MM-DD` string back into a Persian day, or null when invalid. */
const parseIso = (iso?: string | null) => isoToJalali(iso ?? null);
