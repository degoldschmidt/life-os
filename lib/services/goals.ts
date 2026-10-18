import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { KeyResult } from "@/lib/db/schema";
import type { DayKey } from "@/lib/dates";
import { listAreas, type Area } from "@/lib/services/areas";

const { goals, projects, tasks, timeBlocks } = schema;

export type GoalView = {
  id: string;
  title: string;
  horizon: "quarter" | "year";
  period: string;
  keyResults: KeyResult[];
  confidence: number | null;
  status: "active" | "achieved" | "dropped";
  lastTouched: Date;
};

export type ProjectView = {
  id: string;
  title: string;
  goalId: string | null;
  status: "active" | "someday" | "done" | "archived";
  deadline: string | null;
  openTasks: number;
  nextAction: string | null;
  lastTouched: Date;
};

export type AreaOverview = {
  area: Area;
  goals: GoalView[];
  projects: ProjectView[];
  attentionMin: number;
};

/**
 * Everything the Goals screen needs: per area, the goals of the current quarter and year,
 * live projects with their next action, and scheduled minutes this week.
 */
export async function areaOverview(
  userId: string,
  periods: string[],
  weekFrom: DayKey,
  weekTo: DayKey,
): Promise<AreaOverview[]> {
  const [areaRows, goalRows, projectRows, openTasks, activity, attention] = await Promise.all([
    listAreas(userId),
    db()
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), inArray(goals.period, periods), ne(goals.status, "dropped"))),
    db()
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), inArray(projects.status, ["active", "someday"]))),
    db()
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), isNotNull(tasks.projectId), eq(tasks.status, "todo"), ne(tasks.when, "someday"))),
    db()
      .select({ projectId: tasks.projectId, last: sql<Date>`max(greatest(${tasks.updatedAt}, coalesce(${tasks.doneAt}, ${tasks.updatedAt})))` })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), isNotNull(tasks.projectId)))
      .groupBy(tasks.projectId),
    db()
      .select({ areaId: timeBlocks.areaId, minutes: sql<number>`sum(extract(epoch from (${timeBlocks.endAt} - ${timeBlocks.startAt})) / 60)::int` })
      .from(timeBlocks)
      .where(and(eq(timeBlocks.userId, userId), sql`${timeBlocks.date} >= ${weekFrom}`, sql`${timeBlocks.date} <= ${weekTo}`, isNotNull(timeBlocks.areaId)))
      .groupBy(timeBlocks.areaId),
  ]);

  const lastByProject = new Map(activity.map((a) => [a.projectId, new Date(a.last)]));
  const attentionByArea = new Map(attention.map((a) => [a.areaId, a.minutes ?? 0]));

  // Next action = the open task most likely to be done first: ranked, then dated, then oldest.
  const nextByProject = new Map<string, (typeof openTasks)[number]>();
  const countByProject = new Map<string, number>();
  const order = (t: (typeof openTasks)[number]) => [t.planRank ?? 99, t.scheduledDate ?? "9999", t.createdAt.getTime()] as const;
  for (const t of openTasks) {
    if (!t.projectId) continue;
    countByProject.set(t.projectId, (countByProject.get(t.projectId) ?? 0) + 1);
    const cur = nextByProject.get(t.projectId);
    if (!cur) nextByProject.set(t.projectId, t);
    else {
      const a = order(t);
      const b = order(cur);
      if (a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2])))) nextByProject.set(t.projectId, t);
    }
  }

  const projectViews = projectRows.map<ProjectView & { areaId: string }>((p) => ({
    id: p.id,
    areaId: p.areaId,
    title: p.title,
    goalId: p.goalId,
    status: p.status,
    deadline: p.deadline,
    openTasks: countByProject.get(p.id) ?? 0,
    nextAction: nextByProject.get(p.id)?.title ?? null,
    lastTouched: lastByProject.get(p.id) ?? p.updatedAt,
  }));

  return areaRows.map((area) => {
    const areaProjects = projectViews.filter((p) => p.areaId === area.id);
    const areaGoals = goalRows
      .filter((g) => g.areaId === area.id)
      .map<GoalView>((g) => {
        const touched = areaProjects.filter((p) => p.goalId === g.id).map((p) => p.lastTouched.getTime());
        return {
          id: g.id,
          title: g.title,
          horizon: g.horizon,
          period: g.period,
          keyResults: g.keyResults,
          confidence: g.confidence,
          status: g.status,
          lastTouched: new Date(Math.max(g.updatedAt.getTime(), ...touched)),
        };
      });
    return { area, goals: areaGoals, projects: areaProjects, attentionMin: attentionByArea.get(area.id) ?? 0 };
  });
}

export async function createGoal(
  userId: string,
  input: { areaId: string; title: string; horizon: "quarter" | "year"; period: string; keyResults: KeyResult[] },
): Promise<void> {
  await db().insert(goals).values({
    userId,
    areaId: input.areaId,
    title: input.title.trim(),
    horizon: input.horizon,
    period: input.period,
    keyResults: input.keyResults,
  });
}

export async function updateGoalProgress(
  userId: string,
  id: string,
  input: { currents: (number | null)[]; confidence?: number | null; status?: "active" | "achieved" | "dropped" },
): Promise<void> {
  const [g] = await db().select().from(goals).where(and(eq(goals.userId, userId), eq(goals.id, id))).limit(1);
  if (!g) throw new Error("Goal not found");
  const keyResults = g.keyResults.map((kr, i) => {
    const v = input.currents[i];
    return v == null || !Number.isFinite(v) ? kr : { ...kr, current: v };
  });
  await db()
    .update(goals)
    .set({
      keyResults,
      confidence: input.confidence === undefined ? g.confidence : input.confidence,
      status: input.status ?? g.status,
      updatedAt: new Date(),
    })
    .where(eq(goals.id, id));
}

export async function createProject(
  userId: string,
  input: { areaId: string; title: string; goalId?: string | null; deadline?: string | null },
): Promise<string> {
  const [row] = await db()
    .insert(projects)
    .values({ userId, areaId: input.areaId, title: input.title.trim(), goalId: input.goalId ?? null, deadline: input.deadline ?? null })
    .returning({ id: projects.id });
  return row.id;
}

export async function setProjectStatus(userId: string, id: string, status: "active" | "someday" | "done" | "archived"): Promise<void> {
  await db()
    .update(projects)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(projects.userId, userId), eq(projects.id, id)));
}

export async function projectArea(userId: string, id: string) {
  const [p] = await db()
    .select({ areaId: projects.areaId })
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.id, id)))
    .limit(1);
  return p?.areaId ?? null;
}
