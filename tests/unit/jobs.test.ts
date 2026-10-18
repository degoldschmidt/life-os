import { afterEach, describe, expect, it } from "vitest";
import { isAuthorizedCronRequest, JOBS } from "@/lib/jobs";

const original = process.env.CRON_SECRET;
afterEach(() => {
  process.env.CRON_SECRET = original;
});

describe("isAuthorizedCronRequest", () => {
  it("rejects when no secret is configured", () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorizedCronRequest("Bearer anything")).toBe(false);
  });
  it("accepts the exact bearer token only", () => {
    process.env.CRON_SECRET = "s3cret-token";
    expect(isAuthorizedCronRequest("Bearer s3cret-token")).toBe(true);
    expect(isAuthorizedCronRequest("bearer s3cret-token")).toBe(true);
    expect(isAuthorizedCronRequest("Bearer s3cret-tokeN")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer s3cret")).toBe(false);
    expect(isAuthorizedCronRequest(null)).toBe(false);
  });
});

describe("jobs", () => {
  it("heartbeat runs without a database configured", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const r = await JOBS.heartbeat.run();
    expect(r.ok).toBe(true);
    expect(String(r.detail?.db)).toContain("skipped");
  });
  it("exposes the expected job names", () => {
    expect(Object.keys(JOBS).sort()).toEqual(["calendar-sync", "heartbeat", "reminders"]);
  });
});
