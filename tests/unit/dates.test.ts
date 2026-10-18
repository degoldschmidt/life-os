import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  formatHoursMinutes,
  logicalDayKey,
  parsePeriodId,
  periodFor,
} from "@/lib/dates";

const tz = "Europe/Zurich";

describe("logicalDayKey", () => {
  it("uses the local calendar day during the day", () => {
    // 2026-10-18 14:00 CEST = 12:00Z
    expect(logicalDayKey(new Date("2026-10-18T12:00:00Z"), tz, 4)).toBe("2026-10-18");
  });
  it("counts 01:00 local as the previous day with dayStartHour 4", () => {
    // 2026-10-19 01:00 CEST = 2026-10-18 23:00Z
    expect(logicalDayKey(new Date("2026-10-18T23:00:00Z"), tz, 4)).toBe("2026-10-18");
  });
  it("respects dayStartHour 0", () => {
    expect(logicalDayKey(new Date("2026-10-18T23:00:00Z"), tz, 0)).toBe("2026-10-19");
  });
  it("handles the DST fall-back night (2026-10-25)", () => {
    // 02:30 CET (after fall back) = 01:30Z; still before 04:00 => Oct 24
    expect(logicalDayKey(new Date("2026-10-25T01:30:00Z"), tz, 4)).toBe("2026-10-24");
    // 05:00 CET = 04:00Z => Oct 25
    expect(logicalDayKey(new Date("2026-10-25T04:00:00Z"), tz, 4)).toBe("2026-10-25");
  });
});

describe("periodFor", () => {
  it("builds ISO week periods", () => {
    const p = periodFor("week", "2026-10-18", tz);
    expect(p).toEqual({ type: "week", id: "2026-W42", start: "2026-10-12", end: "2026-10-18" });
  });
  it("builds month, quarter and year periods", () => {
    expect(periodFor("month", "2026-02-10", tz)).toMatchObject({ id: "2026-02", start: "2026-02-01", end: "2026-02-28" });
    expect(periodFor("quarter", "2026-10-18", tz)).toMatchObject({ id: "2026-Q4", start: "2026-10-01", end: "2026-12-31" });
    expect(periodFor("year", "2026-10-18", tz)).toMatchObject({ id: "2026", start: "2026-01-01", end: "2026-12-31" });
  });
  it("assigns Jan 1 2027 to ISO week 2026-W53", () => {
    expect(periodFor("week", "2027-01-01", tz).id).toBe("2026-W53");
  });
});

describe("parsePeriodId", () => {
  it("round-trips every period type", () => {
    for (const id of ["2026-10-18", "2026-W42", "2026-10", "2026-Q4", "2026"]) {
      expect(parsePeriodId(id, tz)?.id).toBe(id);
    }
  });
  it("rejects garbage", () => {
    expect(parsePeriodId("week-42", tz)).toBeNull();
  });
});

describe("helpers", () => {
  it("adds days across month ends", () => {
    expect(addDaysToKey("2026-10-31", 1, tz)).toBe("2026-11-01");
  });
  it("formats hours and minutes", () => {
    expect(formatHoursMinutes(265)).toBe("4:25");
    expect(formatHoursMinutes(5)).toBe("0:05");
  });
});
