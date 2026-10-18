"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { todayKey } from "@/lib/dates";
import { areaIdByCode } from "@/lib/services/areas";
import { getSettings } from "@/lib/services/settings";
import * as habits from "@/lib/services/habits";
import type { HabitSchedule } from "@/lib/db/schema";

const id = z.uuid();

async function ctx() {
  const [user, settings] = await Promise.all([requireUser(), getSettings()]);
  return { userId: user.id, today: todayKey(settings.tz, settings.dayStartHour) };
}

export async function toggleHabit(habitId: string, done: boolean) {
  const { userId, today } = await ctx();
  await habits.setHabitDone(userId, id.parse(habitId), today, z.boolean().parse(done));
  revalidatePath("/", "layout");
}

export async function archiveHabit(habitId: string) {
  const { userId } = await ctx();
  await habits.archiveHabit(userId, id.parse(habitId));
  revalidatePath("/", "layout");
}

const form = z.object({
  name: z.string().trim().min(1).max(80),
  rhythm: z.enum(["daily", "weekdays", "1", "2", "3", "4", "5"]),
  area: z.string().max(3).optional(),
  intention: z.string().trim().max(200).optional(),
});

export async function createHabit(formData: FormData) {
  const parsed = form.safeParse({
    name: formData.get("name"),
    rhythm: formData.get("rhythm"),
    area: (formData.get("area") as string) || undefined,
    intention: (formData.get("intention") as string) || undefined,
  });
  if (!parsed.success) redirect("/habits?error=invalid");
  const { userId } = await ctx();
  const { name, rhythm, area, intention } = parsed.data;

  const schedule: HabitSchedule =
    rhythm === "daily"
      ? { days: [1, 2, 3, 4, 5, 6, 7] }
      : rhythm === "weekdays"
        ? { days: [1, 2, 3, 4, 5] }
        : { perWeek: Number(rhythm) };
  const areaId = area ? await areaIdByCode(userId, area) : null;

  const res = await habits.createHabit(userId, { name, areaId, intention, schedule });
  if (!res.ok) redirect(`/habits?error=${encodeURIComponent(res.error)}`);
  revalidatePath("/", "layout");
  redirect("/habits");
}
