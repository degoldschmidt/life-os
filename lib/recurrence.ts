import type { Recurrence } from "@/lib/db/schema";
import type { DayKey } from "@/lib/dates";

/** Day keys are plain calendar dates, so do the arithmetic in UTC to dodge DST entirely. */
function toUtc(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fromUtc(d: Date): DayKey {
  return d.toISOString().slice(0, 10);
}
/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(key: DayKey): number {
  const w = toUtc(key).getUTCDay();
  return w === 0 ? 7 : w;
}
function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}
export function addDays(key: DayKey, n: number): DayKey {
  const d = toUtc(key);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** Does the recurrence produce an instance on `day`, given the day it started (`anchor`)? */
export function occursOn(rec: Recurrence, anchor: DayKey, day: DayKey): boolean {
  if (day < anchor) return false;
  if (rec.until && day > rec.until) return false;
  const wd = isoWeekday(day);
  switch (rec.freq) {
    case "daily":
      return true;
    case "weekdays":
      return wd <= 5;
    case "weekly": {
      const days = rec.byDay?.length ? rec.byDay : [isoWeekday(anchor)];
      return days.includes(wd);
    }
    case "monthly": {
      const target = Number(anchor.slice(8, 10));
      const [y, m] = day.split("-").map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      // A task anchored on the 31st lands on the last day of shorter months.
      return Number(day.slice(8, 10)) === Math.min(target, lastDay);
    }
    case "interval": {
      const n = Math.max(1, rec.interval ?? 1);
      return daysBetween(anchor, day) % n === 0;
    }
  }
}

/** All days in [from, to] on which the recurrence produces an instance. */
export function occurrencesBetween(rec: Recurrence, anchor: DayKey, from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let d = from < anchor ? anchor : from; d <= to; d = addDays(d, 1)) {
    if (occursOn(rec, anchor, d)) out.push(d);
  }
  return out;
}
