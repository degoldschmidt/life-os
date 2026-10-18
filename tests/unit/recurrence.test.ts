import { describe, expect, it } from "vitest";
import { occurrencesBetween, occursOn, isoWeekday, addDays } from "@/lib/recurrence";

describe("recurrence", () => {
  it("computes ISO weekdays", () => {
    expect(isoWeekday("2026-10-18")).toBe(7); // Sunday
    expect(isoWeekday("2026-10-19")).toBe(1); // Monday
  });
  it("adds days across month and DST boundaries", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("daily and weekdays", () => {
    expect(occurrencesBetween({ freq: "daily" }, "2026-10-16", "2026-10-16", "2026-10-18")).toHaveLength(3);
    expect(occurrencesBetween({ freq: "weekdays" }, "2026-10-12", "2026-10-12", "2026-10-18")).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16",
    ]);
  });
  it("weekly defaults to the anchor weekday and honours byDay", () => {
    expect(occurrencesBetween({ freq: "weekly" }, "2026-10-12", "2026-10-12", "2026-10-31")).toEqual([
      "2026-10-12", "2026-10-19", "2026-10-26",
    ]);
    expect(occurrencesBetween({ freq: "weekly", byDay: [2, 4] }, "2026-10-12", "2026-10-12", "2026-10-18")).toEqual([
      "2026-10-13", "2026-10-15",
    ]);
  });
  it("monthly clamps to the last day of short months", () => {
    expect(occursOn({ freq: "monthly" }, "2026-01-31", "2026-02-28")).toBe(true);
    expect(occursOn({ freq: "monthly" }, "2026-01-31", "2026-02-27")).toBe(false);
    expect(occursOn({ freq: "monthly" }, "2026-01-31", "2026-04-30")).toBe(true);
  });
  it("interval and until", () => {
    expect(occurrencesBetween({ freq: "interval", interval: 3, until: "2026-10-25" }, "2026-10-12", "2026-10-12", "2026-11-30")).toEqual([
      "2026-10-12", "2026-10-15", "2026-10-18", "2026-10-21", "2026-10-24",
    ]);
  });
  it("never produces days before the anchor", () => {
    expect(occursOn({ freq: "daily" }, "2026-10-18", "2026-10-17")).toBe(false);
  });
});
