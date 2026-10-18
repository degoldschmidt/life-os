"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { todayKey } from "@/lib/dates";
import { snap } from "@/lib/blocks";
import { areaIdByCode } from "@/lib/services/areas";
import { getSettings } from "@/lib/services/settings";
import * as blocks from "@/lib/services/blocks";

const day = z.iso.date();
const minutes = z.number().int().min(0).max(24 * 60);
const kind = z.enum(["deep", "shallow", "meeting", "personal", "recovery"]);

async function ctx() {
  const [user, settings] = await Promise.all([requireUser(), getSettings()]);
  return { userId: user.id, tz: settings.tz, today: todayKey(settings.tz, settings.dayStartHour) };
}
const refresh = () => revalidatePath("/", "layout");

export async function scheduleTaskBlock(input: { taskId: string; day: string; startMin: number; durationMin?: number; kind?: blocks.BlockKind }) {
  const { userId, tz, today } = await ctx();
  const p = z.object({ taskId: z.uuid(), day, startMin: minutes, durationMin: minutes.optional(), kind: kind.optional() }).parse(input);
  await blocks.createBlock(userId, tz, today, {
    day: p.day,
    startMin: snap(p.startMin),
    durationMin: p.durationMin ?? 60,
    title: "",
    taskId: p.taskId,
    kind: p.kind,
  });
  refresh();
}

export async function createFreeBlock(input: { day: string; startMin: number; durationMin: number; title: string; kind: blocks.BlockKind; areaCode?: string }) {
  const { userId, tz, today } = await ctx();
  const p = z
    .object({ day, startMin: minutes, durationMin: minutes.min(15), title: z.string().trim().min(1).max(120), kind, areaCode: z.string().max(3).optional() })
    .parse(input);
  const areaId = p.areaCode ? await areaIdByCode(userId, p.areaCode) : null;
  await blocks.createBlock(userId, tz, today, { day: p.day, startMin: snap(p.startMin), durationMin: p.durationMin, title: p.title, kind: p.kind, areaId });
  refresh();
}

export async function moveBlock(id: string, d: string, startMin: number) {
  const { userId, tz, today } = await ctx();
  await blocks.moveBlock(userId, tz, today, z.uuid().parse(id), day.parse(d), snap(minutes.parse(startMin)));
  refresh();
}

export async function resizeBlock(id: string, durationMin: number) {
  const { userId, tz } = await ctx();
  await blocks.resizeBlock(userId, tz, z.uuid().parse(id), minutes.min(15).parse(durationMin));
  refresh();
}

export async function removeBlock(id: string) {
  const { userId } = await ctx();
  await blocks.deleteBlock(userId, z.uuid().parse(id));
  refresh();
}
