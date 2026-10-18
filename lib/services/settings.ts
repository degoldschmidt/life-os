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
};

const DEFAULTS: Settings = {
  tz: DEFAULT_TZ,
  dayStartHour: DEFAULT_DAY_START_HOUR,
  shutdownTime: "18:00",
  dailyCapacityMin: 360,
  aiModel: "claude-sonnet-5-5",
};

/** Settings for the current user; defaults until the DB is configured or a row exists. */
export async function getSettings(): Promise<Settings> {
  const user = await getCurrentUser();
  if (!user || !process.env.DATABASE_URL) return DEFAULTS;
  try {
    const [row] = await db().select().from(schema.settings).where(eq(schema.settings.userId, user.id)).limit(1);
    if (!row) return DEFAULTS;
    const { tz, dayStartHour, shutdownTime, dailyCapacityMin, aiModel } = row;
    return { tz, dayStartHour, shutdownTime, dailyCapacityMin, aiModel };
  } catch {
    return DEFAULTS;
  }
}

export type SettingsPatch = Partial<Pick<Settings, "tz" | "dayStartHour" | "shutdownTime" | "dailyCapacityMin" | "aiModel">>;

/** Create or update the user's settings row. */
export async function saveSettings(userId: string, patch: SettingsPatch): Promise<void> {
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  await db()
    .insert(schema.settings)
    .values({ userId, ...clean })
    .onConflictDoUpdate({ target: schema.settings.userId, set: { ...clean, updatedAt: new Date() } });
}
