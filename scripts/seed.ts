import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import { DEFAULT_AREAS, TEMPLATES } from "../lib/rituals/templates";

/**
 * Seed areas, settings and ritual templates for the single allowed user.
 * Idempotent: safe to re-run. Requires the user to have signed in once
 * (so auth.users has a row) or SEED_USER_ID to be set.
 */
async function main() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(sql, { schema });

  let userId = process.env.SEED_USER_ID;
  if (!userId) {
    const email = process.env.AUTH_ALLOWED_EMAIL;
    if (!email) throw new Error("Set AUTH_ALLOWED_EMAIL or SEED_USER_ID");
    const rows = await sql<{ id: string }[]>`select id from auth.users where email = ${email} limit 1`;
    if (!rows[0]) throw new Error(`No auth user with email ${email}. Sign in once first.`);
    userId = rows[0].id;
  }

  await db
    .insert(schema.settings)
    .values({ userId })
    .onConflictDoNothing();

  await db
    .insert(schema.areas)
    .values(DEFAULT_AREAS.map((a) => ({ ...a, userId })))
    .onConflictDoNothing({ target: [schema.areas.userId, schema.areas.code] });

  await db
    .insert(schema.reviewTemplates)
    .values(TEMPLATES.map((t) => ({ type: t.type, version: t.version, name: t.name, steps: t.steps })))
    .onConflictDoNothing({ target: [schema.reviewTemplates.type, schema.reviewTemplates.version] });

  console.log(`Seeded settings, ${DEFAULT_AREAS.length} areas and ${TEMPLATES.length} templates for ${userId}`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
