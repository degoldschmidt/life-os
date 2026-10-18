import { describe, expect, it } from "vitest";
import { costUsd, isModelId } from "@/lib/ai/models";
import { cleanDraft, cleanDump, reviewPrompt, topPrompt, validatePicks, type Candidate } from "@/lib/ai/prompts";
import type { PeriodStats } from "@/lib/services/stats";

describe("costUsd", () => {
  it("prices tokens per model", () => {
    expect(costUsd("claude-sonnet-5-5", 15_000, 1_500)).toBeCloseTo(0.045, 6); // 15k in at $2, 1.5k out at $10
    expect(costUsd("claude-fable-5-1", 1_000_000, 1_000_000)).toBe(60);
  });
  it("falls back to the default model's price for unknown ids", () => {
    expect(costUsd("mystery", 1_000_000, 0)).toBe(2);
    expect(isModelId("claude-opus-5-5")).toBe(true);
    expect(isModelId("gpt")).toBe(false);
  });
});

const stats = {
  period: { id: "2026-W42", type: "week", start: "2026-10-12", end: "2026-10-18" }, days: 7,
  tasks: { planned: 8, done: 6, plannedMin: 480, doneMin: 360, rate: 0.75 }, perDay: [], deepMin: 1440, scheduledMin: 1590,
  areas: [{ code: "WRK", name: "Work", targetMin: 1920, scheduledMin: 1440, doneTasks: 4 }],
  habits: [{ name: "Stretch", done: 5, due: 7 }], habitRate: 5 / 7, mood: 3, energy: null, dayReviews: 0, inbox: 2,
  projectsNoNext: [{ id: "p", title: "Grant renewal", areaCode: "WRK" }], goals: [{ id: "g", title: "Submit paper", areaCode: "WRK", progress: 0.25, confidence: 7 }],
} as unknown as PeriodStats;

describe("reviewPrompt", () => {
  it("contains the facts, the journal and every question id", () => {
    const p = reviewPrompt({ stats, journal: ["Walk helped."], questions: [{ id: "wins", prompt: "What went well?" }, { id: "joy", prompt: "What brought joy?" }] });
    expect(p).toContain("6 done of 8 planned (75%)");
    expect(p).toContain("Stretch 5/7");
    expect(p).toContain("Grant renewal");
    expect(p).toContain("- wins: What went well?");
    expect(p).toContain("Walk helped.");
  });
  it("says when there is no journal", () => {
    expect(reviewPrompt({ stats, journal: [], questions: [] })).toContain("(no journal entries)");
  });
});

describe("cleanDraft", () => {
  it("keeps known ids only, once, trimmed, non-empty", () => {
    const r = cleanDraft({ answers: [{ id: "wins", text: "  Good week. " }, { id: "wins", text: "dup" }, { id: "x", text: "unknown" }, { id: "joy", text: "   " }] }, ["wins", "joy"]);
    expect(r).toEqual({ wins: "Good week." });
  });
});

describe("validatePicks", () => {
  it("drops unknown ids and duplicates and caps at three", () => {
    const r = validatePicks([{ id: "a", reason: "r" }, { id: "zzz", reason: "bad" }, { id: "a", reason: "dup" }, { id: "b", reason: "r" }, { id: "c", reason: "r" }, { id: "d", reason: "r" }], ["a", "b", "c", "d"]);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("topPrompt", () => {
  it("lists candidates with their ids", () => {
    const c: Candidate = { id: "t1", title: "Draft figure", areaCode: "WRK", estimateMin: 120, deadline: "2026-10-30", project: "Paper" };
    const p = topPrompt({ day: "2026-10-19", capacityMin: 360, candidates: [c], goals: ["Submit paper"], busyMin: 90 });
    expect(p).toContain("t1 | Draft figure [WRK] ~120m due 2026-10-30 (project: Paper)");
    expect(p).toContain("Already booked in the calendar: 1.5 h");
  });
});

describe("cleanDump", () => {
  it("normalises areas, dates and estimates and drops blanks", () => {
    const r = cleanDump({
      tasks: [{ title: " Call Mum ", area: "rel", estimateMin: 20, due: "2026-10-20", project: null }, { title: "  ", area: null, estimateMin: null, due: null, project: null }, { title: "x", area: "ZZZ", estimateMin: 99999, due: "next friday", project: " P " }],
      projects: [{ title: "Move flat", area: "FIN" }], goals: [{ title: "Run 10 km", area: "HLT", horizon: "quarter", keyResults: ["Time | 50 | min", " ", "a", "b", "c"] }], habits: [{ name: " Stretch ", area: null, rhythm: "daily" }],
    }, ["WRK", "HLT", "REL", "FIN"]);
    expect(r.tasks).toHaveLength(2);
    expect(r.tasks[0]).toMatchObject({ title: "Call Mum", area: "REL", estimateMin: 20, due: "2026-10-20" });
    expect(r.tasks[1]).toMatchObject({ area: null, estimateMin: null, due: null, project: "P" });
    expect(r.goals[0].keyResults).toEqual(["Time | 50 | min", "a", "b"]);
    expect(r.habits[0].name).toBe("Stretch");
  });
});
