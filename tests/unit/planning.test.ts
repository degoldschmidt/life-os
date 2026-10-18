import { describe, expect, it } from "vitest";
import { nextFreeRank, splitTop, summarizeDay, type PlanTask } from "@/lib/planning";

const t = (id: string, o: Partial<PlanTask> = {}): PlanTask => ({ id, status: "todo", planRank: null, estimateMin: null, ...o });

describe("summarizeDay", () => {
  it("sums estimates, ignores dropped, counts unestimated", () => {
    const s = summarizeDay(
      [t("a", { estimateMin: 120 }), t("b", { estimateMin: 30 }), t("c"), t("d", { status: "done", estimateMin: 45 }), t("e", { status: "dropped", estimateMin: 999 })],
      360,
    );
    expect(s).toMatchObject({ open: 3, done: 1, total: 4, plannedMin: 150, doneMin: 45, unestimated: 1, over: false });
  });
  it("flags over-commitment including finished work", () => {
    expect(summarizeDay([t("a", { estimateMin: 300 }), t("b", { status: "done", estimateMin: 100 })], 360).over).toBe(true);
  });
});

describe("top three", () => {
  it("splits ranked tasks first", () => {
    const { top, rest } = splitTop([t("x"), t("b", { planRank: 2 }), t("a", { planRank: 1 })]);
    expect(top.map((x) => x.id)).toEqual(["a", "b"]);
    expect(rest.map((x) => x.id)).toEqual(["x"]);
  });
  it("finds the next free rank and returns null when full", () => {
    expect(nextFreeRank([t("a", { planRank: 1 }), t("b", { planRank: 3 })])).toBe(2);
    expect(nextFreeRank([t("a", { planRank: 1 }), t("b", { planRank: 2 }), t("c", { planRank: 3 })])).toBeNull();
  });
  it("frees a rank when its task is done", () => {
    expect(nextFreeRank([t("a", { planRank: 1, status: "done" })])).toBe(1);
  });
});
