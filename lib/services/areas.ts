import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type Area = typeof schema.areas.$inferSelect;

export async function listAreas(userId: string): Promise<Area[]> {
  return db()
    .select()
    .from(schema.areas)
    .where(and(eq(schema.areas.userId, userId), isNull(schema.areas.archivedAt)))
    .orderBy(asc(schema.areas.sort));
}

export async function areaIdByCode(userId: string, code: string): Promise<string | null> {
  const [row] = await db()
    .select({ id: schema.areas.id })
    .from(schema.areas)
    .where(and(eq(schema.areas.userId, userId), eq(schema.areas.code, code.toUpperCase())))
    .limit(1);
  return row?.id ?? null;
}
