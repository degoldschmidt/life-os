import { describe, expect, it } from "vitest";
import { areasNote, dayNote, reviewNote, slug } from "@/lib/export-md";

describe("dayNote", () => {
  it("renders frontmatter, done tasks and entries", () => {
    const md = dayNote("2026-10-18", [
      { kind: "morning", time: "07:40", text: "Finish the figure.", mood: null, energy: null },
      { kind: "shutdown", time: "18:05", text: "Went well: done.", mood: 4, energy: 3 },
    ], ["Draft figure 2"]);
    expect(md).toContain("date: 2026-10-18");
    expect(md).toContain("mood: 4");
    expect(md).toContain("- [x] Draft figure 2");
    expect(md).toContain("## Intention 07:40");
    expect(md).toContain("## Shutdown 18:05");
    expect(md.endsWith("\n")).toBe(true);
  });
  it("omits mood and energy when absent", () => {
    const md = dayNote("2026-10-18", [{ kind: "interstitial", time: "10:00", text: "hi", mood: null, energy: null }], []);
    expect(md).not.toContain("mood:");
  });
});

describe("reviewNote", () => {
  it("writes numbers, answered questions and the next list; skips empty answers", () => {
    const md = reviewNote({
      type: "week", periodId: "2026-W42", start: "2026-10-12", end: "2026-10-18", status: "final",
      questions: [{ id: "wins", prompt: "What went well?" }, { id: "joy", prompt: "What brought joy?" }],
      answers: { wins: "Mornings held.", joy: "" },
      nextTop3: ["Finish figure 3", "Call Mum"],
      scores: { planned_vs_done: 0.75, deep_min: 1440 },
    });
    expect(md).toContain("# Week review 2026-W42");
    expect(md).toContain("- deep_min: 1440");
    expect(md).toContain("## What went well?");
    expect(md).not.toContain("What brought joy?");
    expect(md).toContain("1. Finish figure 3");
  });
});

describe("slug and areas", () => {
  it("makes safe file names", () => {
    expect(slug("Zürich Trip: 20 Dec!")).toBe("zurich-trip-20-dec");
    expect(slug("???")).toBe("untitled");
  });
  it("renders area standards", () => {
    expect(areasNote([{ code: "WRK", name: "Work", standard: "Ship.", weeklyTargetHours: 28, satisfaction: 8 }])).toContain("## WRK · Work");
  });
});
