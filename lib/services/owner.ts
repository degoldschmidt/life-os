import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * The single user's id, for background jobs that run without a browser session.
 * Looked up by AUTH_ALLOWED_EMAIL in Supabase's auth.users table.
 */
export async function ownerUserId(): Promise<string | null> {
  const email = process.env.AUTH_ALLOWED_EMAIL;
  if (!email) return null;
  const rows = (await db().execute(sql`select id from auth.users where lower(email) = lower(${email}) limit 1`)) as unknown as { id: string }[];
  return rows[0]?.id ?? null;
}
