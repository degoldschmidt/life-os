import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { notes, tasks, journalEntries } = schema;

export async function addNote(userId: string, input: { title: string; content: string; source?: "manual" | "notion" | "apple_notes"; externalId?: string | null; areaId?: string | null }) {
  const [row] = await db()
    .insert(notes)
    .values({ userId, title: input.title.trim() || "Untitled", contentMd: input.content, source: input.source ?? "manual", externalId: input.externalId ?? null, areaId: input.areaId ?? null })
    .onConflictDoNothing()
    .returning({ id: notes.id });
  return row?.id ?? null;
}

/** Escape LIKE wildcards so a search for "100%" doesn't match everything. */
export function likePattern(q: string): string {
  return `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export type SearchHit = { kind: "task" | "note" | "journal"; id: string; title: string; snippet: string; date?: string };

/** Case-insensitive search across task titles, notes and journal text. */
export async function searchAll(userId: string, query: string, limit = 20): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const pat = likePattern(q);
  const [t, n, j] = await Promise.all([
    db().select({ id: tasks.id, title: tasks.title, notes: tasks.notes, status: tasks.status }).from(tasks).where(and(eq(tasks.userId, userId), or(ilike(tasks.title, pat), ilike(tasks.notes, pat)))).orderBy(desc(tasks.updatedAt)).limit(limit),
    db().select({ id: notes.id, title: notes.title, content: notes.contentMd }).from(notes).where(and(eq(notes.userId, userId), or(ilike(notes.title, pat), ilike(notes.contentMd, pat)))).orderBy(desc(notes.updatedAt)).limit(limit),
    db().select({ id: journalEntries.id, date: journalEntries.date, text: journalEntries.contentMd }).from(journalEntries).where(and(eq(journalEntries.userId, userId), ilike(journalEntries.contentMd, pat))).orderBy(desc(journalEntries.date)).limit(limit),
  ]);
  const snip = (s: string) => {
    const i = s.toLowerCase().indexOf(q.toLowerCase());
    const from = Math.max(0, i - 40);
    return s.slice(from, from + 140).replace(/\s+/g, " ").trim();
  };
  return [
    ...t.map<SearchHit>((x) => ({ kind: "task", id: x.id, title: x.title, snippet: x.status })),
    ...n.map<SearchHit>((x) => ({ kind: "note", id: x.id, title: x.title, snippet: snip(x.content) })),
    ...j.map<SearchHit>((x) => ({ kind: "journal", id: x.id, title: x.date, snippet: snip(x.text), date: x.date })),
  ].slice(0, limit);
}
