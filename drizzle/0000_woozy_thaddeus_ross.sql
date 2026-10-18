CREATE TYPE "public"."block_kind" AS ENUM('deep', 'shallow', 'meeting', 'personal', 'recovery');--> statement-breakpoint
CREATE TYPE "public"."block_source" AS ENUM('manual', 'gcal');--> statement-breakpoint
CREATE TYPE "public"."energy" AS ENUM('low', 'med', 'high');--> statement-breakpoint
CREATE TYPE "public"."goal_horizon" AS ENUM('quarter', 'year');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'achieved', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."journal_kind" AS ENUM('morning', 'interstitial', 'shutdown', 'freeform');--> statement-breakpoint
CREATE TYPE "public"."note_source" AS ENUM('manual', 'notion', 'apple_notes');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'someday', 'done', 'archived');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('draft', 'final');--> statement-breakpoint
CREATE TYPE "public"."review_type" AS ENUM('day', 'week', 'month', 'quarter', 'year');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'done', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."task_when" AS ENUM('inbox', 'today', 'scheduled', 'anytime', 'someday');--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"standard" text,
	"weekly_target_hours" real,
	"satisfaction" integer,
	"sort" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"calendar_id" text NOT NULL,
	"etag" text,
	"summary" text,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"status" text,
	"raw" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"horizon" "goal_horizon" DEFAULT 'quarter' NOT NULL,
	"period" text NOT NULL,
	"key_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" integer,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"habit_id" uuid NOT NULL,
	"date" date NOT NULL,
	"value" integer DEFAULT 1 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"area_id" uuid,
	"name" text NOT NULL,
	"intention" text,
	"schedule" jsonb DEFAULT '{"days":[1,2,3,4,5,6,7]}'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" "journal_kind" DEFAULT 'freeform' NOT NULL,
	"content_md" text DEFAULT '' NOT NULL,
	"mood" integer,
	"energy" integer,
	"task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content_md" text DEFAULT '' NOT NULL,
	"area_id" uuid,
	"project_id" uuid,
	"source" "note_source" DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text,
	"expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"goal_id" uuid,
	"title" text NOT NULL,
	"notes" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"deadline" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "review_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "review_type" NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"steps" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "review_type" NOT NULL,
	"period_id" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"template_id" uuid NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stats_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"decisions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"next_top3" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_draft_md" text,
	"status" "review_status" DEFAULT 'draft' NOT NULL,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"tz" text DEFAULT 'Europe/Zurich' NOT NULL,
	"day_start_hour" integer DEFAULT 4 NOT NULL,
	"shutdown_time" text DEFAULT '18:00' NOT NULL,
	"daily_capacity_min" integer DEFAULT 360 NOT NULL,
	"ai_model" text DEFAULT 'claude-sonnet-5-5' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"resource_id" text NOT NULL,
	"sync_token" text,
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"area_id" uuid,
	"project_id" uuid,
	"title" text NOT NULL,
	"notes" text,
	"when" "task_when" DEFAULT 'inbox' NOT NULL,
	"scheduled_date" date,
	"planned_for_date" date,
	"plan_rank" integer,
	"deadline" date,
	"estimate_min" integer,
	"actual_min" integer,
	"energy" "energy",
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"done_at" timestamp with time zone,
	"recurrence" jsonb,
	"series_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"tz" text NOT NULL,
	"title" text NOT NULL,
	"kind" "block_kind" DEFAULT 'deep' NOT NULL,
	"task_id" uuid,
	"area_id" uuid,
	"calendar_event_id" text,
	"source" "block_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_scores" ADD CONSTRAINT "review_scores_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_template_id_review_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."review_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "areas_user_code" ON "areas" USING btree ("user_id","code");--> statement-breakpoint
CREATE INDEX "cal_events_user_start" ON "calendar_events" USING btree ("user_id","start_at");--> statement-breakpoint
CREATE INDEX "goals_user_period" ON "goals" USING btree ("user_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "habit_logs_habit_date" ON "habit_logs" USING btree ("habit_id","date");--> statement-breakpoint
CREATE INDEX "journal_user_date" ON "journal_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "notes_source_external" ON "notes" USING btree ("user_id","source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_user_provider" ON "oauth_tokens" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "projects_user_status" ON "projects" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "review_scores_user_key" ON "review_scores" USING btree ("user_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "review_templates_type_version" ON "review_templates" USING btree ("type","version");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_user_type_period" ON "reviews" USING btree ("user_id","type","period_id");--> statement-breakpoint
CREATE INDEX "tasks_user_when" ON "tasks" USING btree ("user_id","when");--> statement-breakpoint
CREATE INDEX "tasks_user_scheduled" ON "tasks" USING btree ("user_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "tasks_user_planned" ON "tasks" USING btree ("user_id","planned_for_date");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_series_date" ON "tasks" USING btree ("series_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "blocks_user_date" ON "time_blocks" USING btree ("user_id","date");