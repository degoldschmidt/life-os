import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { DayKey } from "@/lib/dates";

const { reviews, reviewTemplates, reviewScores, journalEntries } = schema;

export type Review = typeof reviews.$inferSelect;
export type DayAnswers = {
  went_well?: string;
  fell_short?: string;
  better_tomorrow?: string;
  mood?: number;
  energy?: number;
};

async function latestTemplate(type: "day" | "week" | "month" | "quarter" | "year") {
  const [t] = await db()
    .select()
    .from(reviewTemplates)
    .where(eq(reviewTemplates.type, type))
    .orderBy(desc(reviewTemplates.version))
    .limit(1);
  if (!t) throw new Error(`No ${type} review template. Run pnpm db:seed.`);
  return t;
}

/** The day review for `day`, created on first use so a half-finished shutdown can be resumed. */
export async function getOrCreateDayReview(userId: string, day: DayKey): Promise<Review> {
  const [existing] = await db()
    .select()
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.type, "day"), eq(reviews.periodId, day)))
    .limit(1);
  if (existing) return existing;
  const tpl = await latestTemplate("day");
  const [row] = await db()
    .insert(reviews)
    .values({ userId, type: "day", periodId: day, periodStart: day, periodEnd: day, templateId: tpl.id })
    .onConflictDoNothing({ target: [reviews.userId, reviews.type, reviews.periodId] })
    .returning();
  if (row) return row;
  // Lost a race with another tab: read the winner.
  const [winner] = await db()
    .select()
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.type, "day"), eq(reviews.periodId, day)))
    .limit(1);
  return winner;
}

export async function saveProgress(
  userId: string,
  reviewId: string,
  patch: { step?: number; answers?: DayAnswers },
): Promise<void> {
  const [row] = await db()
    .select()
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.id, reviewId)))
    .limit(1);
  if (!row || row.status === "final") return;
  await db()
    .update(reviews)
    .set({
      currentStep: patch.step ?? row.currentStep,
      answers: { ...row.answers, ...(patch.answers ?? {}) },
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, reviewId));
}

export type DaySnapshot = {
  tasksTotal: number;
  tasksDone: number;
  plannedMin: number;
  doneMin: number;
  habitsDue: number;
  habitsDone: number;
};

/** Close the day: freeze the numbers, store scores for trends, write a journal entry. */
export async function finalizeDayReview(
  userId: string,
  reviewId: string,
  day: DayKey,
  snapshot: DaySnapshot,
  nextTop3: string[],
): Promise<void> {
  const [row] = await db()
    .select()
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.id, reviewId)))
    .limit(1);
  if (!row || row.status === "final") return;
  const a = row.answers as DayAnswers;

  await db().transaction(async (tx) => {
    await tx
      .update(reviews)
      .set({
        status: "final",
        finalizedAt: new Date(),
        statsSnapshot: snapshot,
        nextTop3,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId));

    await tx.delete(reviewScores).where(eq(reviewScores.reviewId, reviewId));
    const scores: [string, number | undefined][] = [
      ["mood", a.mood],
      ["energy", a.energy],
      ["tasks_done", snapshot.tasksDone],
      ["tasks_total", snapshot.tasksTotal],
      ["planned_min", snapshot.plannedMin],
      ["done_min", snapshot.doneMin],
      ["habits_done", snapshot.habitsDone],
      ["habits_due", snapshot.habitsDue],
    ];
    const rows = scores.filter(([, v]) => typeof v === "number").map(([key, value]) => ({ userId, reviewId, key, value: value as number }));
    if (rows.length) await tx.insert(reviewScores).values(rows);

    const text = [
      a.went_well ? `Went well: ${a.went_well}` : "",
      a.fell_short ? `Fell short: ${a.fell_short}` : "",
      a.better_tomorrow ? `Better tomorrow: ${a.better_tomorrow}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    if (text || a.mood || a.energy) {
      await tx.insert(journalEntries).values({
        userId,
        date: day,
        kind: "shutdown",
        contentMd: text,
        mood: a.mood ?? null,
        energy: a.energy ?? null,
      });
    }
  });
}
