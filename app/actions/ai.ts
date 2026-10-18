"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { addDaysToKey, todayKey } from "@/lib/dates";
import { aiAvailable } from "@/lib/ai/run";
import { getSettings } from "@/lib/services/settings";
import { analyzeDump, draftReview, suggestTop } from "@/lib/services/ai";

export async function generateReviewDraft(type: string, periodId: string) {
  const user = await requireUser();
  const settings = await getSettings();
  const t = z.enum(["week", "month", "quarter", "year"]).parse(type);
  return draftReview(user.id, settings, t, z.string().max(20).parse(periodId));
}

export async function suggestTop3(which: "today" | "tomorrow") {
  const user = await requireUser();
  const settings = await getSettings();
  const today = todayKey(settings.tz, settings.dayStartHour);
  return suggestTop(user.id, settings, z.enum(["today", "tomorrow"]).parse(which) === "today" ? today : addDaysToKey(today, 1, settings.tz));
}

export async function analyzeBrainDump(text: string) {
  const user = await requireUser();
  const settings = await getSettings();
  const clean = z.string().trim().min(1).max(20000).safeParse(text);
  if (!clean.success) return { ok: false as const, error: "Paste or type something first." };
  return analyzeDump(user.id, settings, clean.data, todayKey(settings.tz, settings.dayStartHour));
}

export async function aiConfigured(): Promise<boolean> {
  await requireUser();
  return aiAvailable();
}
