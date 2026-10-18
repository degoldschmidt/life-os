import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { DayKey, Period, ReviewType } from "@/lib/dates";
import type { PeriodStats } from "@/lib/services/stats";
import { cleanTop, extractScores } from "@/lib/review";

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
  patch: { step?: number; answers?: Record<string, unknown> },
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


export type ReviewTemplate = typeof reviewTemplates.$inferSelect;

/** The review for any period, created on first open so a half-finished one can be resumed. */
export async function getOrCreateReview(userId: string, type: ReviewType, period: Period): Promise<{ review: Review; template: ReviewTemplate }> {
  const tpl = await latestTemplate(type);
  const find = () =>
    db()
      .select()
      .from(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.type, type), eq(reviews.periodId, period.id)))
      .limit(1);
  let [review] = await find();
  if (!review) {
    await db()
      .insert(reviews)
      .values({ userId, type, periodId: period.id, periodStart: period.start, periodEnd: period.end, templateId: tpl.id })
      .onConflictDoNothing({ target: [reviews.userId, reviews.type, reviews.periodId] });
    [review] = await find();
  }
  // A review keeps the template version it started with, so edits never rewrite history.
  const [template] = await db().select().from(reviewTemplates).where(eq(reviewTemplates.id, review.templateId)).limit(1);
  return { review, template: template ?? tpl };
}

export async function getReviewById(userId: string, id: string): Promise<Review | null> {
  const [r] = await db().select().from(reviews).where(and(eq(reviews.userId, userId), eq(reviews.id, id))).limit(1);
  return r ?? null;
}

/**
 * Close a review: freeze the numbers, write flat scores for trends, keep the "next top 3",
 * and carry quarterly area ratings back onto the areas themselves.
 */
export async function finalizeReview(userId: string, reviewId: string, stats: PeriodStats): Promise<void> {
  const [row] = await db().select().from(reviews).where(and(eq(reviews.userId, userId), eq(reviews.id, reviewId))).limit(1);
  if (!row || row.status === "final") return;
  const answers = row.answers as Record<string, unknown>;
  const top = cleanTop(answers.top3 ?? answers.improvements);

  const scores = extractScores({
    tasks: stats.tasks,
    deepMin: stats.deepMin,
    habitRate: stats.habitRate,
    mood: stats.mood,
    energy: stats.energy,
    areas: stats.areas,
    answers,
  });

  await db().transaction(async (tx) => {
    await tx
      .update(reviews)
      .set({ status: "final", finalizedAt: new Date(), statsSnapshot: stats as unknown as Record<string, unknown>, nextTop3: top, updatedAt: new Date() })
      .where(eq(reviews.id, reviewId));
    await tx.delete(reviewScores).where(eq(reviewScores.reviewId, reviewId));
    const rows = Object.entries(scores).map(([key, value]) => ({ userId, reviewId, key, value }));
    if (rows.length) await tx.insert(reviewScores).values(rows);

    const standards = answers.area_standards;
    if (row.type === "year" && standards && typeof standards === "object") {
      for (const [code, v] of Object.entries(standards as Record<string, unknown>)) {
        if (typeof v === "string" && v.trim()) {
          await tx
            .update(schema.areas)
            .set({ standard: v.trim().slice(0, 300), updatedAt: new Date() })
            .where(and(eq(schema.areas.userId, userId), eq(schema.areas.code, code)));
        }
      }
    }

    const rated = answers.area_scores;
    if (row.type === "quarter" && rated && typeof rated === "object") {
      for (const [code, v] of Object.entries(rated as Record<string, unknown>)) {
        if (typeof v === "number" && v >= 1 && v <= 10) {
          await tx
            .update(schema.areas)
            .set({ satisfaction: Math.round(v), updatedAt: new Date() })
            .where(and(eq(schema.areas.userId, userId), eq(schema.areas.code, code)));
        }
      }
    }
  });
}

/** Re-open a finished review for edits. Its scores stay until it is finished again. */
export async function reopenReview(userId: string, reviewId: string): Promise<void> {
  await db()
    .update(reviews)
    .set({ status: "draft", finalizedAt: null, updatedAt: new Date() })
    .where(and(eq(reviews.userId, userId), eq(reviews.id, reviewId)));
}

export type ReviewListItem = Pick<Review, "id" | "type" | "periodId" | "periodStart" | "periodEnd" | "status" | "currentStep" | "finalizedAt" | "updatedAt">;

export async function listReviews(userId: string, types: ReviewType[], limit = 60): Promise<ReviewListItem[]> {
  return db()
    .select({
      id: reviews.id,
      type: reviews.type,
      periodId: reviews.periodId,
      periodStart: reviews.periodStart,
      periodEnd: reviews.periodEnd,
      status: reviews.status,
      currentStep: reviews.currentStep,
      finalizedAt: reviews.finalizedAt,
      updatedAt: reviews.updatedAt,
    })
    .from(reviews)
    .where(and(eq(reviews.userId, userId), inArray(reviews.type, types)))
    .orderBy(desc(reviews.periodStart))
    .limit(limit);
}

/** Has this review been finished? Used to avoid reminding about finished work. */
export async function isReviewFinal(userId: string, type: ReviewType, periodId: string): Promise<boolean> {
  const [r] = await db()
    .select({ status: reviews.status })
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.type, type), eq(reviews.periodId, periodId)))
    .limit(1);
  return r?.status === "final";
}
