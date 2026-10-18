import { describe, expect, it } from "vitest";
import { dedupeTitles, krFromLines, rhythmToSchedule, SelectionSchema } from "@/lib/setup-apply";

describe("dedupeTitles", () => {
  it("skips titles already present and repeats within the list, ignoring case", () => {
    const r = dedupeTitles([{ t: "Call Mum" }, { t: "call mum" }, { t: "Book dentist" }, { t: "  " }, { t: "Pay rent" }], (x) => x.t, new Set(["pay rent"]));
    expect(r.keep.map((x) => x.t)).toEqual(["Call Mum", "Book dentist"]);
    expect(r.skipped).toBe(3);
  });
});

describe("krFromLines / rhythmToSchedule", () => {
  it("parses key-result lines", () => {
    expect(krFromLines(["Figures | 4 | figures", "junk"])).toMatchObject([{ metric: "Figures", target: 4, unit: "figures", current: 0 }]);
  });
  it("maps rhythms to schedules", () => {
    expect(rhythmToSchedule("daily")).toEqual({ days: [1, 2, 3, 4, 5, 6, 7] });
    expect(rhythmToSchedule("weekdays")).toEqual({ days: [1, 2, 3, 4, 5] });
    expect(rhythmToSchedule("weekly")).toEqual({ perWeek: 1 });
  });
});

describe("SelectionSchema", () => {
  it("accepts a normal selection and rejects bad dates and blank titles", () => {
    const ok = { tasks: [{ title: "x", area: "WRK", estimateMin: 30, due: "2026-11-30", project: null }], projects: [], goals: [], habits: [] };
    expect(SelectionSchema.safeParse(ok).success).toBe(true);
    expect(SelectionSchema.safeParse({ ...ok, tasks: [{ ...ok.tasks[0], due: "30 nov" }] }).success).toBe(false);
    expect(SelectionSchema.safeParse({ ...ok, tasks: [{ ...ok.tasks[0], title: "  " }] }).success).toBe(false);
  });
});
