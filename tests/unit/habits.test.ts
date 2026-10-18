import { describe, expect, it } from "vitest";
import { habitStatus } from "@/lib/habits";

// 2026-10-18 is a Sunday
const today = "2026-10-18";
const every = { days: [1, 2, 3, 4, 5, 6, 7] };

describe("habitStatus (fixed days)", () => {
  it("covers 14 days ending today", () => {
    const s = habitStatus(every, new Set(), today);
    expect(s.grid).toHaveLength(14);
    expect(s.grid[0].day).toBe("2026-10-05");
    expect(s.grid[13]).toMatchObject({ day: today, today: true });
  });
  it("is due only on scheduled weekdays", () => {
    const weekdays = { days: [1, 2, 3, 4, 5] };
    expect(habitStatus(weekdays, new Set(), today).dueToday).toBe(false); // Sunday
    expect(habitStatus(weekdays, new Set(), "2026-10-19").dueToday).toBe(true); // Monday
  });
  it("computes the rate over due days", () => {
    const done = new Set(["2026-10-17", "2026-10-16", "2026-10-15", "2026-10-14", "2026-10-13", "2026-10-12", "2026-10-11"]);
    const s = habitStatus(every, done, today);
    expect(s).toMatchObject({ doneInWindow: 7, dueInWindow: 14, rate: 0.5, doneToday: false });
  });
  it("nudges when the last due day was missed", () => {
    expect(habitStatus(every, new Set(["2026-10-16"]), today).missedLastDue).toBe(true);
    expect(habitStatus(every, new Set(["2026-10-17"]), today).missedLastDue).toBe(false);
  });
  it("skips non-due days when looking for the last miss", () => {
    const weekdays = { days: [1, 2, 3, 4, 5] };
    // Last due day before Mon 19th is Fri 16th; done => no nudge even though Sat/Sun are empty.
    expect(habitStatus(weekdays, new Set(["2026-10-16"]), "2026-10-19").missedLastDue).toBe(false);
    expect(habitStatus(weekdays, new Set(), "2026-10-19").missedLastDue).toBe(true);
  });
  it("returns null rate when nothing was due", () => {
    expect(habitStatus({ days: [] }, new Set(), today).rate).toBeNull();
  });
});

describe("habitStatus (weekly count)", () => {
  it("stays due until the weekly target is met", () => {
    const sched = { perWeek: 3 };
    // Week of Mon 12 – Sun 18 Oct; two done so far.
    expect(habitStatus(sched, new Set(["2026-10-12", "2026-10-14"]), today).dueToday).toBe(true);
    expect(habitStatus(sched, new Set(["2026-10-12", "2026-10-14", "2026-10-16"]), today).dueToday).toBe(false);
  });
  it("measures the rate against n per week", () => {
    const s = habitStatus({ perWeek: 3 }, new Set(["2026-10-06", "2026-10-08", "2026-10-12", "2026-10-14", "2026-10-16"]), today);
    expect(s).toMatchObject({ doneInWindow: 5, dueInWindow: 6 });
    expect(s.rate).toBeCloseTo(5 / 6);
  });
  it("never nudges for weekly-count habits", () => {
    expect(habitStatus({ perWeek: 2 }, new Set(), today).missedLastDue).toBe(false);
  });
});
