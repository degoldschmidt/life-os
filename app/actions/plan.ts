"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { todayKey } from "@/lib/dates";
import { getSettings } from "@/lib/services/settings";
import { setMorningIntention } from "@/lib/services/journal";

/** Finish the morning plan: save the one-line intention (empty clears it). */
export async function completePlan(intention: string) {
  const [user, settings] = await Promise.all([requireUser(), getSettings()]);
  const day = todayKey(settings.tz, settings.dayStartHour);
  await setMorningIntention(user.id, day, z.string().max(300).parse(intention));
  revalidatePath("/", "layout");
}
