import { TZDate } from "@date-fns/tz";
import type { DayKey } from "@/lib/dates";

export const GRID_START_MIN = 6 * 60; // 06:00
export const GRID_END_MIN = 22 * 60; // 22:00
export const SNAP_MIN = 15;
export const DEFAULT_DURATION_MIN = 60;

/** Local wall-clock time on a day, as an absolute instant. DST-safe: built from y/m/d/h/min in the zone. */
export function minutesToInstant(day: DayKey, minutes: number, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, tz);
  return new Date(dt.getTime());
}

/** Minutes since local midnight for an instant, in the zone. */
export function instantToMinutes(instant: Date, tz: string): number {
  const z = new TZDate(instant, tz);
  return z.getHours() * 60 + z.getMinutes();
}

export function snap(minutes: number, step: number = SNAP_MIN): number {
  return Math.round(minutes / step) * step;
}

export function clampStart(startMin: number, durationMin: number): number {
  return Math.max(GRID_START_MIN, Math.min(startMin, GRID_END_MIN - durationMin));
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type Placed = { id: string; startMin: number; endMin: number };
export type Laid<T extends Placed> = T & { col: number; cols: number };

/**
 * Side-by-side layout for overlapping blocks. Blocks that overlap (directly or through a chain)
 * share a cluster, and each gets a column inside it so nothing is hidden.
 */
export function layoutOverlaps<T extends Placed>(items: T[]): Laid<T>[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: Laid<T>[] = [];
  let cluster: Laid<T>[] = [];
  let clusterEnd = -1;
  let colEnds: number[] = [];

  const flush = () => {
    const cols = colEnds.length || 1;
    for (const c of cluster) c.cols = cols;
    out.push(...cluster);
    cluster = [];
    colEnds = [];
    clusterEnd = -1;
  };

  for (const it of sorted) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= it.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(it.endMin);
    } else {
      colEnds[col] = it.endMin;
    }
    clusterEnd = Math.max(clusterEnd, it.endMin);
    cluster.push({ ...it, col, cols: 1 });
  }
  if (cluster.length) flush();
  return out;
}

export function blockMinutes(b: { startMin: number; endMin: number }): number {
  return Math.max(0, b.endMin - b.startMin);
}
