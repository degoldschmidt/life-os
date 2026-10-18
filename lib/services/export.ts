import { eq } from "drizzle-orm";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { strToU8 } from "fflate";
import { db, schema } from "@/lib/db";
import { areasNote, dayNote, reviewNote, slug, type MdEntry } from "@/lib/export-md";
import type { ReviewQuestion } from "@/lib/db/schema";

const s = schema;

/** Every table a user owns, as plain JSON. Secrets (OAuth tokens, push keys) are deliberately left out. */
export async function exportData(userId: string) {
  const own = <T extends { userId: unknown }>(t: T) => eq(t.userId as never, userId);
  // Small batches: Supabase's pooler can stall when a dozen queries arrive at once.
  const [areas, goals, projects, tasks] = await Promise.all([
    db().select().from(s.areas).where(own(s.areas)),
    db().select().from(s.goals).where(own(s.goals)),
    db().select().from(s.projects).where(own(s.projects)),
    db().select().from(s.tasks).where(own(s.tasks)),
  ]);
  const [timeBlocks, habits, habitLogs, journalEntries] = await Promise.all([
    db().select().from(s.timeBlocks).where(own(s.timeBlocks)),
    db().select().from(s.habits).where(own(s.habits)),
    db().select().from(s.habitLogs).where(own(s.habitLogs)),
    db().select().from(s.journalEntries).where(own(s.journalEntries)),
  ]);
  const [reviews, reviewScores, notes, settings, templates] = await Promise.all([
    db().select().from(s.reviews).where(own(s.reviews)),
    db().select().from(s.reviewScores).where(own(s.reviewScores)),
    db().select().from(s.notes).where(own(s.notes)),
    db().select().from(s.settings).where(eq(s.settings.userId, userId)),
    db().select().from(s.reviewTemplates),
  ]);
  return {
    app: "life-os",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    counts: { tasks: tasks.length, journalEntries: journalEntries.length, reviews: reviews.length },
    areas, goals, projects, tasks, timeBlocks, habits, habitLogs, journalEntries, reviews, reviewScores, notes, settings, reviewTemplates: templates,
  };
}

export type ExportData = Awaited<ReturnType<typeof exportData>>;

/** An Obsidian-compatible Markdown vault, one file per day, review and note. */
export function buildVault(data: ExportData, tz: string): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const put = (path: string, text: string) => { files[path] = strToU8(text); };
  const local = (d: Date) => new TZDate(d, tz);
  const dayOf = (d: Date) => format(local(d), "yyyy-MM-dd");

  put("README.md", `# Life OS export\n\nExported ${data.exportedAt}. One file per day in \`daily/\`, reviews in \`reviews/\`, areas and goals at the top level.\n`);
  put("areas.md", areasNote(data.areas.map((a) => ({ code: a.code, name: a.name, standard: a.standard, weeklyTargetHours: a.weeklyTargetHours, satisfaction: a.satisfaction }))));

  const areaCode = new Map(data.areas.map((a) => [a.id, a.code]));
  const goalLines = ["# Goals and projects", ""];
  for (const g of data.goals) {
    goalLines.push(`## ${g.title} (${areaCode.get(g.areaId) ?? "?"}, ${g.period})`, "");
    for (const kr of g.keyResults) goalLines.push(`- ${kr.metric}: ${kr.current}/${kr.target}${kr.unit ? ` ${kr.unit}` : ""}`);
    if (g.confidence != null) goalLines.push("", `Confidence ${g.confidence}/10`);
    for (const p of data.projects.filter((p) => p.goalId === g.id)) goalLines.push("", `- Project: ${p.title} (${p.status})`);
    goalLines.push("");
  }
  const loose = data.projects.filter((p) => !p.goalId);
  if (loose.length) goalLines.push("## Projects without a goal", "", ...loose.map((p) => `- ${p.title} (${areaCode.get(p.areaId) ?? "?"}, ${p.status})`), "");
  put("goals.md", goalLines.join("\n").trimEnd() + "\n");

  // Daily notes: every day with a journal entry or a finished task.
  const days = new Set<string>();
  for (const e of data.journalEntries) days.add(e.date);
  const doneByDay = new Map<string, string[]>();
  for (const t of data.tasks) {
    if (t.status === "done" && t.doneAt) {
      const d = dayOf(t.doneAt);
      days.add(d);
      if (!doneByDay.has(d)) doneByDay.set(d, []);
      doneByDay.get(d)!.push(t.title);
    }
  }
  for (const day of [...days].sort()) {
    const entries: MdEntry[] = data.journalEntries
      .filter((e) => e.date === day)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((e) => ({ kind: e.kind, time: format(local(e.createdAt), "HH:mm"), text: e.contentMd, mood: e.mood, energy: e.energy }));
    put(`daily/${day}.md`, dayNote(day, entries, doneByDay.get(day) ?? []));
  }

  const tplById = new Map(data.reviewTemplates.map((t) => [t.id, t]));
  const scoresByReview = new Map<string, Record<string, number>>();
  for (const sc of data.reviewScores) {
    if (!scoresByReview.has(sc.reviewId)) scoresByReview.set(sc.reviewId, {});
    scoresByReview.get(sc.reviewId)![sc.key] = sc.value;
  }
  for (const r of data.reviews) {
    const questions = (tplById.get(r.templateId)?.steps ?? []).flatMap((st) => st.questions as ReviewQuestion[]);
    put(
      `reviews/${r.type}/${r.periodId}.md`,
      reviewNote({
        type: r.type, periodId: r.periodId, start: r.periodStart, end: r.periodEnd, status: r.status,
        questions: questions.map((q) => ({ id: q.id, prompt: q.prompt })),
        answers: r.answers as Record<string, unknown>,
        nextTop3: (r.nextTop3 ?? []) as string[],
        scores: scoresByReview.get(r.id) ?? {},
      }),
    );
  }

  const used = new Set<string>();
  for (const n of data.notes) {
    let name = slug(n.title);
    for (let i = 2; used.has(name); i++) name = `${slug(n.title)}-${i}`;
    used.add(name);
    put(`notes/${name}.md`, `---\nsource: ${n.source}\n---\n\n# ${n.title}\n\n${n.contentMd}\n`);
  }
  return files;
}
