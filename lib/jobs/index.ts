import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";
import { exportData } from "@/lib/services/export";
import { ownerUserId } from "@/lib/services/owner";

export type JobResult = { ok: boolean; detail?: Record<string, unknown> };
export type Job = { name: string; description: string; run: () => Promise<JobResult> };

/**
 * Scheduled jobs. Vercel Hobby cron only fires once a day, so an external scheduler
 * (cron-job.org, GitHub Actions, anything that can send an HTTP request with a header)
 * calls /api/cron/<job> instead. See docs/SETUP.md.
 */
export const JOBS: Record<string, Job> = {
  heartbeat: {
    name: "heartbeat",
    description: "Touches the database and the Supabase API so the free project never pauses.",
    async run() {
      const detail: Record<string, unknown> = {};
      if (process.env.DATABASE_URL) {
        const rows = await db().execute(sql`select now() as now`);
        detail.db = (rows as unknown as { now: string }[])[0]?.now ?? "ok";
      } else {
        detail.db = "skipped: DATABASE_URL not set";
      }
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) {
        try {
          const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, cache: "no-store" });
          detail.api = res.status;
        } catch (e) {
          detail.api = `unreachable: ${e instanceof Error ? e.message : String(e)}`;
        }
      } else {
        detail.api = "skipped: Supabase not configured";
      }
      return { ok: true, detail };
    },
  },
  backup: {
    name: "backup",
    description: "Nightly JSON backup to the private 'backups' storage bucket; keeps the newest 30.",
    async run() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) return { ok: true, detail: { skipped: "SUPABASE_SERVICE_ROLE_KEY not set" } };
      const userId = await ownerUserId();
      if (!userId) return { ok: false, detail: { error: "owner user not found" } };

      const data = await exportData(userId);
      const body = new Blob([JSON.stringify(data)], { type: "application/json" });
      const name = `life-os-${new Date().toISOString().slice(0, 10)}.json`;

      const supabase = createClient(url, key, { auth: { persistSession: false } });
      const created = await supabase.storage.createBucket("backups", { public: false });
      if (created.error && !/already exists/i.test(created.error.message)) throw new Error(created.error.message);
      const up = await supabase.storage.from("backups").upload(name, body, { upsert: true, contentType: "application/json" });
      if (up.error) throw new Error(up.error.message);

      const list = await supabase.storage.from("backups").list("", { limit: 200, sortBy: { column: "name", order: "desc" } });
      const old = (list.data ?? []).slice(30).map((f) => f.name);
      if (old.length) await supabase.storage.from("backups").remove(old);
      return { ok: true, detail: { file: name, bytes: body.size, pruned: old.length } };
    },
  },
  "calendar-sync": {
    name: "calendar-sync",
    description: "Incremental Google Calendar sync (phase 4).",
    async run() {
      return { ok: true, detail: { skipped: "arrives in phase 4" } };
    },
  },
  reminders: {
    name: "reminders",
    description: "Shutdown and planning reminders via Web Push (phase 2).",
    async run() {
      return { ok: true, detail: { skipped: "arrives in phase 2" } };
    },
  },
};

/** Constant-time comparison of the bearer token against CRON_SECRET. */
export function isAuthorizedCronRequest(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorization) return false;
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (token.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}
