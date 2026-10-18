"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { saveSettings } from "@/lib/services/settings";

const validTz = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const schema = z.object({
  tz: z.string().trim().refine(validTz, "Unknown time zone"),
  dayStartHour: z.coerce.number().int().min(0).max(8),
  shutdownTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  capacityHours: z.coerce.number().min(1).max(16),
  aiModel: z.enum(["claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5-1"]),
  planTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  // Unchecked checkboxes are simply absent from the form.
  pushPlan: z.string().optional(),
  pushShutdown: z.string().optional(),
  pushWeekly: z.string().optional(),
});

export async function updateSettings(formData: FormData) {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/settings?error=invalid");
  const p = parsed.data;
  await saveSettings(user.id, {
    tz: p.tz,
    dayStartHour: p.dayStartHour,
    shutdownTime: p.shutdownTime,
    dailyCapacityMin: Math.round(p.capacityHours * 60),
    aiModel: p.aiModel,
    planTime: p.planTime,
    pushPlan: p.pushPlan === "on",
    pushShutdown: p.pushShutdown === "on",
    pushWeekly: p.pushWeekly === "on",
  });
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}
