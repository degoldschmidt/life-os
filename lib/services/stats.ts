import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { DayKey, Period } from "@/lib/dates";
import { addDays } from "@/lib/recurrence";
import { habitPeriodStats } from "@/lib/habits";
import { goalProgress } from "@/lib/goals";
import { plannedVsDone, type AreaStat } from "@/lib/review";
import { areaOverview } from "@/lib/services/goals";
import { countInbox } from "@/lib/services/tasks";

const { tasks, timeBlocks, habits, habitLogs, journalEntries, reviews, areas } = schema;

export type PeriodStats = {
  period: Pick<Period, "id" | "type" | "start" | "end">;
  days: number;
  tasks: { planned: number; done: number; plannedMin: number; doneMin: number; rate: number | null };
  perDay: { day: DayKey; done: number; scheduledMin: number }[];
  areas: (AreaStat & { name: string })[];
  deepMin: number;
  scheduledMin: number;
  habits: { name: string; done: number; due: number }[];
  habitRate: number | null;
  mood: number | null;
  energy: number | null;
  dayReviews: number;
  inbox: number;
  projectsNoNext: { id: string; title: string; areaCode: string }[];
  goals: { id: string; title: string; areaCode: string; progress: number | null; confidence: number | null }[];
};

function listDays(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Everything a review needs to look back: counts, hours, habits, mood, goals, loose ends. */
export async function computePeriodStats(userId: string, period: Period, tz: string, goalPeriods: string[]): Promise<PeriodStats> {
  const days = listDays(period.start, period.end);

  const [taskRows, blockRows, habitRows, logRows, moodRows, dayReviewCount, inbox, areaRows, overview] = await Promise.all([
    db()
      .select({ status: tasks.status, estimateMin: tasks.estimateMin, areaId: tasks.areaId, doneAt: tasks.doneAt, plannedForDate: tasks.plannedForDate, scheduledDate: tasks.scheduledDate })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          or(isNull(tasks.recurrence), sql`${tasks.seriesId} is not null`),
          or(
            and(gte(tasks.plannedForDate, period.start), lte(tasks.plannedForDate, period.end)),
            and(eq(tasks.when, "scheduled"), gte(tasks.scheduledDate, period.start), lte(tasks.scheduledDate, period.end)),
          ),
        ),
      ),
    db()
      .select({ date: timeBlocks.date, kind: timeBlocks.kind, areaId: timeBlocks.areaId, startAt: timeBlocks.startAt, endAt: timeBlocks.endAt })
      .from(timeBlocks)
      .where(and(eq(timeBlocks.userId, userId), gte(timeBlocks.date, period.start), lte(timeBlocks.date, period.end))),
    db().select().from(habits).where(and(eq(habits.userId, userId), isNull(habits.archivedAt))),
    db()
      .select({ habitId: habitLogs.habitId, date: habitLogs.date })
      .from(habitLogs)
      .where(and(eq(habitLogs.userId, userId), gte(habitLogs.date, period.start), lte(habitLogs.date, period.end))),
    db()
      .select({ mood: journalEntries.mood, energy: journalEntries.energy })
      .from(journalEntries)
      .where(and(eq(journalEntries.userId, userId), gte(journalEntries.date, period.start), lte(journalEntries.date, period.end))),
    db()
      .select({ n: sql<number>`count(*)::int` })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.type, "day"), eq(reviews.status, "final"), gte(reviews.periodStart, period.start), lte(reviews.periodStart, period.end))),
    countInbox(userId),
    db().select().from(areas).where(and(eq(areas.userId, userId), isNull(areas.archivedAt))).orderBy(areas.sort),
    areaOverview(userId, goalPeriods, period.start, period.end),
  ]);

  // Tasks
  // Dropped tasks stay in the denominator: they were planned and not done.
  const live = taskRows;
  const doneRows = live.filter((t) => t.status === "done");
  const sum = (rows: typeof live) => rows.reduce((a, t) => a + (t.estimateMin ?? 0), 0);
  const counts = { planned: live.length, done: doneRows.length, plannedMin: sum(live), doneMin: sum(doneRows) };

  // Blocks
  const minutesOf = (b: { startAt: Date; endAt: Date }) => Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60000);
  const scheduledMin = blockRows.reduce((a, b) => a + minutesOf(b), 0);
  const deepMin = blockRows.filter((b) => b.kind === "deep").reduce((a, b) => a + minutesOf(b), 0);

  const perDay = days.map((day) => ({
    day,
    done: doneRows.filter((t) => t.doneAt && new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(t.doneAt) === day).length,
    scheduledMin: blockRows.filter((b) => b.date === day).reduce((a, b) => a + minutesOf(b), 0),
  }));

  // Areas
  const weeks = days.length / 7;
  const areaStats = areaRows.map((a) => ({
    code: a.code,
    name: a.name,
    targetMin: Math.round((a.weeklyTargetHours ?? 0) * 60 * weeks),
    scheduledMin: blockRows.filter((b) => b.areaId === a.id).reduce((s, b) => s + minutesOf(b), 0),
    doneTasks: doneRows.filter((t) => t.areaId === a.id).length,
  }));

  // Habits
  const logsByHabit = new Map<string, Set<DayKey>>();
  for (const l of logRows) {
    if (!logsByHabit.has(l.habitId)) logsByHabit.set(l.habitId, new Set());
    logsByHabit.get(l.habitId)!.add(l.date);
  }
  const habitStats = habitRows.map((h) => {
    const s = habitPeriodStats(h.schedule, logsByHabit.get(h.id) ?? new Set(), period.start, period.end);
    return { name: h.name, done: s.done, due: s.due };
  });
  const dueTotal = habitStats.reduce((a, h) => a + h.due, 0);
  const habitRate = dueTotal ? habitStats.reduce((a, h) => a + h.done, 0) / dueTotal : null;

  // Mood
  const avg = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  return {
    period: { id: period.id, type: period.type, start: period.start, end: period.end },
    days: days.length,
    tasks: { ...counts, rate: plannedVsDone(counts) },
    perDay,
    areas: areaStats,
    deepMin,
    scheduledMin,
    habits: habitStats,
    habitRate,
    mood: avg(moodRows.map((m) => m.mood)),
    energy: avg(moodRows.map((m) => m.energy)),
    dayReviews: dayReviewCount[0]?.n ?? 0,
    inbox,
    projectsNoNext: overview.flatMap((o) => o.projects.filter((p) => p.status === "active" && !p.nextAction).map((p) => ({ id: p.id, title: p.title, areaCode: o.area.code }))),
    goals: overview.flatMap((o) => o.goals.filter((g) => g.status === "active").map((g) => ({ id: g.id, title: g.title, areaCode: o.area.code, progress: goalProgress(g.keyResults), confidence: g.confidence }))),
  };
}

