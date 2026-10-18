import { describe, expect, it } from "vitest";
import { dueReminders, minutesOf, type ReminderFacts, type ReminderSettings, type ReminderState } from "@/lib/reminders";

const settings: ReminderSettings = { tz: "Europe/Zurich", dayStartHour: 4, planTime: "08:30", shutdownTime: "18:00", pushPlan: true, pushShutdown: true, pushWeekly: true };
const fresh: ReminderState = { lastPlanPush: null, lastShutdownPush: null, lastReviewPush: null };
const open: ReminderFacts = { intentionSet: false, shutdownDone: false, weeklyReviewDone: false };
// Zurich is UTC+2 on 2026-10-19 (Monday) and 2026-10-23 (Friday)
const at = (iso: string) => new Date(iso);

describe("minutesOf", () => {
  it("parses HH:MM", () => expect(minutesOf("18:30")).toBe(1110));
});

describe("dueReminders", () => {
  it("fires the plan reminder inside its window only", () => {
    expect(dueReminders(at("2026-10-19T06:35:00Z"), settings, fresh, open)).toEqual(["plan"]); // 08:35 local
    expect(dueReminders(at("2026-10-19T06:00:00Z"), settings, fresh, open)).toEqual([]); // 08:00, too early
    expect(dueReminders(at("2026-10-19T09:00:00Z"), settings, fresh, open)).toEqual([]); // 11:00, window over
  });
  it("fires the shutdown reminder at shutdown time", () => {
    expect(dueReminders(at("2026-10-19T16:05:00Z"), settings, fresh, open)).toEqual(["shutdown"]); // 18:05
  });
  it("does not repeat a reminder already sent today", () => {
    const sent = { ...fresh, lastShutdownPush: "2026-10-19" };
    expect(dueReminders(at("2026-10-19T16:05:00Z"), settings, sent, open)).toEqual([]);
  });
  it("skips things that are already done", () => {
    expect(dueReminders(at("2026-10-19T06:35:00Z"), settings, fresh, { ...open, intentionSet: true })).toEqual([]);
    expect(dueReminders(at("2026-10-19T16:05:00Z"), settings, fresh, { ...open, shutdownDone: true })).toEqual([]);
  });
  it("respects the per-reminder switches", () => {
    expect(dueReminders(at("2026-10-19T16:05:00Z"), { ...settings, pushShutdown: false }, fresh, open)).toEqual([]);
  });
  it("sends the weekly nudge only on Fridays, after the shutdown one, once a week", () => {
    expect(dueReminders(at("2026-10-23T16:35:00Z"), settings, fresh, open)).toEqual(["shutdown", "weekly"]); // Fri 18:35: both inside their windows
    expect(dueReminders(at("2026-10-23T16:10:00Z"), settings, fresh, open)).toEqual(["shutdown"]); // 18:10, weekly not yet
    expect(dueReminders(at("2026-10-19T16:35:00Z"), settings, fresh, open)).toEqual(["shutdown"]); // Monday: no weekly
    expect(dueReminders(at("2026-10-23T16:35:00Z"), settings, { ...fresh, lastReviewPush: "2026-W43" }, open)).toEqual(["shutdown"]);
    expect(dueReminders(at("2026-10-23T16:35:00Z"), settings, fresh, { ...open, weeklyReviewDone: true })).toEqual(["shutdown"]);
  });
  it("treats 01:30 as the previous day until the day-start hour", () => {
    // Fri 2026-10-23 23:50Z = Sat 01:50 local -> logical Friday; shutdown window long over, nothing fires
    expect(dueReminders(at("2026-10-23T23:50:00Z"), settings, fresh, open)).toEqual([]);
  });
});
