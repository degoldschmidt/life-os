import { z } from "zod";
import type { PeriodStats } from "@/lib/services/stats";

/* ---------- review draft ---------- */

export const ReviewDraftSchema = z.object({
  answers: z.array(z.object({ id: z.string(), text: z.string() })),
});
export type ReviewDraft = z.infer<typeof ReviewDraftSchema>;

const SYSTEM_BASE =
  "You help one person run their personal planning and review system. Write in the first person, as a draft they will edit. " +
  "Use only the data provided; never invent events, feelings or numbers. When the data is thin, say so briefly instead of padding. " +
  "Be concrete and calm. No praise for its own sake, no advice nobody asked for.";

export const REVIEW_SYSTEM = `${SYSTEM_BASE} Answer each question in one to three plain sentences.`;

const hours = (min: number) => `${(min / 60).toFixed(1)} h`;

/** Compact, readable facts for the model. Numbers only appear if they exist. */
export function statsBrief(s: PeriodStats): string {
  const lines = [
    `Period: ${s.period.id} (${s.period.start} to ${s.period.end}, ${s.days} days)`,
    `Tasks: ${s.tasks.done} done of ${s.tasks.planned} planned${s.tasks.rate != null ? ` (${Math.round(s.tasks.rate * 100)}%)` : ""}`,
    `Deep work: ${hours(s.deepMin)} of ${hours(s.scheduledMin)} scheduled`,
    s.habitRate != null ? `Habits: ${Math.round(s.habitRate * 100)}% completion (${s.habits.map((h) => `${h.name} ${h.done}/${h.due}`).join(", ")})` : "Habits: none tracked",
    s.mood != null ? `Mood average ${s.mood.toFixed(1)}/5, energy ${s.energy != null ? s.energy.toFixed(1) : "n/a"}/5` : "Mood: not recorded",
    `Shutdowns completed: ${s.dayReviews} of ${s.days} days`,
    "Attention by area (scheduled vs target): " + s.areas.map((a) => `${a.code} ${hours(a.scheduledMin)} / ${hours(a.targetMin)}`).join("; "),
  ];
  if (s.goals.length) lines.push("Goals: " + s.goals.map((g) => `${g.title} (${g.areaCode}, ${g.progress == null ? "no key results" : Math.round(g.progress * 100) + "%"}${g.confidence != null ? `, confidence ${g.confidence}/10` : ""})`).join("; "));
  if (s.projectsNoNext.length) lines.push("Projects without a next action: " + s.projectsNoNext.map((p) => p.title).join(", "));
  return lines.join("\n");
}

export function reviewPrompt(input: { stats: PeriodStats; journal: string[]; questions: { id: string; prompt: string }[] }): string {
  const journal = input.journal.length ? input.journal.map((j) => `- ${j.replace(/\s+/g, " ").slice(0, 400)}`).join("\n") : "(no journal entries)";
  return [
    "Facts for the period:",
    statsBrief(input.stats),
    "",
    "Journal entries from the period:",
    journal,
    "",
    "Draft an answer for each question. Return one entry per question id.",
    ...input.questions.map((q) => `- ${q.id}: ${q.prompt}`),
  ].join("\n");
}

/** Keep only answers for known question ids, trimmed and non-empty, one per id. */
export function cleanDraft(draft: ReviewDraft, questionIds: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of draft.answers) {
    if (questionIds.includes(a.id) && !(a.id in out) && a.text.trim()) out[a.id] = a.text.trim().slice(0, 1200);
  }
  return out;
}

/* ---------- tomorrow's top 3 ---------- */

export const TopSchema = z.object({
  picks: z.array(z.object({ id: z.string(), reason: z.string() })),
});

export const TOP_SYSTEM =
  "You help one person choose the few tasks that matter most for a day. Prefer tasks that move a goal, have a deadline soon, or have been waiting long. " +
  "Respect the capacity: do not pick more work than fits. Pick at most three and give each a one-sentence reason in plain words. Use only the task ids provided.";

export type Candidate = { id: string; title: string; areaCode: string | null; estimateMin: number | null; deadline: string | null; project: string | null };

export function topPrompt(input: { day: string; capacityMin: number; candidates: Candidate[]; goals: string[]; busyMin: number }): string {
  return [
    `Day: ${input.day}. Planned-hours capacity: ${hours(input.capacityMin)}. Already booked in the calendar: ${hours(input.busyMin)}.`,
    input.goals.length ? `Current goals: ${input.goals.join("; ")}` : "No goals set.",
    "",
    "Candidate tasks:",
    ...input.candidates.map((c) => `- ${c.id} | ${c.title}${c.areaCode ? ` [${c.areaCode}]` : ""}${c.estimateMin ? ` ~${c.estimateMin}m` : ""}${c.deadline ? ` due ${c.deadline}` : ""}${c.project ? ` (project: ${c.project})` : ""}`),
  ].join("\n");
}

/** Only ids that exist, no repeats, at most three, in the order given. */
export function validatePicks(picks: { id: string; reason: string }[], candidateIds: string[]): { id: string; reason: string }[] {
  const seen = new Set<string>();
  const out: { id: string; reason: string }[] = [];
  for (const p of picks) {
    if (!candidateIds.includes(p.id) || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ id: p.id, reason: p.reason.trim().slice(0, 240) });
    if (out.length === 3) break;
  }
  return out;
}

/* ---------- brain dump ---------- */

export const DumpSchema = z.object({
  tasks: z.array(z.object({ title: z.string(), area: z.string().nullable(), estimateMin: z.number().nullable(), due: z.string().nullable(), project: z.string().nullable() })),
  projects: z.array(z.object({ title: z.string(), area: z.string().nullable() })),
  goals: z.array(z.object({ title: z.string(), area: z.string().nullable(), horizon: z.enum(["quarter", "year"]), keyResults: z.array(z.string()) })),
  habits: z.array(z.object({ name: z.string(), area: z.string().nullable(), rhythm: z.enum(["daily", "weekdays", "weekly"]) })),
});
export type Dump = z.infer<typeof DumpSchema>;

export const DUMP_SYSTEM =
  "You turn a person's messy notes into items for their planning system. Sort each thing into exactly one of: task (one concrete action), project (an outcome needing several actions), " +
  "goal (something to achieve this quarter or year, with measurable key results written as 'metric | target | unit'), or habit (a recurring behaviour). " +
  "Keep the person's own wording. Do not invent items that are not in the notes. Assign an area code only when it is clear. Dates must be YYYY-MM-DD and only when stated.";

export function dumpPrompt(text: string, areaCodes: { code: string; name: string }[], today: string): string {
  return [
    `Today is ${today}. Area codes: ${areaCodes.map((a) => `${a.code} (${a.name})`).join(", ")}.`,
    "",
    "Notes:",
    text.slice(0, 20000),
  ].join("\n");
}

/** Normalise model output: valid area codes only, valid ISO dates only, sane estimates, no blank titles. */
export function cleanDump(d: Dump, areaCodes: string[]): Dump {
  const area = (a: string | null) => (a && areaCodes.includes(a.toUpperCase()) ? a.toUpperCase() : null);
  const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const nonBlank = <T extends { title: string }>(x: T) => x.title.trim().length > 0;
  return {
    tasks: d.tasks.filter(nonBlank).map((t) => ({ ...t, title: t.title.trim(), area: area(t.area), due: date(t.due), estimateMin: t.estimateMin && t.estimateMin > 0 && t.estimateMin <= 960 ? Math.round(t.estimateMin) : null, project: t.project?.trim() || null })),
    projects: d.projects.filter(nonBlank).map((p) => ({ title: p.title.trim(), area: area(p.area) })),
    goals: d.goals.filter(nonBlank).map((g) => ({ ...g, title: g.title.trim(), area: area(g.area), keyResults: g.keyResults.map((k) => k.trim()).filter(Boolean).slice(0, 3) })),
    habits: d.habits.filter((h) => h.name.trim()).map((h) => ({ ...h, name: h.name.trim(), area: area(h.area) })),
  };
}
