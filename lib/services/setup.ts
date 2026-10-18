import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type SetupProgress = { goals: number; habits: number; tasks: number; notes: number; projects: number };

/** Rough counts of what the person has put in so far, to drive the setup page and the empty-state prompt. */
export async function setupProgress(userId: string): Promise<SetupProgress> {
  const count = async (table: typeof schema.goals | typeof schema.tasks | typeof schema.notes | typeof schema.projects, extra?: ReturnType<typeof and>) => {
    const [r] = await db().select({ n: sql<number>`count(*)::int` }).from(table).where(extra ? and(eq(table.userId, userId), extra) : eq(table.userId, userId));
    return r?.n ?? 0;
  };
  const [goals, tasks, notes, projects, [h]] = await Promise.all([
    count(schema.goals),
    count(schema.tasks, eq(schema.tasks.status, "todo")),
    count(schema.notes),
    count(schema.projects),
    db().select({ n: sql<number>`count(*)::int` }).from(schema.habits).where(and(eq(schema.habits.userId, userId), isNull(schema.habits.archivedAt))),
  ]);
  return { goals, habits: h?.n ?? 0, tasks, notes, projects };
}

export const isEmptyStart = (p: SetupProgress) => p.goals === 0 && p.habits === 0 && p.tasks === 0 && p.projects === 0;
