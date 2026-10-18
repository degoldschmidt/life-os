import { describe, expect, it } from "vitest";
import { parseCapture } from "@/lib/capture/parse";

// Sunday 2026-10-18, 10:00 Zurich
const now = new Date("2026-10-18T08:00:00Z");
const opts = { now, tz: "Europe/Zurich", areaCodes: ["WRK", "HLT", "REL", "FIN"] };

describe("parseCapture", () => {
  it("returns the plain title when nothing is recognised", () => {
    expect(parseCapture("write report", opts)).toEqual({
      title: "write report", areaCode: null, estimateMin: null, date: null, today: false, deadline: null,
    });
  });
  it("extracts area code and minutes", () => {
    const r = parseCapture("call mum #rel ~20m", opts);
    expect(r).toMatchObject({ title: "call mum", areaCode: "REL", estimateMin: 20 });
  });
  it("parses hour estimates in several shapes", () => {
    expect(parseCapture("draft figure ~2h", opts).estimateMin).toBe(120);
    expect(parseCapture("draft figure ~1.5h", opts).estimateMin).toBe(90);
    expect(parseCapture("draft figure ~1h30", opts).estimateMin).toBe(90);
    expect(parseCapture("draft figure ~45min", opts).estimateMin).toBe(45);
  });
  it("parses relative dates and removes the date words", () => {
    const r = parseCapture("call mum tomorrow", opts);
    expect(r).toMatchObject({ title: "call mum", date: "2026-10-19", today: false });
  });
  it("drops a dangling preposition before the date", () => {
    expect(parseCapture("pay rent on friday", opts)).toMatchObject({ title: "pay rent", date: "2026-10-23" });
  });
  it("treats today as planned for today", () => {
    expect(parseCapture("reply to Anna today", opts)).toMatchObject({ title: "reply to Anna", today: true, date: "2026-10-18" });
  });
  it("treats due/by as a deadline, not a schedule", () => {
    const r = parseCapture("submit paper due 30 nov #WRK", opts);
    expect(r).toMatchObject({ title: "submit paper", areaCode: "WRK", deadline: "2026-11-30", date: null, today: false });
  });
  it("keeps unknown #tags in the title", () => {
    expect(parseCapture("fix #bug in parser", opts)).toMatchObject({ title: "fix #bug in parser", areaCode: null });
  });
  it("falls back to the original text if everything was consumed", () => {
    expect(parseCapture("tomorrow", opts).title).toBe("tomorrow");
  });
  it("combines everything", () => {
    const r = parseCapture("zone 2 run tomorrow #HLT ~50m", opts);
    expect(r).toEqual({ title: "zone 2 run", areaCode: "HLT", estimateMin: 50, date: "2026-10-19", today: false, deadline: null });
  });
});
