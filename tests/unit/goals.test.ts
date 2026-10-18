import { describe, expect, it } from "vitest";
import { dotsFor, goalProgress, krProgress, parseKeyResults, staleness } from "@/lib/goals";

const kr = (current: number, target: number) => ({ current, target });

describe("progress", () => {
  it("clamps to 0..1", () => {
    expect(krProgress(kr(5, 10))).toBe(0.5);
    expect(krProgress(kr(15, 10))).toBe(1);
    expect(krProgress(kr(-3, 10))).toBe(0);
  });
  it("handles a zero target and non-finite values", () => {
    expect(krProgress(kr(0, 0))).toBe(1);
    expect(krProgress(kr(2, 0))).toBe(0);
    expect(krProgress(kr(NaN, 10))).toBe(0);
  });
  it("averages key results and returns null with none", () => {
    expect(goalProgress([kr(5, 10), kr(10, 10)])).toBe(0.75);
    expect(goalProgress([])).toBeNull();
  });
  it("maps progress to dots", () => {
    expect(dotsFor(0.5)).toBe(11);
    expect(dotsFor(null)).toBe(0);
    expect(dotsFor(1)).toBe(21);
  });
});

describe("parseKeyResults", () => {
  it("parses metric | target | unit lines and ignores junk", () => {
    const r = parseKeyResults("Submit manuscripts | 1 | papers\n\nnot a kr\nRun 10 km under 50 min | 3\nThree | x");
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ metric: "Submit manuscripts", target: 1, unit: "papers", current: 0 });
    expect(r[1]).toMatchObject({ metric: "Run 10 km under 50 min", target: 3, unit: undefined });
  });
  it("accepts decimal commas and caps at three", () => {
    const r = parseKeyResults("a | 1,5\nb | 2\nc | 3\nd | 4");
    expect(r).toHaveLength(3);
    expect(r[0].target).toBe(1.5);
  });
});

describe("staleness", () => {
  it("grades by days since last activity", () => {
    expect(staleness(2)).toBe("fresh");
    expect(staleness(7)).toBe("idle");
    expect(staleness(14)).toBe("stale");
    expect(staleness(null)).toBe("stale");
  });
});
