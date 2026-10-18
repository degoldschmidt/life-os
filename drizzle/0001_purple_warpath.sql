ALTER TABLE "settings" ADD COLUMN "plan_time" text DEFAULT '08:30' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "push_plan" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "push_shutdown" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "push_weekly" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "last_plan_push" date;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "last_shutdown_push" date;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "last_review_push" text;