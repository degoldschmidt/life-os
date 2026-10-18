import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ---------- enums ---------- */
export const goalHorizon = pgEnum("goal_horizon", ["quarter", "year"]);
export const goalStatus = pgEnum("goal_status", ["active", "achieved", "dropped"]);
export const projectStatus = pgEnum("project_status", ["active", "someday", "done", "archived"]);
export const taskWhen = pgEnum("task_when", ["inbox", "today", "scheduled", "anytime", "someday"]);
export const taskStatus = pgEnum("task_status", ["todo", "done", "dropped"]);
export const energy = pgEnum("energy", ["low", "med", "high"]);
export const blockKind = pgEnum("block_kind", ["deep", "shallow", "meeting", "personal", "recovery"]);
export const blockSource = pgEnum("block_source", ["manual", "gcal"]);
export const journalKind = pgEnum("journal_kind", ["morning", "interstitial", "shutdown", "freeform"]);
export const reviewType = pgEnum("review_type", ["day", "week", "month", "quarter", "year"]);
export const reviewStatus = pgEnum("review_status", ["draft", "final"]);
export const noteSource = pgEnum("note_source", ["manual", "notion", "apple_notes"]);

/* ---------- json shapes ---------- */
export type KeyResult = { id: string; metric: string; target: number; current: number; unit?: string };
export type Recurrence = {
  freq: "daily" | "weekdays" | "weekly" | "monthly" | "interval";
  byDay?: number[]; // 1 = Monday … 7 = Sunday
  interval?: number;
  until?: string; // day key
};
export type HabitSchedule = { days: number[] } | { perWeek: number };
export type ReviewQuestion = {
  id: string;
  prompt: string;
  kind: "text" | "scale" | "select" | "area_scores" | "top3" | "checklist";
  help?: string;
  options?: string[];
  max?: number;
};

const userId = () => uuid("user_id").notNull();
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/* ---------- core hierarchy ---------- */
export const areas = pgTable(
  "areas",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: userId(),
    code: text("code").notNull(), // WRK, HLT, REL, FIN
    name: text("name").notNull(),
    standard: text("standard"),
    weeklyTargetHours: real("weekly_target_hours"),
    satisfaction: integer("satisfaction"), // 1–10, re-rated quarterly
    sort: integer("sort").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("areas_user_code").on(t.userId, t.code)],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: userId(),
    areaId: uuid("area_id").notNull().references(() => areas.id),
    title: text("title").notNull(),
    description: text("description"),
    horizon: goalHorizon("horizon").notNull().default("quarter"),
    period: text("period").notNull(), // 2026-Q4 or 2026
    keyResults: jsonb("key_results").$type<KeyResult[]>().notNull().default([]),
    confidence: integer("confidence"), // 1–10
    status: goalStatus("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [index("goals_user_period").on(t.userId, t.period)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: userId(),
    areaId: uuid("area_id").notNull().references(() => areas.id),
    goalId: uuid("goal_id").references(() => goals.id),
    title: text("title").notNull(),
    notes: text("notes"),
    status: projectStatus("status").notNull().default("active"),
    deadline: date("deadline"),
    ...timestamps,
  },
  (t) => [index("projects_user_status").on(t.userId, t.status)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: userId(),
    areaId: uuid("area_id").references(() => areas.id),
    projectId: uuid("project_id").references(() => projects.id),
    title: text("title").notNull(),
    notes: text("notes"),
    when: taskWhen("when").notNull().default("inbox"),
    scheduledDate: date("scheduled_date"),
    plannedForDate: date("planned_for_date"), // set when it was part of a daily plan
    planRank: integer("plan_rank"), // 1–3 = Top 3
    deadline: date("deadline"),
    estimateMin: integer("estimate_min"),
    actualMin: integer("actual_min"),
    energy: energy("energy"),
    status: taskStatus("status").notNull().default("todo"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    recurrence: jsonb("recurrence").$type<Recurrence>(),
    seriesId: uuid("series_id"), // instance -> template task
    ...timestamps,
  },
  (t) => [
    index("tasks_user_when").on(t.userId, t.when),
    index("tasks_user_scheduled").on(t.userId, t.scheduledDate),
    index("tasks_user_planned").on(t.userId, t.plannedForDate),
    uniqueIndex("tasks_series_date").on(t.seriesId, t.scheduledDate),
  ],
);

export const timeBlocks = pgTable(
  "time_blocks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: userId(),
    date: date("date").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    tz: text("tz").notNull(),
    title: text("title").notNull(),
    kind: blockKind("kind").notNull().default("deep"),
    taskId: uuid("task_id").references(() => tasks.id),
    areaId: uuid("area_id").references(() => areas.id),
    calendarEventId: text("calendar_event_id"),
    source: blockSource("source").notNull().default("manual"),
    ...timestamps,
  },
  (t) => [index("blocks_user_date").on(t.userId, t.date)],
);

/* ---------- habits ---------- */
export const habits = pgTable("habits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: userId(),
  areaId: uuid("area_id").references(() => areas.id),
  name: text("name").notNull(),
  intention: text("intention"), // "after X I will Y"
  schedule: jsonb("schedule").$type<HabitSchedule>().notNull().default({ days: [1, 2, 3, 4, 5, 6, 7] }),
  sort: integer("sort").notNull().default(0),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
});

export const habitLogs = pgTable(
  "habit_logs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: userId(),
    habitId: uuid("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    value: integer("value").notNull().default(1),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("habit_logs_habit_date").on(t.habitId, t.date)],
);

/* ---------- journal ---------- */
export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: userId(),
    date: date("date").notNull(),
    kind: journalKind("kind").notNull().default("freeform"),
    contentMd: text("content_md").notNull().default(""),
    mood: integer("mood"), // 1–5
    energy: integer("energy"), // 1–5
    taskId: uuid("task_id").references(() => tasks.id),
    ...timestamps,
  },
  (t) => [index("journal_user_date").on(t.userId, t.date)],
);

/* ---------- reviews ---------- */
export const reviewTemplates = pgTable(
  "review_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    type: reviewType("type").notNull(),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    steps: jsonb("steps").$type<{ id: string; title: string; questions: ReviewQuestion[] }[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("review_templates_type_version").on(t.type, t.version)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: userId(),
    type: reviewType("type").notNull(),
    periodId: text("period_id").notNull(), // 2026-10-18 | 2026-W42 | 2026-10 | 2026-Q4 | 2026
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    templateId: uuid("template_id").notNull().references(() => reviewTemplates.id),
    currentStep: integer("current_step").notNull().default(0),
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull().default({}),
    statsSnapshot: jsonb("stats_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    decisions: jsonb("decisions").$type<Record<string, unknown>>().notNull().default({}),
    nextTop3: jsonb("next_top3").$type<string[]>().notNull().default([]),
    aiDraftMd: text("ai_draft_md"),
    status: reviewStatus("status").notNull().default("draft"),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("reviews_user_type_period").on(t.userId, t.type, t.periodId)],
);

export const reviewScores = pgTable(
  "review_scores",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: userId(),
    reviewId: uuid("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // e.g. area:HLT, mood, energy, planned_vs_done
    value: real("value").notNull(),
  },
  (t) => [index("review_scores_user_key").on(t.userId, t.key)],
);

/* ---------- notes ---------- */
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: userId(),
    title: text("title").notNull(),
    contentMd: text("content_md").notNull().default(""),
    areaId: uuid("area_id").references(() => areas.id),
    projectId: uuid("project_id").references(() => projects.id),
    source: noteSource("source").notNull().default("manual"),
    externalId: text("external_id"),
    ...timestamps,
  },
  (t) => [uniqueIndex("notes_source_external").on(t.userId, t.source, t.externalId)],
);

/* ---------- integrations and system ---------- */
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: text("id").primaryKey(), // google event id
    userId: userId(),
    calendarId: text("calendar_id").notNull(),
    etag: text("etag"),
    summary: text("summary"),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    allDay: boolean("all_day").notNull().default(false),
    status: text("status"),
    raw: jsonb("raw"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cal_events_user_start").on(t.userId, t.startAt)],
);

export const syncState = pgTable("sync_state", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: userId(),
  provider: text("provider").notNull(), // google_calendar
  resourceId: text("resource_id").notNull(), // calendar id
  syncToken: text("sync_token"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
});

export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: userId(),
    provider: text("provider").notNull(),
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scope: text("scope"),
    ...timestamps,
  },
  (t) => [uniqueIndex("oauth_user_provider").on(t.userId, t.provider)],
);

export const aiRuns = pgTable("ai_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: userId(),
  feature: text("feature").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: userId(),
  endpoint: text("endpoint").notNull().unique(),
  keys: jsonb("keys").$type<{ p256dh: string; auth: string }>().notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  userId: uuid("user_id").primaryKey(),
  tz: text("tz").notNull().default("Europe/Zurich"),
  dayStartHour: integer("day_start_hour").notNull().default(4),
  shutdownTime: text("shutdown_time").notNull().default("18:00"),
  dailyCapacityMin: integer("daily_capacity_min").notNull().default(360),
  aiModel: text("ai_model").notNull().default("claude-sonnet-5-5"),
  planTime: text("plan_time").notNull().default("08:30"),
  pushPlan: boolean("push_plan").notNull().default(true),
  pushShutdown: boolean("push_shutdown").notNull().default(true),
  pushWeekly: boolean("push_weekly").notNull().default(true),
  // What was last pushed, so each reminder fires at most once per day or week.
  lastPlanPush: date("last_plan_push"),
  lastShutdownPush: date("last_shutdown_push"),
  lastReviewPush: text("last_review_push"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- relations (for db.query) ---------- */
export const areasRelations = relations(areas, ({ many }) => ({
  goals: many(goals),
  projects: many(projects),
  tasks: many(tasks),
}));
export const goalsRelations = relations(goals, ({ one, many }) => ({
  area: one(areas, { fields: [goals.areaId], references: [areas.id] }),
  projects: many(projects),
}));
export const projectsRelations = relations(projects, ({ one, many }) => ({
  area: one(areas, { fields: [projects.areaId], references: [areas.id] }),
  goal: one(goals, { fields: [projects.goalId], references: [goals.id] }),
  tasks: many(tasks),
}));
export const tasksRelations = relations(tasks, ({ one }) => ({
  area: one(areas, { fields: [tasks.areaId], references: [areas.id] }),
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
}));
export const habitsRelations = relations(habits, ({ many }) => ({ logs: many(habitLogs) }));
export const habitLogsRelations = relations(habitLogs, ({ one }) => ({
  habit: one(habits, { fields: [habitLogs.habitId], references: [habits.id] }),
}));
export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  template: one(reviewTemplates, { fields: [reviews.templateId], references: [reviewTemplates.id] }),
  scores: many(reviewScores),
}));
export const reviewScoresRelations = relations(reviewScores, ({ one }) => ({
  review: one(reviews, { fields: [reviewScores.reviewId], references: [reviews.id] }),
}));
