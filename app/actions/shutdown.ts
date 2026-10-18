"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { addDaysToKey, todayKey } from "@/lib/dates";
import { summarizeDay } from "@/lib/planning";
import { getSettings } from "@/lib/services/settings";
import { listHabitStatuses } from "@/lib/services/habits";
import { listDay, listPlannedFor } from "@/lib/services/tasks";
import { finalizeDayReview, getOrCreateDayReview, saveProgress } from "@/lib/services/reviews";

const text = z.string().max(2000).optional();
const answers = z.object({
  went_well: text,
  fell_short: text,
  better_tomorrow: text,
  mood: z.number().int().min(1).max(5).optional(),
  energy: z.number().int().min(1).max(5).optional(),
});

async function ctx() {
  const [user, settings] = await Promise.all([requireUser(), getSettings()]);
  const today = todayKey(settings.tz, settings.dayStartHour);
  return { userId: user.id, settings, today };
}

/** Remember where the user is and what they typed, so closing the app loses nothing. */
export async function saveShutdown(step: number, raw: unknown) {
  const { userId, today } = await ctx();
  const review = await getOrCreateDayReview(userId, today);
  await saveProgress(userId, review.id, { step: z.number().int().min(0).max(3).parse(step), answers: answers.parse(raw) });
}

export async function completeShutdown(raw: unknown) {
  const { userId, today, settings } = await ctx();
  const review = await getOrCreateDayReview(userId, today);
  await saveProgress(userId, review.id, { answers: answers.parse(raw) });

  const [dayTasks, habits, tomorrow] = await Promise.all([
    listPlannedFor(userId, today),
    listHabitStatuses(userId, today),
    listDay(userId, addDaysToKey(today, 1, settings.tz)),
  ]);
  // Planned-vs-done counts everything planned for today, even what was deferred or dropped in the sweep.
  const s = summarizeDay(dayTasks.map((t) => (t.status === "dropped" ? { ...t, status: "todo" as const } : t)), settings.dailyCapacityMin);
  const due = habits.filter((h) => h.status.dueToday || h.status.doneToday);
  const top3 = tomorrow
    .filter((t) => t.status === "todo" && t.planRank != null)
    .sort((a, b) => a.planRank! - b.planRank!)
    .map((t) => t.title);

  await finalizeDayReview(
    userId,
    review.id,
    today,
    {
      tasksTotal: s.total,
      tasksDone: s.done,
      plannedMin: s.plannedMin + s.doneMin,
      doneMin: s.doneMin,
      habitsDue: due.length,
      habitsDone: due.filter((h) => h.status.doneToday).length,
    },
    top3,
  );
  revalidatePath("/", "layout");
}
