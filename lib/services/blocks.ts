import { and, asc, eq, gte, isNotNull, isNull, lte, ne, notExists, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { DayKey } from "@/lib/dates";
import { clampStart, instantToMinutes, minutesToInstant } from "@/lib/blocks";
import { planForToday, scheduleFor } from "@/lib/services/tasks";

const { timeBlocks, tasks, areas } = schema;

export type BlockKind = "deep" | "shallow" | "meeting" | "personal" | "recovery";

export type BlockView = {
  id: string;
  day: DayKey;
  startMin: number;
  endMin: number;
  title: string;
  kind: BlockKind;
  areaCode: string | null;
  taskId: string | null;
  taskDone: boolean;
};

export async function listBlocks(userId: string, from: DayKey, to: DayKey, tz: string): Promise<BlockView[]> {
  const rows = await db()
    .select({ b: timeBlocks, areaCode: areas.code, taskStatus: tasks.status })
    .from(timeBlocks)
    .leftJoin(areas, eq(areas.id, timeBlocks.areaId))
    .leftJoin(tasks, eq(tasks.id, timeBlocks.taskId))
    .where(and(eq(timeBlocks.userId, userId), gte(timeBlocks.date, from), lte(timeBlocks.date, to)))
    .orderBy(asc(timeBlocks.startAt));
  return rows.map(({ b, areaCode, taskStatus }) => ({
    id: b.id,
    day: b.date,
    startMin: instantToMinutes(b.startAt, tz),
    endMin: instantToMinutes(b.startAt, tz) + Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60000),
    title: b.title,
    kind: b.kind,
    areaCode,
    taskId: b.taskId,
    taskDone: taskStatus === "done",
  }));
}

/** Open tasks that have no time block yet and aren't parked in Someday. */
export async function listBacklog(userId: string) {
  const rows = await db()
    .select({
      id: tasks.id,
      title: tasks.title,
      estimateMin: tasks.estimateMin,
      areaCode: areas.code,
      when: tasks.when,
      scheduledDate: tasks.scheduledDate,
    })
    .from(tasks)
    .leftJoin(areas, eq(areas.id, tasks.areaId))
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "todo"),
        ne(tasks.when, "someday"),
        or(isNull(tasks.recurrence), isNotNull(tasks.seriesId)),
        notExists(db().select({ one: sql`1` }).from(timeBlocks).where(eq(timeBlocks.taskId, tasks.id))),
      ),
    )
    .orderBy(asc(tasks.when), asc(tasks.createdAt));
  return rows;
}

export type NewBlock = {
  day: DayKey;
  startMin: number;
  durationMin: number;
  title: string;
  kind?: BlockKind;
  taskId?: string | null;
  areaId?: string | null;
};

/** Create a block. A block for a task also plans the task onto that day. */
export async function createBlock(userId: string, tz: string, today: DayKey, input: NewBlock): Promise<string> {
  const duration = Math.max(15, Math.min(input.durationMin, 12 * 60));
  const start = clampStart(input.startMin, duration);
  let title = input.title.trim();
  let areaId = input.areaId ?? null;

  if (input.taskId) {
    const [t] = await db()
      .select({ title: tasks.title, areaId: tasks.areaId })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.id, input.taskId)))
      .limit(1);
    if (!t) throw new Error("Task not found");
    title = title || t.title;
    areaId = areaId ?? t.areaId;
    if (input.day === today) await planForToday(userId, input.taskId, input.day);
    else await scheduleFor(userId, input.taskId, input.day);
  }

  const [row] = await db()
    .insert(timeBlocks)
    .values({
      userId,
      date: input.day,
      startAt: minutesToInstant(input.day, start, tz),
      endAt: minutesToInstant(input.day, start + duration, tz),
      tz,
      title: title || "Block",
      kind: input.kind ?? "deep",
      taskId: input.taskId ?? null,
      areaId,
    })
    .returning({ id: timeBlocks.id });
  return row.id;
}

async function owned(userId: string, id: string) {
  const [b] = await db()
    .select()
    .from(timeBlocks)
    .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.id, id)))
    .limit(1);
  if (!b) throw new Error("Block not found");
  return b;
}

export async function moveBlock(userId: string, tz: string, today: DayKey, id: string, day: DayKey, startMin: number) {
  const b = await owned(userId, id);
  const duration = Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60000);
  const start = clampStart(startMin, duration);
  await db()
    .update(timeBlocks)
    .set({
      date: day,
      startAt: minutesToInstant(day, start, tz),
      endAt: minutesToInstant(day, start + duration, tz),
      tz,
      updatedAt: new Date(),
    })
    .where(eq(timeBlocks.id, id));
  if (b.taskId && day !== b.date) {
    if (day === today) await planForToday(userId, b.taskId, day);
    else await scheduleFor(userId, b.taskId, day);
  }
}

export async function resizeBlock(userId: string, tz: string, id: string, durationMin: number) {
  const b = await owned(userId, id);
  const duration = Math.max(15, Math.min(durationMin, 12 * 60));
  const startMin = instantToMinutes(b.startAt, tz);
  const start = clampStart(startMin, duration);
  await db()
    .update(timeBlocks)
    .set({
      startAt: minutesToInstant(b.date, start, tz),
      endAt: minutesToInstant(b.date, start + duration, tz),
      updatedAt: new Date(),
    })
    .where(eq(timeBlocks.id, id));
}

export async function deleteBlock(userId: string, id: string) {
  await db().delete(timeBlocks).where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.id, id)));
}

/** Total scheduled minutes per day, used for the column meters. */
export function sumByDay(blocks: BlockView[]): Map<DayKey, number> {
  const m = new Map<DayKey, number>();
  for (const b of blocks) m.set(b.day, (m.get(b.day) ?? 0) + (b.endMin - b.startMin));
  return m;
}

