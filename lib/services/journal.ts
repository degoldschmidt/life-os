import { and, asc, desc, eq, gte, lte, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { DayKey } from "@/lib/dates";

const { journalEntries } = schema;

/** Today's intention, stored as the day's single "morning" journal entry. */
export async function getMorningIntention(userId: string, day: DayKey): Promise<string | null> {
  const [row] = await db()
    .select({ text: journalEntries.contentMd })
    .from(journalEntries)
    .where(and(eq(journalEntries.userId, userId), eq(journalEntries.date, day), eq(journalEntries.kind, "morning")))
    .orderBy(desc(journalEntries.createdAt))
    .limit(1);
  return row?.text?.trim() ? row.text : null;
}

/** Replace the day's intention. An empty string clears it. */
export async function setMorningIntention(userId: string, day: DayKey, text: string): Promise<void> {
  await db().transaction(async (tx) => {
    await tx
      .delete(journalEntries)
      .where(and(eq(journalEntries.userId, userId), eq(journalEntries.date, day), eq(journalEntries.kind, "morning")));
    if (text.trim()) {
      await tx.insert(journalEntries).values({ userId, date: day, kind: "morning", contentMd: text.trim() });
    }
  });
}

export type JournalEntry = typeof journalEntries.$inferSelect;

export async function listDayEntries(userId: string, day: DayKey): Promise<JournalEntry[]> {
  return db()
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.userId, userId), eq(journalEntries.date, day)))
    .orderBy(asc(journalEntries.createdAt));
}

/** A short timestamped line, written between tasks ("interstitial journaling"). */
export async function addInterstitial(userId: string, day: DayKey, text: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  await db().insert(journalEntries).values({ userId, date: day, kind: "interstitial", contentMd: clean });
}

/**
 * The day's single freeform note, with optional mood and energy (1–5).
 * Saving with nothing in it removes the note.
 */
export async function saveDayNote(
  userId: string,
  day: DayKey,
  input: { text: string; mood?: number | null; energy?: number | null },
): Promise<void> {
  const text = input.text.trim();
  const mood = input.mood ?? null;
  const energy = input.energy ?? null;
  const [existing] = await db()
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(eq(journalEntries.userId, userId), eq(journalEntries.date, day), eq(journalEntries.kind, "freeform")))
    .limit(1);
  if (!text && mood === null && energy === null) {
    if (existing) await db().delete(journalEntries).where(eq(journalEntries.id, existing.id));
    return;
  }
  if (existing) {
    await db()
      .update(journalEntries)
      .set({ contentMd: text, mood, energy, updatedAt: new Date() })
      .where(eq(journalEntries.id, existing.id));
  } else {
    await db().insert(journalEntries).values({ userId, date: day, kind: "freeform", contentMd: text, mood, energy });
  }
}

/** Only entries the user typed themselves can be deleted; shutdown and morning entries belong to their rituals. */
export async function deleteEntry(userId: string, id: string): Promise<void> {
  await db()
    .delete(journalEntries)
    .where(
      and(
        eq(journalEntries.userId, userId),
        eq(journalEntries.id, id),
        or(eq(journalEntries.kind, "interstitial"), eq(journalEntries.kind, "freeform")),
      ),
    );
}

export type DayDigest = { day: DayKey; entries: number; snippet: string; mood: number | null; energy: number | null };

/** One line per day for the recent-days list. Mood and energy take the latest value recorded that day. */
export async function recentDays(userId: string, since: DayKey, until: DayKey): Promise<DayDigest[]> {
  const rows = await db()
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.userId, userId), gte(journalEntries.date, since), lte(journalEntries.date, until)))
    .orderBy(desc(journalEntries.date), asc(journalEntries.createdAt));
  const byDay = new Map<DayKey, JournalEntry[]>();
  for (const r of rows) {
    if (!byDay.has(r.date)) byDay.set(r.date, []);
    byDay.get(r.date)!.push(r);
  }
  return [...byDay.entries()].map(([day, list]) => {
    const text = list.find((e) => e.kind === "freeform" && e.contentMd.trim()) ?? list.find((e) => e.kind === "shutdown" && e.contentMd.trim()) ?? list.find((e) => e.contentMd.trim());
    const withMood = [...list].reverse().find((e) => e.mood != null);
    const withEnergy = [...list].reverse().find((e) => e.energy != null);
    return {
      day,
      entries: list.length,
      snippet: (text?.contentMd ?? "").replace(/\s+/g, " ").slice(0, 120),
      mood: withMood?.mood ?? null,
      energy: withEnergy?.energy ?? null,
    };
  });
}

/** Text the user wrote in a period (notes, day notes, shutdown reflections), oldest first. */
export async function entryTextsInRange(userId: string, from: DayKey, to: DayKey, limit = 60): Promise<string[]> {
  const rows = await db()
    .select({ date: journalEntries.date, kind: journalEntries.kind, text: journalEntries.contentMd })
    .from(journalEntries)
    .where(and(eq(journalEntries.userId, userId), gte(journalEntries.date, from), lte(journalEntries.date, to)))
    .orderBy(asc(journalEntries.date), asc(journalEntries.createdAt))
    .limit(limit);
  return rows.filter((r) => r.text.trim()).map((r) => `${r.date} (${r.kind}) ${r.text.trim()}`);
}
