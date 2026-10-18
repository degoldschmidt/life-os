export type TaskCounts = { planned: number; done: number; plannedMin: number; doneMin: number };

/** done ÷ planned, null when nothing was planned. */
export function plannedVsDone(c: Pick<TaskCounts, "planned" | "done">): number | null {
  return c.planned > 0 ? c.done / c.planned : null;
}

export type AreaStat = { code: string; targetMin: number; scheduledMin: number; doneTasks: number };

/** Areas that got well under their target (default: under half), worst first. */
export function neglectedAreas(areas: AreaStat[], fraction = 0.5): AreaStat[] {
  return areas
    .filter((a) => a.targetMin > 0 && a.scheduledMin < a.targetMin * fraction)
    .sort((a, b) => a.scheduledMin / a.targetMin - b.scheduledMin / b.targetMin);
}

export type ScoreInput = {
  tasks: TaskCounts;
  deepMin: number;
  habitRate: number | null;
  mood: number | null;
  energy: number | null;
  areas: AreaStat[];
  answers: Record<string, unknown>;
};

/** Flat key/value rows stored next to a finished review so charts never parse JSON. */
export function extractScores(i: ScoreInput): Record<string, number> {
  const out: Record<string, number> = {
    tasks_planned: i.tasks.planned,
    tasks_done: i.tasks.done,
    planned_min: i.tasks.plannedMin,
    done_min: i.tasks.doneMin,
    deep_min: i.deepMin,
  };
  const rate = plannedVsDone(i.tasks);
  if (rate != null) out.planned_vs_done = Math.round(rate * 1000) / 1000;
  if (i.habitRate != null) out.habit_rate = Math.round(i.habitRate * 1000) / 1000;
  if (i.mood != null) out.mood = Math.round(i.mood * 100) / 100;
  if (i.energy != null) out.energy = Math.round(i.energy * 100) / 100;
  for (const a of i.areas) {
    out[`area_min:${a.code}`] = a.scheduledMin;
    out[`area_done:${a.code}`] = a.doneTasks;
  }
  const rated = i.answers.area_scores;
  if (rated && typeof rated === "object") {
    for (const [code, v] of Object.entries(rated as Record<string, unknown>)) {
      if (typeof v === "number" && v >= 1 && v <= 10) out[`area_score:${code}`] = v;
    }
  }
  const sat = i.answers.satisfaction;
  if (typeof sat === "number") out.satisfaction = sat;
  return out;
}

/** Clean a list of free-text outcomes: trim, drop blanks, keep at most `max`. */
export function cleanTop(values: unknown, max = 3): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, max);
}
