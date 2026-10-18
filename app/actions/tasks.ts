"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { addDaysToKey, todayKey } from "@/lib/dates";
import { parseCapture } from "@/lib/capture/parse";
import { getSettings } from "@/lib/services/settings";
import { areaIdByCode, listAreas } from "@/lib/services/areas";
import * as tasks from "@/lib/services/tasks";

const id = z.uuid();

async function ctx() {
  const [user, settings] = await Promise.all([requireUser(), getSettings()]);
  return { userId: user.id, settings, today: todayKey(settings.tz, settings.dayStartHour) };
}
function refresh() {
  revalidatePath("/", "layout");
}

export type CaptureResult = { ok: true; title: string; where: string } | { ok: false; error: string };

/** One line of quick capture -> a task in Inbox, Today, or on a date. */
export async function captureTask(raw: string, opts: { forceToday?: boolean } = {}): Promise<CaptureResult> {
  const input = z.string().trim().min(1).max(500).safeParse(raw);
  if (!input.success) return { ok: false, error: "Type something to capture." };
  const { userId, settings, today } = await ctx();

  const areas = await listAreas(userId);
  const parsed = parseCapture(input.data, { tz: settings.tz, areaCodes: areas.map((a) => a.code) });
  const areaId = parsed.areaCode ? await areaIdByCode(userId, parsed.areaCode) : null;

  const plan =
    opts.forceToday || parsed.today
      ? ({ kind: "today", day: today } as const)
      : parsed.date
        ? ({ kind: "date", day: parsed.date } as const)
        : ({ kind: "inbox" } as const);

  await tasks.createTask(userId, {
    title: parsed.title,
    areaId,
    estimateMin: parsed.estimateMin,
    deadline: parsed.deadline,
    plan,
  });
  refresh();
  const where = plan.kind === "today" ? "Today" : plan.kind === "date" ? plan.day : "Inbox";
  return { ok: true, title: parsed.title, where };
}

export async function toggleDone(taskId: string, done: boolean) {
  const { userId } = await ctx();
  await tasks.setDone(userId, id.parse(taskId), z.boolean().parse(done));
  refresh();
}

export async function planToday(taskId: string) {
  const { userId, today } = await ctx();
  await tasks.planForToday(userId, id.parse(taskId), today);
  refresh();
}

export async function planTomorrow(taskId: string) {
  const { userId, today, settings } = await ctx();
  await tasks.scheduleFor(userId, id.parse(taskId), addDaysToKey(today, 1, settings.tz));
  refresh();
}

export async function scheduleTask(taskId: string, day: string) {
  const { userId } = await ctx();
  await tasks.scheduleFor(userId, id.parse(taskId), z.iso.date().parse(day));
  refresh();
}

export async function somedayTask(taskId: string) {
  const { userId } = await ctx();
  await tasks.moveToSomeday(userId, id.parse(taskId));
  refresh();
}

export async function dropTask(taskId: string) {
  const { userId } = await ctx();
  await tasks.dropTask(userId, id.parse(taskId));
  refresh();
}

export async function setTop(taskId: string, rank: number | null) {
  const { userId, today } = await ctx();
  await tasks.setTopRank(userId, id.parse(taskId), z.number().int().min(1).max(3).nullable().parse(rank), today);
  refresh();
}

export async function renameTask(taskId: string, title: string) {
  const { userId } = await ctx();
  const t = z.string().trim().min(1).max(500).parse(title);
  await tasks.updateTask(userId, id.parse(taskId), { title: t });
  refresh();
}

export async function setEstimate(taskId: string, minutes: number | null) {
  const { userId } = await ctx();
  await tasks.updateTask(userId, id.parse(taskId), { estimateMin: z.number().int().min(1).max(1440).nullable().parse(minutes) });
  refresh();
}

/** Shutdown step 3: choose tomorrow's Top 3. */
export async function setTopTomorrow(taskId: string, rank: number | null) {
  const { userId, today, settings } = await ctx();
  const tomorrow = addDaysToKey(today, 1, settings.tz);
  await tasks.setTopRank(userId, id.parse(taskId), z.number().int().min(1).max(3).nullable().parse(rank), tomorrow);
  refresh();
}
