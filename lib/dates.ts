import { TZDate } from "@date-fns/tz";
import {
  addDays,
  endOfISOWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
} from "date-fns";

/** Day key in local time, e.g. "2026-10-18". */
export type DayKey = string;

export const DEFAULT_TZ = "Europe/Zurich";
export const DEFAULT_DAY_START_HOUR = 4;

/**
 * The "logical" day for an instant: before `dayStartHour` local time the
 * instant still belongs to the previous day (a 01:00 journal entry is
 * "yesterday"). Returns a YYYY-MM-DD key.
 */
export function logicalDayKey(
  instant: Date,
  tz: string = DEFAULT_TZ,
  dayStartHour: number = DEFAULT_DAY_START_HOUR,
): DayKey {
  const local = new TZDate(instant, tz);
  const shifted = local.getHours() < dayStartHour ? addDays(local, -1) : local;
  return format(shifted, "yyyy-MM-dd");
}

export function todayKey(
  tz: string = DEFAULT_TZ,
  dayStartHour: number = DEFAULT_DAY_START_HOUR,
  now: Date = new Date(),
): DayKey {
  return logicalDayKey(now, tz, dayStartHour);
}

/** Parse a day key into a local midnight TZDate. */
export function dayKeyToDate(key: DayKey, tz: string = DEFAULT_TZ): TZDate {
  const [y, m, d] = key.split("-").map(Number);
  return new TZDate(y, m - 1, d, 0, 0, 0, tz);
}

export function addDaysToKey(key: DayKey, days: number, tz: string = DEFAULT_TZ): DayKey {
  return format(addDays(dayKeyToDate(key, tz), days), "yyyy-MM-dd");
}

export type ReviewType = "day" | "week" | "month" | "quarter" | "year";

export interface Period {
  type: ReviewType;
  /** Stable id: 2026-10-18, 2026-W42, 2026-10, 2026-Q4, 2026 */
  id: string;
  start: DayKey;
  end: DayKey;
}

/** The period of a given type containing the day key. */
export function periodFor(type: ReviewType, key: DayKey, tz: string = DEFAULT_TZ): Period {
  const d = dayKeyToDate(key, tz);
  const f = (x: Date) => format(x, "yyyy-MM-dd");
  switch (type) {
    case "day":
      return { type, id: key, start: key, end: key };
    case "week": {
      const s = startOfISOWeek(d);
      const e = endOfISOWeek(d);
      const id = `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
      return { type, id, start: f(s), end: f(e) };
    }
    case "month":
      return { type, id: format(d, "yyyy-MM"), start: f(startOfMonth(d)), end: f(endOfMonth(d)) };
    case "quarter": {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return { type, id: `${d.getFullYear()}-Q${q}`, start: f(startOfQuarter(d)), end: f(endOfQuarter(d)) };
    }
    case "year":
      return { type, id: String(d.getFullYear()), start: f(startOfYear(d)), end: f(endOfYear(d)) };
  }
}

/** Parse a period id back into a Period. Returns null for malformed ids. */
export function parsePeriodId(id: string, tz: string = DEFAULT_TZ): Period | null {
  let m: RegExpMatchArray | null;
  if ((m = id.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return periodFor("day", id, tz);
  if ((m = id.match(/^(\d{4})-W(\d{2})$/))) {
    // ISO week 1 contains Jan 4th.
    const jan4 = new TZDate(Number(m[1]), 0, 4, tz);
    const monday = addDays(startOfISOWeek(jan4), (Number(m[2]) - 1) * 7);
    return periodFor("week", format(monday, "yyyy-MM-dd"), tz);
  }
  if ((m = id.match(/^(\d{4})-(\d{2})$/))) return periodFor("month", `${m[1]}-${m[2]}-01`, tz);
  if ((m = id.match(/^(\d{4})-Q([1-4])$/))) {
    const month = (Number(m[2]) - 1) * 3 + 1;
    return periodFor("quarter", `${m[1]}-${String(month).padStart(2, "0")}-01`, tz);
  }
  if ((m = id.match(/^(\d{4})$/))) return periodFor("year", `${m[1]}-01-01`, tz);
  return null;
}

/** "4:25" style duration from minutes. */
export function formatHoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}
