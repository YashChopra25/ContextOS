CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_slug" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"hackathon_slug" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_repos" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"language" text,
	"stars" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"topics" text[] DEFAULT '{}' NOT NULL,
	"url" text NOT NULL,
	"is_fork" boolean DEFAULT false NOT NULL,
	"pushed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "github_stats" (
	"person_slug" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"public_repos" integer DEFAULT 0 NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"commits_90d" integer DEFAULT 0 NOT NULL,
	"weekly_activity" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"account_created_at" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hackathons" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"theme" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"is_sample" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"slug" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"full_name" text NOT NULL,
	"job_title" text,
	"organization" text,
	"role_category" text DEFAULT 'other' NOT NULL,
	"linkedin_url" text,
	"github_username" text,
	"portfolio_url" text,
	"avatar_url" text,
	"location" text,
	"bio" text,
	"membership" text NOT NULL,
	"context_status" text DEFAULT 'pending' NOT NULL,
	"activity_level" text DEFAULT 'low' NOT NULL,
	"summary" text,
	"summary_model" text,
	"signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dataset_row" integer,
	"context_built_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"confidence" text NOT NULL,
	"score" real NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_slug" text NOT NULL,
	"type" text NOT NULL,
	"url" text,
	"handle" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"technologies" text[] DEFAULT '{}' NOT NULL,
	"source" text NOT NULL,
	"url" text,
	"date" timestamp with time zone,
	"hackathon" text,
	"is_sample" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_person_slug_people_slug_fk" FOREIGN KEY ("person_slug") REFERENCES "public"."people"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_hackathon_slug_hackathons_slug_fk" FOREIGN KEY ("hackathon_slug") REFERENCES "public"."hackathons"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repos" ADD CONSTRAINT "github_repos_person_slug_people_slug_fk" FOREIGN KEY ("person_slug") REFERENCES "public"."people"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_stats" ADD CONSTRAINT "github_stats_person_slug_people_slug_fk" FOREIGN KEY ("person_slug") REFERENCES "public"."people"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_skills" ADD CONSTRAINT "person_skills_person_slug_people_slug_fk" FOREIGN KEY ("person_slug") REFERENCES "public"."people"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_sources" ADD CONSTRAINT "person_sources_person_slug_people_slug_fk" FOREIGN KEY ("person_slug") REFERENCES "public"."people"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_person_slug_people_slug_fk" FOREIGN KEY ("person_slug") REFERENCES "public"."people"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_person_idx" ON "activities" USING btree ("person_slug");--> statement-breakpoint
CREATE INDEX "activities_occurred_idx" ON "activities" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "github_repos_person_idx" ON "github_repos" USING btree ("person_slug");--> statement-breakpoint
CREATE INDEX "people_full_name_idx" ON "people" USING btree ("full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "people_github_idx" ON "people" USING btree ("github_username");--> statement-breakpoint
CREATE UNIQUE INDEX "person_skills_unique" ON "person_skills" USING btree ("person_slug","name");--> statement-breakpoint
CREATE INDEX "person_skills_name_idx" ON "person_skills" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "person_sources_unique" ON "person_sources" USING btree ("person_slug","type");--> statement-breakpoint
CREATE INDEX "projects_person_idx" ON "projects" USING btree ("person_slug");