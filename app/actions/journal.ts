"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { todayKey } from "@/lib/dates";
import { getSettings } from "@/lib/services/settings";
import * as journal from "@/lib/services/journal";

async function ctx() {
  const [user, settings] = await Promise.all([requireUser(), getSettings()]);
  return { userId: user.id, today: todayKey(settings.tz, settings.dayStartHour) };
}

export async function addInterstitial(text: string) {
  const { userId, today } = await ctx();
  await journal.addInterstitial(userId, today, z.string().trim().min(1).max(1000).parse(text));
  revalidatePath("/journal");
}

export async function saveNote(day: string, text: string, mood: number | null, energy: number | null) {
  const { userId, today } = await ctx();
  const d = z.iso.date().parse(day);
  if (d > today) throw new Error("Can't write in the future");
  await journal.saveDayNote(userId, d, {
    text: z.string().max(20000).parse(text),
    mood: z.number().int().min(1).max(5).nullable().parse(mood),
    energy: z.number().int().min(1).max(5).nullable().parse(energy),
  });
  revalidatePath("/journal");
}

export async function deleteEntry(id: string) {
  const { userId } = await ctx();
  await journal.deleteEntry(userId, z.uuid().parse(id));
  revalidatePath("/journal");
}
