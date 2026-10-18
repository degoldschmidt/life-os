import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_DAY_START_HOUR, DEFAULT_TZ } from "@/lib/dates";

export type Settings = {
  tz: string;
  dayStartHour: number;
  shutdownTime: string;
  dailyCapacityMin: number;
  aiModel: string;
  planTime: string;
  pushPlan: boolean;
  pushShutdown: boolean;
  pushWeekly: boolean;
};

type Row = typeof schema.settings.$inferSelect;
const fromRow = (r: Row): Settings => ({
  tz: r.tz,
  dayStartHour: r.dayStartHour,
  shutdownTime: r.shutdownTime,
  dailyCapacityMin: r.dailyCapacityMin,
  aiModel: r.aiModel,
  planTime: r.planTime,
  pushPlan: r.pushPlan,
  pushShutdown: r.pushShutdown,
  pushWeekly: r.pushWeekly,
});

const DEFAULTS: Settings = {
  tz: DEFAULT_TZ,
  dayStartHour: DEFAULT_DAY_START_HOUR,
  shutdownTime: "18:00",
  dailyCapacityMin: 360,
  aiModel: "claude-sonnet-5-5",
  planTime: "08:30",
  pushPlan: true,
  pushShutdown: true,
  pushWeekly: true,
};

/** Settings for the current user; defaults until the DB is configured or a row exists. */
export async function getSettings(): Promise<Settings> {
  const user = await getCurrentUser();
  if (!user || !process.env.DATABASE_URL) return DEFAULTS;
  try {
    const [row] = await db().select().from(schema.settings).where(eq(schema.settings.userId, user.id)).limit(1);
    return row ? fromRow(row) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export type SettingsPatch = Partial<Settings>;

/** Create or update the user's settings row. */
export async function saveSettings(userId: string, patch: SettingsPatch): Promise<void> {
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  await db()
    .insert(schema.settings)
    .values({ userId, ...clean })
    .onConflictDoUpdate({ target: schema.settings.userId, set: { ...clean, updatedAt: new Date() } });
}

/** Settings for a specific user, for background jobs that have no session. */
export async function getSettingsFor(userId: string): Promise<Settings> {
  const [row] = await db().select().from(schema.settings).where(eq(schema.settings.userId, userId)).limit(1);
  return row ? fromRow(row) : DEFAULTS;
}

export type ReminderMark = { lastPlanPush: string | null; lastShutdownPush: string | null; lastReviewPush: string | null };

export async function getReminderMarks(userId: string): Promise<ReminderMark> {
  const [row] = await db().select().from(schema.settings).where(eq(schema.settings.userId, userId)).limit(1);
  return { lastPlanPush: row?.lastPlanPush ?? null, lastShutdownPush: row?.lastShutdownPush ?? null, lastReviewPush: row?.lastReviewPush ?? null };
}

export async function markReminderSent(userId: string, kind: "plan" | "shutdown" | "weekly", key: string): Promise<void> {
  const set = kind === "plan" ? { lastPlanPush: key } : kind === "shutdown" ? { lastShutdownPush: key } : { lastReviewPush: key };
  await db().update(schema.settings).set(set).where(eq(schema.settings.userId, userId));
}
