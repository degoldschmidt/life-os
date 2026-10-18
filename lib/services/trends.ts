import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { reviews, reviewScores } = schema;

export type WeekPoint = {
  periodId: string;
  label: string; // "W42"
  plannedVsDone: number | null; // 0..100
  deepHours: number | null;
  habitRate: number | null; // 0..100
  mood: number | null;
  energy: number | null;
  areaHours: Record<string, number>;
};

export type DayPoint = { day: string; label: string; mood: number | null; energy: number | null };
export type AreaScorePoint = { periodId: string; scores: Record<string, number> };

export type Trends = {
  weeks: WeekPoint[];
  days: DayPoint[];
  areaScores: AreaScorePoint[];
  areaTargetsHours: Record<string, number>;
};

type Row = { reviewId: string; key: string; value: number };

function group(rows: Row[]) {
  const m = new Map<string, Record<string, number>>();
  for (const r of rows) {
    if (!m.has(r.reviewId)) m.set(r.reviewId, {});
    m.get(r.reviewId)![r.key] = r.value;
  }
  return m;
}

/** Series for the Trends page, read from the flat scores stored when reviews were finished. */
export async function loadTrends(userId: string, weeksBack = 16, daysBack = 30): Promise<Trends> {
  const weekReviews = (
    await db()
      .select({ id: reviews.id, periodId: reviews.periodId })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.type, "week"), eq(reviews.status, "final")))
      .orderBy(desc(reviews.periodStart))
      .limit(weeksBack)
  ).reverse();

  const dayReviews = (
    await db()
      .select({ id: reviews.id, periodId: reviews.periodId })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.type, "day"), eq(reviews.status, "final")))
      .orderBy(desc(reviews.periodStart))
      .limit(daysBack)
  ).reverse();

  const quarterReviews = await db()
    .select({ id: reviews.id, periodId: reviews.periodId })
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.type, "quarter"), eq(reviews.status, "final")))
    .orderBy(asc(reviews.periodStart));

  const ids = [...weekReviews, ...dayReviews, ...quarterReviews].map((r) => r.id);
  const scoreRows: Row[] = ids.length
    ? await db()
        .select({ reviewId: reviewScores.reviewId, key: reviewScores.key, value: reviewScores.value })
        .from(reviewScores)
        .where(and(eq(reviewScores.userId, userId), inArray(reviewScores.reviewId, ids)))
    : [];
  const byReview = group(scoreRows);

  const weeks = weekReviews.map<WeekPoint>((r) => {
    const s = byReview.get(r.id) ?? {};
    const areaHours: Record<string, number> = {};
    for (const [k, v] of Object.entries(s)) if (k.startsWith("area_min:")) areaHours[k.slice(9)] = Math.round((v / 60) * 10) / 10;
    return {
      periodId: r.periodId,
      label: r.periodId.split("-")[1],
      plannedVsDone: s.planned_vs_done != null ? Math.round(s.planned_vs_done * 100) : null,
      deepHours: s.deep_min != null ? Math.round((s.deep_min / 60) * 10) / 10 : null,
      habitRate: s.habit_rate != null ? Math.round(s.habit_rate * 100) : null,
      mood: s.mood ?? null,
      energy: s.energy ?? null,
      areaHours,
    };
  });

  const days = dayReviews.map<DayPoint>((r) => {
    const s = byReview.get(r.id) ?? {};
    return { day: r.periodId, label: r.periodId.slice(5), mood: s.mood ?? null, energy: s.energy ?? null };
  });

  const areaScores = quarterReviews.map<AreaScorePoint>((r) => {
    const s = byReview.get(r.id) ?? {};
    const scores: Record<string, number> = {};
    for (const [k, v] of Object.entries(s)) if (k.startsWith("area_score:")) scores[k.slice(11)] = v;
    return { periodId: r.periodId, scores };
  });

  const areas = await db().select({ code: schema.areas.code, target: schema.areas.weeklyTargetHours }).from(schema.areas).where(eq(schema.areas.userId, userId));
  const areaTargetsHours = Object.fromEntries(areas.map((a) => [a.code, a.target ?? 0]));

  return { weeks, days, areaScores, areaTargetsHours };
}
