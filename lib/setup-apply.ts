import { z } from "zod";
import { parseKeyResults } from "@/lib/goals";

export const AREA = z.string().length(3).nullable();

export const SelectionSchema = z.object({
  tasks: z.array(z.object({ title: z.string().trim().min(1).max(500), area: AREA, estimateMin: z.number().int().min(1).max(960).nullable(), due: z.iso.date().nullable(), project: z.string().trim().max(200).nullable() })).max(200),
  projects: z.array(z.object({ title: z.string().trim().min(1).max(200), area: AREA })).max(50),
  goals: z.array(z.object({ title: z.string().trim().min(1).max(200), area: AREA, horizon: z.enum(["quarter", "year"]), keyResults: z.array(z.string().max(200)).max(3) })).max(30),
  habits: z.array(z.object({ name: z.string().trim().min(1).max(80), area: AREA, rhythm: z.enum(["daily", "weekdays", "weekly"]) })).max(10),
});
export type Selection = z.infer<typeof SelectionSchema>;

export const rhythmToSchedule = (r: "daily" | "weekdays" | "weekly") =>
  r === "daily" ? { days: [1, 2, 3, 4, 5, 6, 7] } : r === "weekdays" ? { days: [1, 2, 3, 4, 5] } : { perWeek: 1 };

/** Key results arrive as "metric | target | unit" lines. */
export const krFromLines = (lines: string[]) => parseKeyResults(lines.join("\n"));

/** Case-insensitive de-duplication that keeps the first of each title. */
export function dedupeTitles<T>(items: T[], titleOf: (t: T) => string, already: Set<string>): { keep: T[]; skipped: number } {
  const seen = new Set(already);
  const keep: T[] = [];
  let skipped = 0;
  for (const it of items) {
    const k = titleOf(it).trim().toLowerCase();
    if (!k || seen.has(k)) { skipped++; continue; }
    seen.add(k);
    keep.push(it);
  }
  return { keep, skipped };
}
