"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { MAX_ACTIVE_HABITS } from "@/lib/habits";
import { parseKeyResults } from "@/lib/goals";
import { periodFor, todayKey } from "@/lib/dates";
import { dedupeTitles, krFromLines, rhythmToSchedule, SelectionSchema } from "@/lib/setup-apply";
import { areaIdByCode, listAreas, updateArea } from "@/lib/services/areas";
import { getSettings } from "@/lib/services/settings";
import { createGoal, createProject } from "@/lib/services/goals";
import { createHabit } from "@/lib/services/habits";
import { createTask, listAnytime, listInbox } from "@/lib/services/tasks";

export type SetupResult = { ok: true; message: string } | { ok: false; error: string };
const refresh = () => revalidatePath("/", "layout");

/** Section 1: every area's name, standard and weekly target in one go. */
export async function saveAllAreas(formData: FormData): Promise<SetupResult> {
  const user = await requireUser();
  const areas = await listAreas(user.id);
  let saved = 0;
  for (const a of areas) {
    const name = String(formData.get(`name_${a.code}`) ?? "").trim();
    const standard = String(formData.get(`standard_${a.code}`) ?? "").trim();
    const hoursRaw = String(formData.get(`hours_${a.code}`) ?? "").replace(",", ".");
    const hours = hoursRaw === "" ? null : Number(hoursRaw);
    if (!name || (hours != null && (!Number.isFinite(hours) || hours < 0 || hours > 100))) continue;
    await updateArea(user.id, a.code, { name: name.slice(0, 60), standard: standard.slice(0, 300) || null, weeklyTargetHours: hours });
    saved++;
  }
  refresh();
  return { ok: true, message: `${saved} areas saved.` };
}

/** Section 2: one goal per area for this quarter, with optional key results. */
export async function addGoalsBatch(formData: FormData): Promise<SetupResult> {
  const user = await requireUser();
  const settings = await getSettings();
  const period = periodFor("quarter", todayKey(settings.tz, settings.dayStartHour), settings.tz).id;
  const areas = await listAreas(user.id);
  const existing = new Set((await db().select({ t: schema.goals.title }).from(schema.goals).where(eq(schema.goals.userId, user.id))).map((g) => g.t.trim().toLowerCase()));
  let added = 0;
  for (const a of areas) {
    const title = String(formData.get(`goal_${a.code}`) ?? "").trim().slice(0, 200);
    if (!title || existing.has(title.toLowerCase())) continue;
    await createGoal(user.id, { areaId: a.id, title, horizon: "quarter", period, keyResults: parseKeyResults(String(formData.get(`krs_${a.code}`) ?? "")) });
    added++;
  }
  refresh();
  return { ok: true, message: added ? `${added} goal${added === 1 ? "" : "s"} added.` : "Nothing new to add." };
}

/** Section 3: up to five habits. */
export async function addHabitsBatch(formData: FormData): Promise<SetupResult> {
  const user = await requireUser();
  let added = 0;
  for (let i = 0; i < MAX_ACTIVE_HABITS; i++) {
    const name = String(formData.get(`habit_${i}`) ?? "").trim();
    if (!name) continue;
    const rhythm = z.enum(["daily", "weekdays", "weekly"]).catch("daily").parse(formData.get(`rhythm_${i}`));
    const areaCode = String(formData.get(`habit_area_${i}`) ?? "");
    const r = await createHabit(user.id, { name: name.slice(0, 80), areaId: areaCode ? await areaIdByCode(user.id, areaCode) : null, schedule: rhythmToSchedule(rhythm) });
    if (!r.ok) { refresh(); return { ok: false, error: `${added} added. ${r.error}` }; }
    added++;
  }
  refresh();
  return { ok: true, message: added ? `${added} habit${added === 1 ? "" : "s"} added.` : "No habits entered." };
}

/**
 * Section 4: create what the person approved from a brain dump. Projects come first so tasks
 * can attach to them; anything already present (by title) is skipped, so running it twice is safe.
 */
export async function applyBrainDump(raw: unknown): Promise<SetupResult & { counts?: Record<string, number> }> {
  const user = await requireUser();
  const settings = await getSettings();
  const parsed = SelectionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Some items weren't valid. Check titles and dates." };
  const sel = parsed.data;
  const areas = await listAreas(user.id);
  const fallbackArea = areas[0];
  if (!fallbackArea) return { ok: false, error: "No areas found. Run the seed first." };
  const idOf = async (code: string | null) => (code ? await areaIdByCode(user.id, code) : null);
  const counts = { tasks: 0, projects: 0, goals: 0, habits: 0, skipped: 0 };

  // Projects (including ones that only exist because a task names them)
  const existingProjects = await db().select({ id: schema.projects.id, title: schema.projects.title }).from(schema.projects).where(eq(schema.projects.userId, user.id));
  const projectId = new Map(existingProjects.map((p) => [p.title.trim().toLowerCase(), p.id]));
  const wanted = [...sel.projects.map((p) => ({ title: p.title, area: p.area })), ...sel.tasks.filter((t) => t.project).map((t) => ({ title: t.project!, area: t.area }))];
  for (const p of wanted) {
    const k = p.title.trim().toLowerCase();
    if (projectId.has(k)) continue;
    const id = await createProject(user.id, { areaId: (await idOf(p.area)) ?? fallbackArea.id, title: p.title });
    projectId.set(k, id);
    counts.projects++;
  }

  // Goals
  const period = (h: "quarter" | "year") => periodFor(h, todayKey(settings.tz, settings.dayStartHour), settings.tz).id;
  const haveGoals = new Set((await db().select({ t: schema.goals.title }).from(schema.goals).where(eq(schema.goals.userId, user.id))).map((g) => g.t.trim().toLowerCase()));
  const goals = dedupeTitles(sel.goals, (g) => g.title, haveGoals);
  counts.skipped += goals.skipped;
  for (const g of goals.keep) {
    await createGoal(user.id, { areaId: (await idOf(g.area)) ?? fallbackArea.id, title: g.title, horizon: g.horizon, period: period(g.horizon), keyResults: krFromLines(g.keyResults) });
    counts.goals++;
  }

  // Habits (capped)
  const haveHabits = (await db().select({ id: schema.habits.id }).from(schema.habits).where(and(eq(schema.habits.userId, user.id), isNull(schema.habits.archivedAt)))).length;
  let room = MAX_ACTIVE_HABITS - haveHabits;
  for (const h of sel.habits) {
    if (room <= 0) { counts.skipped++; continue; }
    const r = await createHabit(user.id, { name: h.name, areaId: await idOf(h.area), schedule: rhythmToSchedule(h.rhythm) });
    if (r.ok) { counts.habits++; room--; } else counts.skipped++;
  }

  // Tasks
  const open = new Set([...(await listInbox(user.id)), ...(await listAnytime(user.id))].map((t) => t.title.trim().toLowerCase()));
  const tasks = dedupeTitles(sel.tasks, (t) => t.title, open);
  counts.skipped += tasks.skipped;
  for (const t of tasks.keep) {
    const pid = t.project ? projectId.get(t.project.trim().toLowerCase()) ?? null : null;
    await createTask(user.id, { title: t.title, areaId: await idOf(t.area), projectId: pid, estimateMin: t.estimateMin, deadline: t.due, plan: pid ? { kind: "anytime" } : { kind: "inbox" } });
    counts.tasks++;
  }

  refresh();
  const n = (c: number, one: string, many: string) => (c ? `${c} ${c === 1 ? one : many}` : "");
  const parts = [n(counts.tasks, "task", "tasks"), n(counts.projects, "project", "projects"), n(counts.goals, "goal", "goals"), n(counts.habits, "habit", "habits")].filter(Boolean);
  return { ok: true, counts, message: `${parts.length ? "Added " + parts.join(", ") : "Nothing new"}${counts.skipped ? `. ${counts.skipped} skipped as duplicates or over the limit.` : "."}` };
}
