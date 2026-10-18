export type PlanTask = {
  id: string;
  status: "todo" | "done" | "dropped";
  planRank: number | null;
  estimateMin: number | null;
  doneAt?: Date | null;
};

export const MAX_TOP = 3;

export type DaySummary = {
  open: number;
  done: number;
  total: number;
  plannedMin: number;
  doneMin: number;
  unestimated: number;
  over: boolean;
  capacityMin: number;
};

/** Numbers behind the Planned and Done tiles. Dropped tasks never count. */
export function summarizeDay(tasks: PlanTask[], capacityMin: number): DaySummary {
  const live = tasks.filter((t) => t.status !== "dropped");
  const open = live.filter((t) => t.status === "todo");
  const done = live.filter((t) => t.status === "done");
  const sum = (ts: PlanTask[]) => ts.reduce((a, t) => a + (t.estimateMin ?? 0), 0);
  const plannedMin = sum(open);
  return {
    open: open.length,
    done: done.length,
    total: live.length,
    plannedMin,
    doneMin: sum(done),
    unestimated: open.filter((t) => t.estimateMin == null).length,
    over: plannedMin + sum(done) > capacityMin,
    capacityMin,
  };
}

/** Top 3 first (by rank), then everything else in the order given. */
export function splitTop<T extends PlanTask>(tasks: T[]): { top: T[]; rest: T[] } {
  const ranked = tasks
    .filter((t) => t.planRank != null && t.planRank >= 1 && t.planRank <= MAX_TOP)
    .sort((a, b) => a.planRank! - b.planRank!);
  const ids = new Set(ranked.map((t) => t.id));
  return { top: ranked, rest: tasks.filter((t) => !ids.has(t.id)) };
}

/** Next free Top-3 slot, or null if all three are taken. */
export function nextFreeRank(tasks: PlanTask[]): number | null {
  const used = new Set(tasks.filter((t) => t.status === "todo" && t.planRank != null).map((t) => t.planRank));
  for (let r = 1; r <= MAX_TOP; r++) if (!used.has(r)) return r;
  return null;
}
