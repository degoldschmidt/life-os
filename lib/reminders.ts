import { TZDate } from "@date-fns/tz";
import { logicalDayKey, periodFor, type DayKey } from "@/lib/dates";
import { isoWeekday } from "@/lib/recurrence";

export type ReminderKind = "plan" | "shutdown" | "weekly";

export type ReminderSettings = {
  tz: string;
  dayStartHour: number;
  planTime: string; // HH:MM
  shutdownTime: string; // HH:MM
  pushPlan: boolean;
  pushShutdown: boolean;
  pushWeekly: boolean;
};

/** What was last sent, so each reminder fires at most once per day (or week). */
export type ReminderState = { lastPlanPush: DayKey | null; lastShutdownPush: DayKey | null; lastReviewPush: string | null };

/** What is already done, so we don't nag about finished things. */
export type ReminderFacts = { intentionSet: boolean; shutdownDone: boolean; weeklyReviewDone: boolean };

/** How long after its time a reminder may still fire. Covers a late or missed scheduler run without spamming at midnight. */
export const WINDOW_MIN = 90;
/** The weekly-review nudge comes after the shutdown one, so the two never arrive together. */
export const WEEKLY_OFFSET_MIN = 30;

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function localMinutes(now: Date, tz: string): number {
  const z = new TZDate(now, tz);
  return z.getHours() * 60 + z.getMinutes();
}

const inWindow = (nowMin: number, at: number) => nowMin >= at && nowMin < at + WINDOW_MIN;

/** Which reminders are due right now. Pure: all the state it needs is passed in. */
export function dueReminders(now: Date, s: ReminderSettings, st: ReminderState, f: ReminderFacts): ReminderKind[] {
  const day = logicalDayKey(now, s.tz, s.dayStartHour);
  const nowMin = localMinutes(now, s.tz);
  const out: ReminderKind[] = [];

  if (s.pushPlan && !f.intentionSet && st.lastPlanPush !== day && inWindow(nowMin, minutesOf(s.planTime))) out.push("plan");
  if (s.pushShutdown && !f.shutdownDone && st.lastShutdownPush !== day && inWindow(nowMin, minutesOf(s.shutdownTime))) out.push("shutdown");

  // Fridays only (ISO weekday 5), once per ISO week.
  const week = periodFor("week", day, s.tz).id;
  if (s.pushWeekly && isoWeekday(day) === 5 && !f.weeklyReviewDone && st.lastReviewPush !== week && inWindow(nowMin, minutesOf(s.shutdownTime) + WEEKLY_OFFSET_MIN)) out.push("weekly");

  return out;
}

export const MESSAGES: Record<ReminderKind, { title: string; body: string; url: string }> = {
  plan: { title: "Plan your day", body: "Pick your Top 3 and set an intention.", url: "/plan" },
  shutdown: { title: "Time to shut down", body: "Sweep what's left, tick habits, set tomorrow.", url: "/shutdown" },
  weekly: { title: "Weekly review", body: "Twenty-five minutes now keeps next week honest.", url: "/review" },
};
