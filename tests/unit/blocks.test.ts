import { describe, expect, it } from "vitest";
import { clampStart, formatClock, instantToMinutes, layoutOverlaps, minutesToInstant, snap } from "@/lib/blocks";

const tz = "Europe/Zurich";

describe("time conversion", () => {
  it("round-trips local wall-clock time", () => {
    const i = minutesToInstant("2026-10-18", 9 * 60 + 30, tz);
    expect(instantToMinutes(i, tz)).toBe(570);
    // 09:30 CEST (UTC+2) is 07:30Z
    expect(i.toISOString()).toBe("2026-10-18T07:30:00.000Z");
  });
  it("keeps wall time across the DST change", () => {
    // 2026-10-25: clocks go back, CEST -> CET
    expect(minutesToInstant("2026-10-25", 10 * 60, tz).toISOString()).toBe("2026-10-25T09:00:00.000Z");
    expect(instantToMinutes(minutesToInstant("2026-10-25", 10 * 60, tz), tz)).toBe(600);
  });
  it("formats clock times", () => {
    expect(formatClock(9 * 60 + 5)).toBe("09:05");
  });
});

describe("snap and clamp", () => {
  it("snaps to 15 minutes", () => {
    expect(snap(7 * 60 + 8)).toBe(7 * 60 + 15);
    expect(snap(7 * 60 + 7)).toBe(7 * 60);
  });
  it("keeps a block inside the grid", () => {
    expect(clampStart(5 * 60, 60)).toBe(6 * 60);
    expect(clampStart(21 * 60 + 30, 120)).toBe(20 * 60);
  });
});

describe("layoutOverlaps", () => {
  const b = (id: string, s: number, e: number) => ({ id, startMin: s, endMin: e });
  it("gives non-overlapping blocks a full column", () => {
    const r = layoutOverlaps([b("a", 540, 600), b("b", 600, 660)]);
    expect(r.every((x) => x.cols === 1 && x.col === 0)).toBe(true);
  });
  it("places overlapping blocks side by side", () => {
    const r = layoutOverlaps([b("a", 540, 660), b("b", 600, 720)]);
    expect(r.find((x) => x.id === "a")).toMatchObject({ col: 0, cols: 2 });
    expect(r.find((x) => x.id === "b")).toMatchObject({ col: 1, cols: 2 });
  });
  it("reuses a freed column inside a cluster", () => {
    const r = layoutOverlaps([b("a", 540, 600), b("b", 540, 720), b("c", 600, 660)]);
    // The long block "b" takes column 0; "c" reuses the column "a" freed at 600.
    expect(r.find((x) => x.id === "b")).toMatchObject({ col: 0, cols: 2 });
    expect(r.find((x) => x.id === "c")).toMatchObject({ col: 1, cols: 2 });
  });
  it("separates independent clusters", () => {
    const r = layoutOverlaps([b("a", 540, 600), b("b", 570, 630), b("c", 700, 760)]);
    expect(r.find((x) => x.id === "c")).toMatchObject({ col: 0, cols: 1 });
  });
});
