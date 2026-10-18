import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Single Postgres connection pool, reused across hot reloads in dev.
 * Supabase's transaction pooler (port 6543) does not support prepared
 * statements, hence `prepare: false`.
 */
const globalForDb = globalThis as unknown as { __lifeosSql?: ReturnType<typeof postgres> };

function getSql() {
  if (!globalForDb.__lifeosSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.__lifeosSql = postgres(url, { prepare: false, max: 5 });
  }
  return globalForDb.__lifeosSql;
}

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function db() {
  if (!_db) _db = drizzle(getSql(), { schema });
  return _db;
}

export type Db = ReturnType<typeof db>;
export { schema };
