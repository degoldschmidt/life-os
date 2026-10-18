"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { parsePeriodId, periodFor, type ReviewType } from "@/lib/dates";
import { getSettings } from "@/lib/services/settings";
import { computePeriodStats } from "@/lib/services/stats";
import { finalizeReview, getOrCreateReview, reopenReview, saveProgress } from "@/lib/services/reviews";
import { captureTask } from "@/app/actions/tasks";

const type = z.enum(["week", "month", "quarter", "year"]);
const answers = z.record(z.string(), z.unknown());

async function resolve(rawType: string, periodId: string) {
  const t = type.parse(rawType) as ReviewType;
  const [user, settings] = await Promise.all([requireUser(), getSettings()]);
  const period = parsePeriodId(periodId, settings.tz);
  if (!period || period.type !== t) throw new Error("Bad period");
  const { review, template } = await getOrCreateReview(user.id, t, period);
  return { user, settings, period, review, template };
}

/** Goals shown in a review: the quarter and the year that contain its start. */
function goalPeriods(start: string, tz: string) {
  return [periodFor("quarter", start, tz).id, periodFor("year", start, tz).id];
}

export async function saveReviewProgress(rawType: string, periodId: string, step: number, raw: unknown) {
  const { user, review, template } = await resolve(rawType, periodId);
  await saveProgress(user.id, review.id, {
    step: z.number().int().min(0).max(template.steps.length - 1).parse(step),
    answers: answers.parse(raw),
  });
}

export async function finishReview(rawType: string, periodId: string, raw: unknown) {
  const { user, settings, period, review } = await resolve(rawType, periodId);
  await saveProgress(user.id, review.id, { answers: answers.parse(raw) });
  const stats = await computePeriodStats(user.id, period, settings.tz, goalPeriods(period.start, settings.tz));
  await finalizeReview(user.id, review.id, stats);
  revalidatePath("/", "layout");
}

export async function reopenReviewAction(rawType: string, periodId: string) {
  const { user, review } = await resolve(rawType, periodId);
  await reopenReview(user.id, review.id);
  revalidatePath("/", "layout");
}

/** Brain dump: one task per non-empty line, parsed like quick capture. */
export async function dumpToInbox(text: string): Promise<{ added: number }> {
  const lines = z.string().max(20000).parse(text).split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 60);
  let added = 0;
  for (const line of lines) {
    const r = await captureTask(line);
    if (r.ok) added++;
  }
  return { added };
}
