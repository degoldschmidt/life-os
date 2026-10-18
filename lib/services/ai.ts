import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { parseCapture } from "@/lib/capture/parse";
import { parsePeriodId, periodFor, type DayKey, type ReviewType } from "@/lib/dates";
import { runStructured, type AiResult } from "@/lib/ai/run";
import {
  cleanDraft,
  cleanDump,
  DUMP_SYSTEM,
  DumpSchema,
  dumpPrompt,
  REVIEW_SYSTEM,
  ReviewDraftSchema,
  reviewPrompt,
  TOP_SYSTEM,
  TopSchema,
  topPrompt,
  validatePicks,
  type Candidate,
  type Dump,
} from "@/lib/ai/prompts";
import { listAreas } from "@/lib/services/areas";
import { listBlocks } from "@/lib/services/blocks";
import { listCalendarEvents } from "@/lib/services/calendar";
import { areaOverview } from "@/lib/services/goals";
import { entryTextsInRange } from "@/lib/services/journal";
import { getOrCreateReview } from "@/lib/services/reviews";
import type { Settings } from "@/lib/services/settings";
import { computePeriodStats } from "@/lib/services/stats";
import { listAnytime, listDay, listInbox, listStale } from "@/lib/services/tasks";
import type { ReviewQuestion } from "@/lib/db/schema";

/** Draft answers for the text questions of a review, from the period's real numbers and journal. */
export async function draftReview(userId: string, settings: Settings, type: Exclude<ReviewType, "day">, periodId: string): Promise<AiResult<Record<string, string>>> {
  const period = parsePeriodId(periodId, settings.tz);
  if (!period || period.type !== type) return { ok: false, error: "Unknown period." };
  const { template } = await getOrCreateReview(userId, type, period);
  const questions = template.steps.flatMap((s) => s.questions as ReviewQuestion[]).filter((q) => q.kind === "text");
  if (questions.length === 0) return { ok: false, error: "This review has no written questions." };

  const goalPeriods = [periodFor("quarter", period.start, settings.tz).id, periodFor("year", period.start, settings.tz).id];
  const [stats, journal] = await Promise.all([computePeriodStats(userId, period, settings.tz, goalPeriods), entryTextsInRange(userId, period.start, period.end)]);

  const res = await runStructured({
    userId,
    feature: `review-draft:${type}`,
    model: settings.aiModel,
    system: REVIEW_SYSTEM,
    prompt: reviewPrompt({ stats, journal, questions: questions.map((q) => ({ id: q.id, prompt: q.prompt })) }),
    schema: ReviewDraftSchema,
    effort: "medium",
    stub: () => ({ answers: questions.map((q) => ({ id: q.id, text: `Draft for “${q.prompt}” (stub).` })) }),
  });
  if (!res.ok) return res;
  return { ok: true, data: cleanDraft(res.data, questions.map((q) => q.id)), costUsd: res.costUsd };
}

/** Suggest up to three tasks for a day from what is open, with a reason each. */
export async function suggestTop(userId: string, settings: Settings, day: DayKey): Promise<AiResult<{ id: string; reason: string }[]>> {
  const [dayTasks, stale, inbox, anytime] = await Promise.all([listDay(userId, day), listStale(userId, day), listInbox(userId), listAnytime(userId)]);
  const seen = new Set<string>();
  const open = [...dayTasks.filter((t) => t.status === "todo"), ...stale, ...anytime, ...inbox].filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true))).slice(0, 40);
  if (open.length === 0) return { ok: false, error: "No open tasks to choose from." };

  const projectIds = [...new Set(open.map((t) => t.projectId).filter((x): x is string => !!x))];
  const projectRows = projectIds.length ? await db().select({ id: schema.projects.id, title: schema.projects.title }).from(schema.projects).where(and(eq(schema.projects.userId, userId), inArray(schema.projects.id, projectIds))) : [];
  const projectTitle = new Map(projectRows.map((p) => [p.id, p.title]));
  const candidates: Candidate[] = open.map((t) => ({ id: t.id, title: t.title, areaCode: t.areaCode, estimateMin: t.estimateMin, deadline: t.deadline, project: t.projectId ? projectTitle.get(t.projectId) ?? null : null }));

  const week = periodFor("week", day, settings.tz);
  const overview = await areaOverview(userId, [periodFor("quarter", day, settings.tz).id, periodFor("year", day, settings.tz).id], week.start, week.end);
  const goals = overview.flatMap((o) => o.goals.filter((g) => g.status === "active").map((g) => g.title));
  const [events, blocks] = await Promise.all([listCalendarEvents(userId, day, day, settings.tz), listBlocks(userId, day, day, settings.tz)]);
  const busyMin = [...events.filter((e) => !e.allDay), ...blocks].reduce((a, b) => a + (b.endMin - b.startMin), 0);

  const res = await runStructured({
    userId,
    feature: "top3",
    model: settings.aiModel,
    system: TOP_SYSTEM,
    prompt: topPrompt({ day, capacityMin: settings.dailyCapacityMin, candidates, goals, busyMin }),
    schema: TopSchema,
    effort: "low",
    maxTokens: 1500,
    stub: () => ({ picks: candidates.slice(0, 3).map((c, i) => ({ id: c.id, reason: `Stub reason ${i + 1}.` })) }),
  });
  if (!res.ok) return res;
  const picks = validatePicks(res.data.picks, candidates.map((c) => c.id));
  if (picks.length === 0) return { ok: false, error: "Claude didn't pick anything usable. Try again." };
  return { ok: true, data: picks, costUsd: res.costUsd };
}

/**
 * Sort pasted notes into tasks, projects, goals and habits. Without Claude it falls back to one
 * task per line using the quick-capture parser, so the import works with no key at all.
 */
export async function analyzeDump(userId: string, settings: Settings, text: string, today: DayKey): Promise<AiResult<Dump> & { mode?: "claude" | "lines" }> {
  const areas = await listAreas(userId);
  const codes = areas.map((a) => a.code);
  const lines = text.split("\n").map((l) => l.replace(/^[\s\-*•\d.)\]]+/, "").trim()).filter(Boolean);

  const fallback = (): Dump =>
    cleanDump(
      {
        tasks: lines.map((l) => {
          const p = parseCapture(l, { tz: settings.tz, areaCodes: codes });
          return { title: p.title, area: p.areaCode, estimateMin: p.estimateMin, due: p.deadline ?? p.date, project: null };
        }),
        projects: [],
        goals: [],
        habits: [],
      },
      codes,
    );

  if (!process.env.ANTHROPIC_API_KEY && process.env.AI_STUB !== "1") return { ok: true, data: fallback(), costUsd: 0, mode: "lines" };

  const res = await runStructured({
    userId,
    feature: "brain-dump",
    model: settings.aiModel,
    system: DUMP_SYSTEM,
    prompt: dumpPrompt(text, areas.map((a) => ({ code: a.code, name: a.name })), today),
    schema: DumpSchema,
    effort: "medium",
    maxTokens: 8000,
    stub: () => ({ ...fallback(), projects: [], goals: [], habits: [] }),
  });
  if (!res.ok) return res;
  return { ok: true, data: cleanDump(res.data, codes), costUsd: res.costUsd, mode: "claude" };
}
