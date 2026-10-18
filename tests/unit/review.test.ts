import { describe, expect, it } from "vitest";
import { cleanTop, extractScores, neglectedAreas, plannedVsDone } from "@/lib/review";
import { habitPeriodStats } from "@/lib/habits";

describe("plannedVsDone", () => {
  it("is done over planned, null when nothing planned", () => {
    expect(plannedVsDone({ planned: 31, done: 23 })).toBeCloseTo(0.742, 3);
    expect(plannedVsDone({ planned: 0, done: 0 })).toBeNull();
  });
});

describe("neglectedAreas", () => {
  it("lists areas under half their target, worst first, ignoring no-target areas", () => {
    const r = neglectedAreas([
      { code: "WRK", targetMin: 1920, scheduledMin: 1890, doneTasks: 20 },
      { code: "REL", targetMin: 240, scheduledMin: 90, doneTasks: 1 },
      { code: "FIN", targetMin: 90, scheduledMin: 60, doneTasks: 2 },
      { code: "HLT", targetMin: 360, scheduledMin: 60, doneTasks: 1 },
      { code: "GRW", targetMin: 0, scheduledMin: 0, doneTasks: 0 },
    ]);
    expect(r.map((a) => a.code)).toEqual(["HLT", "REL"]);
  });
});

describe("extractScores", () => {
  const base = { tasks: { planned: 10, done: 7, plannedMin: 600, doneMin: 420 }, deepMin: 300, habitRate: 0.8, mood: 3.666, energy: null, areas: [{ code: "WRK", targetMin: 100, scheduledMin: 90, doneTasks: 4 }], answers: {} };
  it("flattens numbers and skips missing ones", () => {
    const s = extractScores(base);
    expect(s).toMatchObject({ planned_vs_done: 0.7, habit_rate: 0.8, mood: 3.67, deep_min: 300, "area_min:WRK": 90, "area_done:WRK": 4 });
    expect("energy" in s).toBe(false);
  });
  it("includes valid area scores and ignores out-of-range ones", () => {
    const s = extractScores({ ...base, answers: { area_scores: { WRK: 8, HLT: 11, REL: "x" }, satisfaction: 7 } });
    expect(s["area_score:WRK"]).toBe(8);
    expect("area_score:HLT" in s).toBe(false);
    expect(s.satisfaction).toBe(7);
  });
  it("omits planned_vs_done when nothing was planned", () => {
    expect("planned_vs_done" in extractScores({ ...base, tasks: { planned: 0, done: 0, plannedMin: 0, doneMin: 0 } })).toBe(false);
  });
});

describe("cleanTop", () => {
  it("trims, drops blanks and non-strings, caps at three", () => {
    expect(cleanTop([" a ", "", 3, "b", "c", "d"])).toEqual(["a", "b", "c"]);
    expect(cleanTop("nope")).toEqual([]);
  });
});

describe("habitPeriodStats", () => {
  it("counts only scheduled days for fixed-day habits", () => {
    const done = new Set(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-17"]); // Mon Tue Wed Sat
    const r = habitPeriodStats({ days: [1, 2, 3, 4, 5] }, done, "2026-10-12", "2026-10-18");
    expect(r).toMatchObject({ due: 5, done: 3 });
    expect(r.rate).toBeCloseTo(0.6);
  });
  it("scales weekly-count habits to the period length and caps at the target", () => {
    const week = habitPeriodStats({ perWeek: 3 }, new Set(["2026-10-12", "2026-10-14", "2026-10-15", "2026-10-16"]), "2026-10-12", "2026-10-18");
    expect(week).toMatchObject({ due: 3, done: 3, rate: 1 });
    const month = habitPeriodStats({ perWeek: 2 }, new Set(), "2026-10-01", "2026-10-31");
    expect(month.due).toBe(9); // 31 days ≈ 4.43 weeks × 2
  });
});
