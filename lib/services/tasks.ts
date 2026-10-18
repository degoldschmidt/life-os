import { and, asc, desc, eq, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Recurrence } from "@/lib/db/schema";
import type { DayKey } from "@/lib/dates";
import { occurrencesBetween } from "@/lib/recurrence";
import { MAX_TOP } from "@/lib/planning";

const { tasks, areas } = schema;

export type Task = typeof tasks.$inferSelect;
export type TaskWithArea = Task & { areaCode: string | null };

export type NewTask = {
  title: string;
  areaId?: string | null;
  projectId?: string | null;
  notes?: string | null;
  estimateMin?: number | null;
  deadline?: DayKey | null;
  /** Where the task starts: inbox (default), today, or a specific day. */
  plan?: { kind: "inbox" } | { kind: "today"; day: DayKey } | { kind: "date"; day: DayKey } | { kind: "someday" };
  recurrence?: Recurrence | null;
};

const notTemplate = and(or(isNull(tasks.recurrence), isNotNull(tasks.seriesId)));

function select() {
  return db()
    .select({ task: tasks, areaCode: areas.code })
    .from(tasks)
    .leftJoin(areas, eq(areas.id, tasks.areaId));
}
const flat = (rows: { task: Task; areaCode: string | null }[]): TaskWithArea[] =>
  rows.map((r) => ({ ...r.task, areaCode: r.areaCode }));

export async function createTask(userId: string, input: NewTask): Promise<Task> {
  const plan = input.plan ?? { kind: "inbox" };
  const values: typeof tasks.$inferInsert = {
    userId,
    title: input.title.trim(),
    areaId: input.areaId ?? null,
    projectId: input.projectId ?? null,
    notes: input.notes ?? null,
    estimateMin: input.estimateMin ?? null,
    deadline: input.deadline ?? null,
    recurrence: input.recurrence ?? null,
    when: "inbox",
  };
  switch (plan.kind) {
    case "today":
      values.when = "today";
      values.plannedForDate = plan.day;
      break;
    case "date":
      values.when = "scheduled";
      values.scheduledDate = plan.day;
      break;
    case "someday":
      values.when = "someday";
      break;
  }
  if (input.recurrence) {
    // A recurring task is a template; instances are materialised per day.
    values.when = "anytime";
    values.scheduledDate = plan.kind === "date" || plan.kind === "today" ? plan.day : null;
    values.plannedForDate = null;
  }
  const [row] = await db().insert(tasks).values(values).returning();
  return row;
}

export async function listInbox(userId: string): Promise<TaskWithArea[]> {
  const rows = await select()
    .where(and(eq(tasks.userId, userId), eq(tasks.when, "inbox"), eq(tasks.status, "todo"), notTemplate))
    .orderBy(desc(tasks.createdAt));
  return flat(rows);
}

export async function countInbox(userId: string): Promise<number> {
  const [r] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.when, "inbox"), eq(tasks.status, "todo"), notTemplate));
  return r?.n ?? 0;
}

/** Everything that belongs to a day: planned for it, scheduled on it. Dropped tasks are hidden. */
export async function listDay(userId: string, day: DayKey): Promise<TaskWithArea[]> {
  const rows = await select()
    .where(
      and(
        eq(tasks.userId, userId),
        ne(tasks.status, "dropped"),
        notTemplate,
        or(
          and(eq(tasks.when, "today"), eq(tasks.plannedForDate, day)),
          and(eq(tasks.when, "scheduled"), eq(tasks.scheduledDate, day)),
        ),
      ),
    )
    .orderBy(asc(tasks.planRank), asc(tasks.createdAt));
  return flat(rows);
}

/**
 * Unfinished work from earlier days. Never rolled over automatically: it waits here
 * until the user decides (today / reschedule / someday / drop) during shutdown or review.
 */
export async function listStale(userId: string, day: DayKey): Promise<TaskWithArea[]> {
  const rows = await select()
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "todo"),
        notTemplate,
        or(
          and(eq(tasks.when, "today"), lt(tasks.plannedForDate, day)),
          and(eq(tasks.when, "scheduled"), lt(tasks.scheduledDate, day)),
        ),
      ),
    )
    .orderBy(asc(tasks.plannedForDate), asc(tasks.scheduledDate));
  return flat(rows);
}

export async function setDone(userId: string, id: string, done: boolean): Promise<void> {
  await db()
    .update(tasks)
    .set({
      status: done ? "done" : "todo",
      doneAt: done ? new Date() : null,
      // A finished task gives its Top-3 slot back.
      ...(done ? { planRank: null } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id)));
}

export async function dropTask(userId: string, id: string): Promise<void> {
  await db()
    .update(tasks)
    .set({ status: "dropped", planRank: null, updatedAt: new Date() })
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id)));
}

export async function planForToday(userId: string, id: string, day: DayKey): Promise<void> {
  await db()
    .update(tasks)
    .set({ when: "today", plannedForDate: day, scheduledDate: null, updatedAt: new Date() })
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id)));
}

/** Defer to a later day. plannedForDate is kept so planned-vs-done can see it was planned. */
export async function scheduleFor(userId: string, id: string, day: DayKey): Promise<void> {
  await db()
    .update(tasks)
    .set({ when: "scheduled", scheduledDate: day, planRank: null, updatedAt: new Date() })
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id)));
}

export async function moveToSomeday(userId: string, id: string): Promise<void> {
  await db()
    .update(tasks)
    .set({ when: "someday", planRank: null, scheduledDate: null, updatedAt: new Date() })
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id)));
}

export async function moveToInbox(userId: string, id: string): Promise<void> {
  await db()
    .update(tasks)
    .set({ when: "inbox", planRank: null, scheduledDate: null, updatedAt: new Date() })
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id)));
}

/**
 * Put a task into Top-3 slot `rank` (1–3) for `day`, or clear it with null.
 * If the slot is taken, the previous holder simply loses its rank.
 */
export async function setTopRank(userId: string, id: string, rank: number | null, day: DayKey): Promise<void> {
  if (rank !== null && (rank < 1 || rank > MAX_TOP)) throw new Error(`rank must be 1–${MAX_TOP}`);
  await db().transaction(async (tx) => {
    if (rank !== null) {
      await tx
        .update(tasks)
        .set({ planRank: null, updatedAt: new Date() })
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.planRank, rank),
            ne(tasks.id, id),
            or(
              and(eq(tasks.when, "today"), eq(tasks.plannedForDate, day)),
              and(eq(tasks.when, "scheduled"), eq(tasks.scheduledDate, day)),
            ),
          ),
        );
      await tx
        .update(tasks)
        .set({ when: "today", plannedForDate: day, scheduledDate: null, planRank: rank, updatedAt: new Date() })
        .where(and(eq(tasks.userId, userId), eq(tasks.id, id)));
    } else {
      await tx.update(tasks).set({ planRank: null, updatedAt: new Date() }).where(and(eq(tasks.userId, userId), eq(tasks.id, id)));
    }
  });
}

export async function updateTask(
  userId: string,
  id: string,
  patch: Partial<Pick<Task, "title" | "notes" | "areaId" | "projectId" | "estimateMin" | "actualMin" | "deadline" | "energy">>,
): Promise<void> {
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  if (!Object.keys(clean).length) return;
  await db()
    .update(tasks)
    .set({ ...clean, updatedAt: new Date() })
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id)));
}

/**
 * Create today's instances of recurring tasks. Idempotent: the unique index on
 * (series_id, scheduled_date) makes a second run a no-op.
 */
export async function materializeRecurring(userId: string, day: DayKey): Promise<number> {
  const templates = await db()
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNotNull(tasks.recurrence), isNull(tasks.seriesId), ne(tasks.status, "dropped")));
  let created = 0;
  for (const tpl of templates) {
    if (!tpl.recurrence) continue;
    const anchor = tpl.scheduledDate ?? tpl.createdAt.toISOString().slice(0, 10);
    if (occurrencesBetween(tpl.recurrence, anchor, day, day).length === 0) continue;
    const res = await db()
      .insert(tasks)
      .values({
        userId,
        areaId: tpl.areaId,
        projectId: tpl.projectId,
        title: tpl.title,
        notes: tpl.notes,
        estimateMin: tpl.estimateMin,
        energy: tpl.energy,
        when: "today",
        plannedForDate: day,
        scheduledDate: day,
        seriesId: tpl.id,
      })
      .onConflictDoNothing({ target: [tasks.seriesId, tasks.scheduledDate] })
      .returning({ id: tasks.id });
    created += res.length;
  }
  return created;
}

/**
 * Everything that was planned for `day`, including tasks later deferred, dropped or
 * finished. This is the denominator for planned-vs-done, so it must not shrink when the
 * user sweeps unfinished work away during shutdown.
 */
export async function listPlannedFor(userId: string, day: DayKey): Promise<TaskWithArea[]> {
  const rows = await select().where(
    and(eq(tasks.userId, userId), notTemplate, or(eq(tasks.plannedForDate, day), and(eq(tasks.when, "scheduled"), eq(tasks.scheduledDate, day)))),
  );
  return flat(rows);
}

export async function listSomeday(userId: string): Promise<TaskWithArea[]> {
  const rows = await select()
    .where(and(eq(tasks.userId, userId), eq(tasks.when, "someday"), eq(tasks.status, "todo"), notTemplate))
    .orderBy(desc(tasks.createdAt));
  return flat(rows);
}
