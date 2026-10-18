import { and, asc, eq, gte, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { HabitSchedule } from "@/lib/db/schema";
import { addDays } from "@/lib/recurrence";
import { GRID_DAYS, MAX_ACTIVE_HABITS, habitStatus, type HabitStatus } from "@/lib/habits";
import type { DayKey } from "@/lib/dates";

const { habits, habitLogs, areas } = schema;

export type HabitWithStatus = {
  id: string;
  name: string;
  intention: string | null;
  schedule: HabitSchedule;
  areaCode: string | null;
  status: HabitStatus;
};

export async function listActiveHabits(userId: string) {
  return db()
    .select({ habit: habits, areaCode: areas.code })
    .from(habits)
    .leftJoin(areas, eq(areas.id, habits.areaId))
    .where(and(eq(habits.userId, userId), isNull(habits.archivedAt)))
    .orderBy(asc(habits.sort), asc(habits.createdAt));
}

/** Every active habit with its 14-day status as of `today`. */
export async function listHabitStatuses(userId: string, today: DayKey): Promise<HabitWithStatus[]> {
  const rows = await listActiveHabits(userId);
  if (rows.length === 0) return [];
  // Reach back two ISO weeks of margin so weekly-count habits see the full week at the window start.
  const since = addDays(today, -(GRID_DAYS + 7));
  const logs = await db()
    .select({ habitId: habitLogs.habitId, date: habitLogs.date })
    .from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), gte(habitLogs.date, since)));
  const byHabit = new Map<string, Set<DayKey>>();
  for (const l of logs) {
    if (!byHabit.has(l.habitId)) byHabit.set(l.habitId, new Set());
    byHabit.get(l.habitId)!.add(l.date);
  }
  return rows.map(({ habit, areaCode }) => ({
    id: habit.id,
    name: habit.name,
    intention: habit.intention,
    schedule: habit.schedule,
    areaCode,
    status: habitStatus(habit.schedule, byHabit.get(habit.id) ?? new Set(), today),
  }));
}

export async function createHabit(
  userId: string,
  input: { name: string; areaId?: string | null; intention?: string | null; schedule: HabitSchedule },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [{ n }] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(habits)
    .where(and(eq(habits.userId, userId), isNull(habits.archivedAt)));
  if (n >= MAX_ACTIVE_HABITS) {
    return { ok: false, error: `Keep it to ${MAX_ACTIVE_HABITS} habits. Archive one first.` };
  }
  await db().insert(habits).values({
    userId,
    name: input.name.trim(),
    areaId: input.areaId ?? null,
    intention: input.intention?.trim() || null,
    schedule: input.schedule,
    sort: n,
  });
  return { ok: true };
}

export async function archiveHabit(userId: string, id: string): Promise<void> {
  await db()
    .update(habits)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(habits.userId, userId), eq(habits.id, id)));
}

/** Idempotent log: the (habit, date) unique index makes a double tap harmless. */
export async function setHabitDone(userId: string, habitId: string, day: DayKey, done: boolean): Promise<void> {
  // Make sure the habit belongs to this user before touching its logs.
  const [owned] = await db()
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.id, habitId)))
    .limit(1);
  if (!owned) throw new Error("Habit not found");
  if (done) {
    await db().insert(habitLogs).values({ userId, habitId, date: day, value: 1 }).onConflictDoNothing();
  } else {
    await db().delete(habitLogs).where(and(eq(habitLogs.userId, userId), eq(habitLogs.habitId, habitId), eq(habitLogs.date, day)));
  }
}
