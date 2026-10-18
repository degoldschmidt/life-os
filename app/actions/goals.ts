"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { periodFor, todayKey } from "@/lib/dates";
import { parseKeyResults } from "@/lib/goals";
import { getSettings } from "@/lib/services/settings";
import { areaIdByCode, updateArea } from "@/lib/services/areas";
import * as goals from "@/lib/services/goals";
import { createTask } from "@/lib/services/tasks";

const refresh = () => revalidatePath("/goals");
const num = z.preprocess((v) => (v === "" || v == null ? null : Number(String(v).replace(",", "."))), z.number().finite().nullable());

async function ctx() {
  const [user, settings] = await Promise.all([requireUser(), getSettings()]);
  return { userId: user.id, settings, today: todayKey(settings.tz, settings.dayStartHour) };
}

export async function saveArea(formData: FormData) {
  const { userId } = await ctx();
  const p = z
    .object({
      code: z.string().length(3),
      name: z.string().trim().min(1).max(60),
      standard: z.string().trim().max(300),
      weeklyTargetHours: num,
      satisfaction: num,
    })
    .parse(Object.fromEntries(formData));
  await updateArea(userId, p.code, {
    name: p.name,
    standard: p.standard || null,
    weeklyTargetHours: p.weeklyTargetHours,
    satisfaction: p.satisfaction == null ? null : Math.max(1, Math.min(10, Math.round(p.satisfaction))),
  });
  refresh();
}

export async function addGoal(formData: FormData) {
  const { userId, settings, today } = await ctx();
  const p = z
    .object({ area: z.string().length(3), title: z.string().trim().min(1).max(200), horizon: z.enum(["quarter", "year"]), krs: z.string().max(2000).default("") })
    .parse(Object.fromEntries(formData));
  const areaId = await areaIdByCode(userId, p.area);
  if (!areaId) redirect("/goals");
  const period = periodFor(p.horizon === "quarter" ? "quarter" : "year", today, settings.tz).id;
  await goals.createGoal(userId, { areaId, title: p.title, horizon: p.horizon, period, keyResults: parseKeyResults(p.krs) });
  refresh();
}

export async function updateGoal(formData: FormData) {
  const { userId } = await ctx();
  const p = z
    .object({
      id: z.uuid(),
      kr1: num.optional(),
      kr2: num.optional(),
      kr3: num.optional(),
      confidence: num.optional(),
      status: z.enum(["active", "achieved", "dropped"]).optional(),
    })
    .parse(Object.fromEntries(formData));
  await goals.updateGoalProgress(userId, p.id, {
    currents: [p.kr1 ?? null, p.kr2 ?? null, p.kr3 ?? null],
    confidence: p.confidence == null ? undefined : Math.max(1, Math.min(10, Math.round(p.confidence))),
    status: p.status,
  });
  refresh();
}

export async function addProject(formData: FormData) {
  const { userId } = await ctx();
  const p = z
    .object({ area: z.string().length(3), title: z.string().trim().min(1).max(200), goalId: z.string().optional(), deadline: z.string().optional() })
    .parse(Object.fromEntries(formData));
  const areaId = await areaIdByCode(userId, p.area);
  if (!areaId) redirect("/goals");
  await goals.createProject(userId, {
    areaId,
    title: p.title,
    goalId: p.goalId && z.uuid().safeParse(p.goalId).success ? p.goalId : null,
    deadline: p.deadline && z.iso.date().safeParse(p.deadline).success ? p.deadline : null,
  });
  refresh();
}

export async function setProjectStatus(id: string, status: "active" | "someday" | "done" | "archived") {
  const { userId } = await ctx();
  await goals.setProjectStatus(userId, z.uuid().parse(id), z.enum(["active", "someday", "done", "archived"]).parse(status));
  refresh();
}

/** A project's next action is just a task linked to it; it waits as "anytime" until planned. */
export async function addNextAction(formData: FormData) {
  const { userId } = await ctx();
  const p = z.object({ projectId: z.uuid(), title: z.string().trim().min(1).max(300) }).parse(Object.fromEntries(formData));
  const areaId = await goals.projectArea(userId, p.projectId);
  await createTask(userId, { title: p.title, areaId, projectId: p.projectId, plan: { kind: "anytime" } });
  revalidatePath("/", "layout");
}
