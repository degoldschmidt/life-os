import { and, desc, eq } from "drizzle-orm";
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
